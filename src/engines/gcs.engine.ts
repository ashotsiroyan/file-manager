import { createRequire } from 'module';
import { StorageEngine } from '../interfaces/storage-engine';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from '../interfaces/types';

type GcsModule = { Storage: any };
let gcsSdkCache: GcsModule | null = null;

function loadGcsSdk(): GcsModule {
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

export interface GcsEngineOptions {
  bucket: string;
  baseUrlPublic?: string;
  projectId?: string;
  auth?: GcsAuthOptions;
  storage?: any;
  storageOptions?: Record<string, any>;
}

export interface GcsAuthOptions {
  keyFilename?: string;
  keyFileJson?: string;
  clientEmail?: string;
  privateKey?: string;
  credentials?: { client_email: string; private_key: string };
}

export class GcsStorageEngine implements StorageEngine {
  private storage: any;
  private bucket: any;
  private readonly bucketName: string;
  private readonly publicBaseUrl?: string;
  
  constructor(opts: GcsEngineOptions) {
    const { Storage } = loadGcsSdk();

    if (!opts.bucket) {
      throw new Error('GCS bucket is required.');
    }
    this.bucketName = opts.bucket;
    
    this.publicBaseUrl = opts.baseUrlPublic ? opts.baseUrlPublic.replace(/\/$/, '') : undefined;
    
    if (opts.storage) {
      this.storage = opts.storage;
    } else {
      const storageConfig: Record<string, any> = { ...(opts.storageOptions || {}) };
      if (opts.projectId) storageConfig.projectId = opts.projectId;
      Object.assign(storageConfig, resolveGcsAuthConfig(opts.auth));
      this.storage = new Storage(storageConfig);
    }
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

import { Readable } from 'stream';

function ReadableFromBuffer(buf: Buffer | Uint8Array): Readable {
  const r = new Readable();
  r.push(buf);
  r.push(null);
  return r;
}

function resolveGcsAuthConfig(auth?: GcsAuthOptions) {
  if (!auth) return {};
  
  const config: Record<string, any> = {};
  const keyFilename = auth.keyFilename;
  if (keyFilename) {
    config.keyFilename = keyFilename;
  }
  
  const rawCredentials = auth.keyFileJson;
  const directCredentials = auth.credentials;
  const clientEmail = auth.clientEmail;
  const privateKeyRaw = auth.privateKey;
  
  let credentials: any | undefined = directCredentials ? { ...directCredentials } : undefined;
  
  if (rawCredentials) {
    credentials = parseGcsCredentials(rawCredentials);
  }
  
  if (clientEmail || privateKeyRaw) {
    if (!clientEmail || !privateKeyRaw) {
      throw new Error(
        'GCS inline credentials require both clientEmail and privateKey. Provide both values when using inline credentials.',
      );
    }
    credentials = {
      client_email: clientEmail,
      private_key: normalizePrivateKey(privateKeyRaw),
    };
  }
  
  if (credentials) {
    config.credentials = credentials;
  }
  
  return config;
}

function parseGcsCredentials(raw: string) {
  let text = raw.trim();
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8').trim();
    } catch {
      throw new Error('Failed to decode base64 GCS credentials JSON. Provide valid JSON or base64 encoded JSON.');
    }
  }
  
  try {
    const parsed = JSON.parse(text);
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    return parsed;
  } catch {
    throw new Error('Invalid GCS credentials JSON provided. Ensure the JSON is correctly formatted.');
  }
}

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, '\n');
}
