import { StorageEngine } from '../interfaces/storage-engine';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from '../types';

export interface S3EngineOptions {
  bucket: string;
  region?: string;
  baseUrlPublic?: string;
}

export class S3StorageEngine implements StorageEngine {
  private s3: any;
  private signer: any;
  constructor(private readonly opts: S3EngineOptions) {
    const { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } =
      require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

    this.s3 = new S3Client({ region: opts.region });
    this.signer = { getSignedUrl, cmds: { GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } };
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const { PutObjectCommand } = this.signer.cmds;
    const res = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.opts.bucket,
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
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
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
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }

  async copyObject(srcKey: string, destKey: string): Promise<void> {
    const { CopyObjectCommand } = this.signer.cmds;
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.opts.bucket,
        CopySource: `/${this.opts.bucket}/${srcKey}`,
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
        Bucket: this.opts.bucket,
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
        Bucket: this.opts.bucket,
        Key: opts.key,
        ContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresInSeconds ?? 900 },
    );
  }

  resolvePublicUrl(key: string): string | undefined {
    return this.opts.baseUrlPublic
      ? `${this.opts.baseUrlPublic.replace(/\/$/, '')}/${key}`
      : undefined;
  }
}
