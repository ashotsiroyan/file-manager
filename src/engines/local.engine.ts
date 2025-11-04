import { StorageEngine } from '../interfaces/storage-engine';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from '../types';
import { createReadStream, createWriteStream, promises as fsp } from 'fs';
import { mkdir, stat, access, readdir, rename } from 'fs/promises';
import { constants } from 'fs';
import { join, dirname, resolve } from 'path';
import { lookup as mimeLookup } from 'mime-types';

export interface LocalEngineOptions {
  baseDir: string;
  publicBaseUrl?: string;
}

export class LocalStorageEngine implements StorageEngine {
  constructor(private readonly opts: LocalEngineOptions) {}

  private abs(key: string) {
    return resolve(join(this.opts.baseDir, key));
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const full = this.abs(input.key);
    await mkdir(dirname(full), { recursive: true });

    const write = createWriteStream(full);
    const body = input.body as NodeJS.ReadableStream | Buffer | Uint8Array;

    const size = await new Promise<number>((resolveSize, reject) => {
      let bytes = 0;
      const src =
        body instanceof Buffer || body instanceof Uint8Array
          ? ReadableFromBuffer(body)
          : (body as NodeJS.ReadableStream);

      src.on('data', (chunk) => (bytes += chunk.length));
      src.on('error', reject);
      write.on('error', reject);
      write.on('finish', () => resolveSize(bytes));
      src.pipe(write);
    });

    return {
      key: input.key,
      size,
      url: this.opts.publicBaseUrl ? `${this.opts.publicBaseUrl}/${input.key}` : undefined,
    };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const full = this.abs(key);
    const st = await stat(full);
    const stream = createReadStream(full);
    const contentType = mimeLookup(key) || undefined;
    return { stream, contentType, size: st.size, lastModified: st.mtime };
  }

  async deleteObject(key: string): Promise<void> {
    await fsp.rm(this.abs(key), { force: true });
  }

  async copyObject(srcKey: string, destKey: string): Promise<void> {
    await mkdir(dirname(this.abs(destKey)), { recursive: true });
    await fsp.copyFile(this.abs(srcKey), this.abs(destKey));
  }

  async moveObject(srcKey: string, destKey: string): Promise<void> {
    await mkdir(dirname(this.abs(destKey)), { recursive: true });
    await rename(this.abs(srcKey), this.abs(destKey));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.abs(key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string, cursor?: string, limit = 100): Promise<ListObjectsResult> {
    const dir = this.abs(prefix);
    let items: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const rel = join(prefix, e.name).replace(/\\/g, '/');
        if (e.isDirectory()) {
          items.push(`${rel}/`);
        } else {
          items.push(rel);
        }
      }
    } catch {
      items = [];
    }

    const start = cursor ? parseInt(cursor, 10) : 0;
    const slice = items.slice(start, start + limit);
    const nextCursor = start + limit < items.length ? String(start + limit) : undefined;
    return { keys: slice, nextCursor };
  }

  async getSignedUrl(opts: SignedUrlOptions): Promise<string> {
    if (!this.opts.publicBaseUrl)
      throw new Error('Local engine cannot sign URLs without publicBaseUrl.');
    return `${this.opts.publicBaseUrl}/${opts.key}`;
  }

  resolvePublicUrl(key: string): string | undefined {
    return this.opts.publicBaseUrl ? `${this.opts.publicBaseUrl}/${key}` : undefined;
  }
}

import { Readable } from 'stream';
function ReadableFromBuffer(buf: Buffer | Uint8Array): Readable {
  const r = new Readable();
  r.push(buf);
  r.push(null);
  return r;
}
