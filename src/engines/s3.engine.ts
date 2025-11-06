import { StorageEngine } from '../interfaces/storage-engine';
import { createRequire } from 'module';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from '../interfaces/types';
import { AwsSdkModules, S3EngineOptions } from '../interfaces/s3.interface';


let awsSdkCache: AwsSdkModules | null = null;

function loadAwsSdk(): AwsSdkModules {
  if (awsSdkCache) return awsSdkCache;
  const requireFn = createRequire(__filename);
  
  try {
    const client = requireFn('@aws-sdk/client-s3');
    const presigner = requireFn('@aws-sdk/s3-request-presigner');
    awsSdkCache = {
      S3Client: client.S3Client,
      GetObjectCommand: client.GetObjectCommand,
      PutObjectCommand: client.PutObjectCommand,
      CopyObjectCommand: client.CopyObjectCommand,
      DeleteObjectCommand: client.DeleteObjectCommand,
      ListObjectsV2Command: client.ListObjectsV2Command,
      getSignedUrl: presigner.getSignedUrl,
    };
    return awsSdkCache;
  } catch (error) {
    throw new Error(
      'S3 engine requires optional packages @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner. Install them to use S3StorageEngine.',
    );
  }
}

export class S3StorageEngine implements StorageEngine {
  private s3: any;
  private signer: any;
  private readonly bucketName: string;
  private readonly publicBaseUrl?: string;
  
  constructor(opts: S3EngineOptions) {
    if (!opts || !opts.bucket) {
      throw new Error('S3 bucket is required.');
    }
    
    const {
      S3Client,
      GetObjectCommand,
      PutObjectCommand,
      CopyObjectCommand,
      DeleteObjectCommand,
      ListObjectsV2Command,
      getSignedUrl,
    } = loadAwsSdk();
    
    this.bucketName = opts.bucket;
    
    this.publicBaseUrl = opts.baseUrlPublic ? opts.baseUrlPublic.replace(/\/$/, '') : undefined;
    
    const clientConfig: Record<string, any> = { ...(opts.clientConfig || {}) };
    if (opts.region) clientConfig.region = opts.region;
    if (opts.endpoint) clientConfig.endpoint = opts.endpoint;
    if (typeof opts.forcePathStyle === 'boolean') clientConfig.forcePathStyle = opts.forcePathStyle;
    if (opts.credentials) clientConfig.credentials = { ...opts.credentials };
    
    this.s3 = opts.client ?? new S3Client(clientConfig);
    this.signer = {
      getSignedUrl,
      cmds: { GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command }
    };
  }
  
  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const { PutObjectCommand } = this.signer.cmds;
    const res = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        Body: input.body as any,
        ContentType: input.contentType,
        Metadata: input.metadata,
        ACL: input.aclPublic ? 'public-read' : undefined,
      }),
    );
    return {
      key: input.key,
      etag: res.ETag,
      url: this.resolvePublicUrl(input.key),
    };
  }
  
  async getObject(key: string): Promise<GetObjectResult> {
    const { GetObjectCommand } = this.signer.cmds;
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
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
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }
  
  async copyObject(srcKey: string, destKey: string): Promise<void> {
    const { CopyObjectCommand } = this.signer.cmds;
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `/${ this.bucketName }/${ srcKey }`,
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
      await this.getObject(key);
      return true;
    } catch {
      return false;
    }
  }
  
  async list(prefix: string, cursor?: string, limit = 100): Promise<ListObjectsResult> {
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
    const Command = opts.action === 'get' ? GetObjectCommand : PutObjectCommand;
    return this.signer.getSignedUrl(
      this.s3,
      new Command({
        Bucket: this.bucketName,
        Key: opts.key,
        ContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresInSeconds ?? 900 },
    );
  }
  
  resolvePublicUrl(key: string): string | undefined {
    return this.publicBaseUrl ? `${ this.publicBaseUrl }/${ key }` : undefined;
  }
}
