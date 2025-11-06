import { createRequire } from 'module';
import { StorageEngine } from '../interfaces/storage-engine';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from '../interfaces/types';
import { ReadableFromBuffer, resolveGcsAuthConfig } from '../utils/engine-auth.util';
import { GcsEngineOptions, GcsSdkModule } from '../interfaces/gcs.interface';

let gcsSdkCache: GcsSdkModule | null = null;

function loadGcsSdk(): GcsSdkModule {
  if (gcsSdkCache) return gcsSdkCache;
  const requireFn = createRequire(__filename);
  try {
    const storageLib = requireFn('@google-cloud/storage');
    gcsSdkCache = { Storage: storageLib.Storage };
    return gcsSdkCache;
  } catch {
    throw new Error(
      'GCS engine requires optional package @google-cloud/storage. Install it to use GcsStorageEngine.',
    );
  }
}

export class GcsStorageEngine implements StorageEngine {
  private storage: any;
  private bucket: any;
  private readonly bucketName: string;
  private readonly publicBaseUrl?: string;
  
  constructor(opts: GcsEngineOptions) {
    if (!opts || !opts.bucket) {
      throw new Error('GCS bucket is required.');
    }
    
    this.bucketName = opts.bucket.trim();
    this.publicBaseUrl = opts.baseUrlPublic
      ? opts.baseUrlPublic.replace(/\/+$/, '')
      : undefined;
    
    if (opts.storage && (opts.storageOptions || opts.auth)) {
      throw new Error('Provide either opts.storage OR (opts.storageOptions/opts.auth), not both.');
    }
    
    if (opts.auth && 'keyFilename' in opts.auth && 'credentials' in opts.auth) {
      throw new Error('Provide either auth.keyFilename or auth.credentials, not both.');
    }
    
    const { Storage } = loadGcsSdk();
    
    const storageConfig: Record<string, any> = { ...(opts.storageOptions || {}) };
    if (opts.projectId) storageConfig.projectId = opts.projectId;
    
    const authCfg = resolveGcsAuthConfig(opts.auth);
    if (authCfg.credentials?.private_key) {
      authCfg.credentials.private_key = authCfg.credentials.private_key.replace(/\\n/g, '\n');
    }
    Object.assign(storageConfig, authCfg);
    
    this.storage = new Storage(storageConfig);
    
    this.bucket = this.storage.bucket(this.bucketName);
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
    const [files, nextQuery] = await this.bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken: cursor,
    });
    return {
      keys: files.map((f: any) => f.name as string),
      nextCursor: nextQuery?.pageToken,
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
    return this.publicBaseUrl ? `${ this.publicBaseUrl }/${ key }` : undefined;
  }
}
