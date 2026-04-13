import type {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createRequire } from 'module';
import {
  AwsSdkModules,
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  S3EngineOptions,
  SignedUrlOptions,
  StorageEngine,
} from '../interfaces';

let awsSdkCache: AwsSdkModules | null = null;

function loadAwsSdk(): AwsSdkModules {
  if (awsSdkCache) return awsSdkCache;
  const requireFn = createRequire(__filename);

  try {
    const client = requireFn('@aws-sdk/client-s3');
    const libStorage = requireFn('@aws-sdk/lib-storage');
    const presigner = requireFn('@aws-sdk/s3-request-presigner');
    awsSdkCache = {
      S3Client: client.S3Client,
      Upload: libStorage.Upload,
      GetObjectCommand: client.GetObjectCommand,
      PutObjectCommand: client.PutObjectCommand,
      CopyObjectCommand: client.CopyObjectCommand,
      DeleteObjectCommand: client.DeleteObjectCommand,
      DeleteObjectsCommand: client.DeleteObjectsCommand,
      ListObjectsV2Command: client.ListObjectsV2Command,
      HeadObjectCommand: client.HeadObjectCommand,
      getSignedUrl: presigner.getSignedUrl,
    };
    return awsSdkCache;
  } catch (error) {
    throw new Error(
      'S3 engine requires optional peer dependencies @aws-sdk/client-s3, @aws-sdk/lib-storage, and @aws-sdk/s3-request-presigner. Install them to use S3StorageEngine.',
    );
  }
}

function buildCopySource(bucket: string, key: string) {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/${encodedBucket}/${encodedKey}`;
}

export class S3StorageEngine implements StorageEngine {
  private s3: S3Client;
  private signer: {
    upload: AwsSdkModules['Upload'];
    getSignedUrl: AwsSdkModules['getSignedUrl'];
    cmds: {
      GetObjectCommand: typeof GetObjectCommand;
      PutObjectCommand: typeof PutObjectCommand;
      CopyObjectCommand: typeof CopyObjectCommand;
      DeleteObjectCommand: typeof DeleteObjectCommand;
      DeleteObjectsCommand: typeof DeleteObjectsCommand;
      ListObjectsV2Command: typeof ListObjectsV2Command;
      HeadObjectCommand: typeof HeadObjectCommand;
    };
  };
  private readonly bucketName: string;
  private readonly publicBaseUrl?: string;
  private readonly uploadQueueSize?: number;
  private readonly uploadPartSize?: number;
  private readonly leavePartsOnError?: boolean;

  constructor(opts: S3EngineOptions) {
    if (!opts || !opts.bucket) {
      throw new Error('S3 bucket is required.');
    }

    if (
      typeof opts.uploadPartSize === 'number' &&
      opts.uploadPartSize < 5 * 1024 * 1024
    ) {
      throw new Error('S3 multipart uploadPartSize must be at least 5 MiB.');
    }

    const {
      S3Client,
      Upload,
      GetObjectCommand,
      PutObjectCommand,
      CopyObjectCommand,
      DeleteObjectCommand,
      DeleteObjectsCommand,
      ListObjectsV2Command,
      HeadObjectCommand,
      getSignedUrl,
    } = loadAwsSdk();

    this.bucketName = opts.bucket;

    this.publicBaseUrl = opts.baseUrlPublic
      ? opts.baseUrlPublic.replace(/\/$/, '')
      : undefined;
    this.uploadQueueSize = opts.uploadQueueSize;
    this.uploadPartSize = opts.uploadPartSize;
    this.leavePartsOnError = opts.leavePartsOnError;

    const clientConfig: Record<string, any> = { ...(opts.clientConfig || {}) };
    if (opts.region) clientConfig.region = opts.region;
    if (opts.endpoint) clientConfig.endpoint = opts.endpoint;
    if (typeof opts.forcePathStyle === 'boolean')
      clientConfig.forcePathStyle = opts.forcePathStyle;
    if (opts.credentials) clientConfig.credentials = { ...opts.credentials };

    this.s3 = opts.client ?? new S3Client(clientConfig);
    this.signer = {
      upload: Upload,
      getSignedUrl,
      cmds: {
        GetObjectCommand,
        PutObjectCommand,
        CopyObjectCommand,
        DeleteObjectCommand,
        DeleteObjectsCommand,
        ListObjectsV2Command,
        HeadObjectCommand,
      },
    };
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    let size: number | undefined;
    const body = input.body;

    if (body instanceof Buffer || body instanceof Uint8Array) {
      size = body.length;
    }

    const upload = new this.signer.upload({
      client: this.s3,
      params: {
        Bucket: this.bucketName,
        Key: input.key,
        Body: body as any,
        ContentType: input.contentType,
        Metadata: input.metadata,
        ACL: input.aclPublic ? 'public-read' : undefined,
        ContentLength: size,
      },
      queueSize: this.uploadQueueSize,
      partSize: this.uploadPartSize,
      leavePartsOnError: this.leavePartsOnError,
    });

    const res = await upload.done();

    return {
      key: input.key,
      etag: res.ETag,
      size,
      url: this.resolvePublicUrl(input.key),
    };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const { GetObjectCommand } = this.signer.cmds;
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
    return {
      stream: res.Body as NodeJS.ReadableStream,
      contentType: res.ContentType,
      size: res.ContentLength,
      metadata: res.Metadata,
      lastModified: res.LastModified,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const { DeleteObjectCommand } = this.signer.cmds;
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
  }

  async deleteDirectory(prefix: string): Promise<void> {
    const { ListObjectsV2Command, DeleteObjectsCommand } = this.signer.cmds;
    let cursor: string | undefined;

    do {
      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: cursor,
          MaxKeys: 1000,
        }),
      );

      const keys = (res.Contents || [])
        .map((o: any) => o.Key as string)
        .filter(Boolean);

      if (keys.length) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: {
              Objects: keys.map((key: string) => ({ Key: key })),
            },
          }),
        );
      }

      cursor = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (cursor);
  }

  async copyObject(srcKey: string, destKey: string): Promise<void> {
    const { CopyObjectCommand } = this.signer.cmds;
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: buildCopySource(this.bucketName, srcKey),
        Key: destKey,
      }),
    );
  }

  async moveObject(srcKey: string, destKey: string): Promise<void> {
    await this.copyObject(srcKey, destKey);
    await this.deleteObject(srcKey);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const { HeadObjectCommand } = this.signer.cmds;
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async list(
    prefix: string,
    cursor?: string,
    limit = 100,
  ): Promise<ListObjectsResult> {
    const { ListObjectsV2Command } = this.signer.cmds;
    const res = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        ContinuationToken: cursor,
        MaxKeys: limit,
      }),
    );
    return {
      keys: (res.Contents || []).map((o: any) => o.Key as string),
      nextCursor: res.IsTruncated ? res.NextContinuationToken : undefined,
    };
  }

  async getSignedUrl(opts: SignedUrlOptions): Promise<string> {
    const { GetObjectCommand, PutObjectCommand } = this.signer.cmds;
    let command: GetObjectCommand | PutObjectCommand;

    if (opts.action === 'get') {
      command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: opts.key,
      });
    } else {
      command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: opts.key,
        ContentType: opts.contentType,
      });
    }

    return this.signer.getSignedUrl(this.s3, command, {
      expiresIn: opts.expiresInSeconds ?? 900,
    });
  }

  resolvePublicUrl(key: string): string | undefined {
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${key}` : undefined;
  }
}
