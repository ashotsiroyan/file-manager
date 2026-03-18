import {
  GetObjectResult,
  ListObjectsResult,
  LocalEngineOptions,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageEngine,
} from '../interfaces';
import {
  constants,
  createReadStream,
  createWriteStream,
  promises as fsp,
} from 'fs';
import { access, mkdir, readdir, rename, stat } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { ReadableFromBuffer } from '../utils/engine-auth.util';

export class LocalStorageEngine implements StorageEngine {
  private readonly baseDir: string;

  constructor(private readonly opts: LocalEngineOptions) {
    if (!opts?.baseDir) {
      throw new Error('Local engine requires a baseDir.');
    }
    this.baseDir = resolve(opts.baseDir);
  }

  private abs(key: string, allowBase = false) {
    const safeKey = key ?? '';
    if (!allowBase && !safeKey.trim()) {
      throw new Error('Key is required.');
    }

    const full = resolve(this.baseDir, safeKey);
    const rel = relative(this.baseDir, full);

    if (rel.startsWith('..') || isAbsolute(rel) || (rel === '' && !allowBase)) {
      throw new Error('Invalid key path.');
    }

    return full;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const full = this.abs(input.key);
    await mkdir(dirname(full), { recursive: true });

    const write = createWriteStream(full);
    const body = input.body as NodeJS.ReadableStream | Buffer | Uint8Array;

    const size = await new Promise<number>((resolveSize, reject) => {
      let bytes = 0;
      const src: NodeJS.ReadableStream =
        body instanceof Buffer || body instanceof Uint8Array
          ? ReadableFromBuffer(body)
          : body;

      src.on('data', (chunk: any) => (bytes += chunk.length));
      src.on('error', reject);
      write.on('error', reject);
      write.on('finish', () => resolveSize(bytes));
      src.pipe(write);
    });

    return {
      key: input.key,
      size,
      url: this.opts.publicBaseUrl
        ? `${this.opts.publicBaseUrl}/${input.key}`
        : undefined,
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

  async deleteDirectory(prefix: string): Promise<void> {
    await fsp.rm(this.abs(prefix, true), { recursive: true, force: true });
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

  async list(
    prefix: string,
    cursor?: string,
    limit = 100,
  ): Promise<ListObjectsResult> {
    const target = this.abs(prefix, true);
    const start = cursor ? parseInt(cursor, 10) : 0;
    const items: string[] = [];
    let seen = 0;
    let hasMore = false;

    let stats;
    try {
      stats = await stat(target);
    } catch {
      return { keys: [], nextCursor: undefined };
    }

    if (stats.isFile()) {
      if (start === 0 && limit > 0) {
        return { keys: [prefix.replace(/\\/g, '/')], nextCursor: undefined };
      }
      return { keys: [], nextCursor: undefined };
    }

    const queue: string[] = [target];

    while (queue.length) {
      const dir = queue.shift()!;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }

        if (seen < start) {
          seen++;
          continue;
        }

        if (items.length >= limit) {
          hasMore = true;
          break;
        }

        const relKey = relative(this.baseDir, fullPath).replace(/\\/g, '/');
        items.push(relKey);
        seen++;
      }

      if (hasMore) break;
    }

    return {
      keys: items,
      nextCursor: hasMore ? String(start + items.length) : undefined,
    };
  }

  async getSignedUrl(opts: SignedUrlOptions): Promise<string> {
    if (!this.opts.publicBaseUrl)
      throw new Error('Local engine cannot sign URLs without publicBaseUrl.');
    return `${this.opts.publicBaseUrl}/${opts.key}`;
  }

  resolvePublicUrl(key: string): string | undefined {
    return this.opts.publicBaseUrl
      ? `${this.opts.publicBaseUrl}/${key}`
      : undefined;
  }
}
