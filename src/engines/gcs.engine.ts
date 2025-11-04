import { StorageEngine } from '../interfaces/storage-engine';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from '../types';

export interface GcsEngineOptions {
  bucket: string;
  baseUrlPublic?: string;
}

export class GcsStorageEngine implements StorageEngine {
  private storage: any;
  private bucket: any;

  constructor(private readonly opts: GcsEngineOptions) {
    const { Storage } = require('@google-cloud/storage');
    this.storage = new Storage();
    this.bucket = this.storage.bucket(opts.bucket);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const file = this.bucket.file(input.key);
    const stream = file.createWriteStream({
      metadata: {
        contentType: input.contentType || undefined,
        metadata: input.metadata,
      },
      resumable: false,
      predefinedAcl: input.aclPublic ? 'publicRead' : undefined,
    });

    const size = await new Promise<number>((resolve, reject) => {
      let bytes = 0;
      const src =
        input.body instanceof Buffer || input.body instanceof Uint8Array
          ? ReadableFromBuffer(input.body)
          : (input.body as NodeJS.ReadableStream);
      src.on('data', (c) => (bytes += c.length));
      src.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', () => resolve(bytes));
      src.pipe(stream);
    });

    return { key: input.key, size, url: this.resolvePublicUrl(input.key) };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const file = this.bucket.file(key);
    const [metadata] = await file.getMetadata();
    const stream = file.createReadStream();
    return {
      stream,
      contentType: metadata.contentType,
      size: Number(metadata.size),
      metadata: metadata.metadata,
      lastModified: metadata.updated ? new Date(metadata.updated) : undefined,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  async copyObject(srcKey: string, destKey: string): Promise<void> {
    await this.bucket.file(srcKey).copy(this.bucket.file(destKey));
  }

  async moveObject(srcKey: string, destKey: string): Promise<void> {
    await this.bucket.file(srcKey).move(this.bucket.file(destKey));
  }

  async exists(key: string): Promise<boolean> {
    const [exists] = await this.bucket.file(key).exists();
    return !!exists;
  }

  async list(prefix: string, cursor?: string, limit = 100): Promise<ListObjectsResult> {
    const [files, , response] = await this.bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken: cursor,
    });
    return {
      keys: files.map((f: any) => f.name as string),
      nextCursor: response?.pageToken,
    };
  }

  async getSignedUrl(opts: SignedUrlOptions): Promise<string> {
    const file = this.bucket.file(opts.key);
    const action = opts.action === 'get' ? 'read' : 'write';
    const [url] = await file.getSignedUrl({
      action,
      expires: Date.now() + 1000 * (opts.expiresInSeconds ?? 900),
      contentType: opts.contentType,
    });
    return url;
  }

  resolvePublicUrl(key: string): string | undefined {
    return this.opts.baseUrlPublic
      ? `${this.opts.baseUrlPublic.replace(/\/$/, '')}/${key}`
      : undefined;
  }
}

import { Readable } from 'stream';
function ReadableFromBuffer(buf: Buffer | Uint8Array): Readable {
  const r = new Readable();
  r.push(buf);
  r.push(null);
  return r;
}
