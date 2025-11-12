import { Injectable } from '@nestjs/common';
import {
  FileManagerServiceOptions,
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageEngine,
} from './interfaces';
import { makeStorageKey } from './utils/file-key.util';
import { AsyncSemaphore } from './utils/async-semaphore';

@Injectable()
export class FileManagerService {
  private readonly semaphore?: AsyncSemaphore;

  constructor(
    private readonly engine: StorageEngine,
    private readonly opts?: FileManagerServiceOptions,
  ) {
    const maxConcurrentOps = opts?.maxConcurrentOps;
    if (typeof maxConcurrentOps === 'number' && maxConcurrentOps > 0) {
      this.semaphore = new AsyncSemaphore(maxConcurrentOps);
    }
  }

  makeKey(prefix?: string, originalName?: string) {
    return makeStorageKey(
      prefix || this.opts?.defaultPrefix || 'uploads',
      originalName,
    );
  }

  async put(
    input: Omit<PutObjectInput, 'key'> & {
      key?: string;
      prefix?: string;
      originalName?: string;
    },
  ): Promise<PutObjectResult> {
    const key = input.key ?? this.makeKey(input.prefix, input.originalName);
    return this.runWithConcurrency(() =>
      this.engine.putObject({
        ...input,
        key,
        aclPublic: input.aclPublic ?? this.opts?.publicReadByDefault ?? false,
      }),
    );
  }

  async get(key: string): Promise<GetObjectResult> {
    return this.runWithConcurrency(() => this.engine.getObject(key));
  }

  async delete(key: string): Promise<void> {
    await this.runWithConcurrency(() => this.engine.deleteObject(key));
  }

  async deleteDirectory(prefix: string): Promise<void> {
    await this.runWithConcurrency(() => this.engine.deleteDirectory(prefix));
  }

  async move(srcKey: string, destKey: string): Promise<void> {
    await this.runWithConcurrency(() =>
      this.engine.moveObject(srcKey, destKey),
    );
  }

  async copy(srcKey: string, destKey: string): Promise<void> {
    await this.runWithConcurrency(() =>
      this.engine.copyObject(srcKey, destKey),
    );
  }

  async exists(key: string): Promise<boolean> {
    return this.runWithConcurrency(() => this.engine.exists(key));
  }

  async list(
    prefix: string,
    cursor?: string,
    limit?: number,
  ): Promise<ListObjectsResult> {
    return this.runWithConcurrency(() =>
      this.engine.list(prefix, cursor, limit),
    );
  }

  async signedUrl(opts: SignedUrlOptions): Promise<string> {
    return this.runWithConcurrency(() => this.engine.getSignedUrl(opts));
  }

  publicUrl(key: string): string | undefined {
    return this.engine.resolvePublicUrl?.(key);
  }

  private async runWithConcurrency<T>(task: () => Promise<T>): Promise<T> {
    if (!this.semaphore) {
      return task();
    }
    return this.semaphore.run(task);
  }
}

const serviceTokenRegistry = new Map<string, symbol>();

export function getFileManagerServiceToken(
  name?: string,
): symbol | typeof FileManagerService {
  if (!name) {
    return FileManagerService;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Storage name cannot be an empty string.');
  }

  if (!serviceTokenRegistry.has(trimmed)) {
    serviceTokenRegistry.set(
      trimmed,
      Symbol(`FILE_MANAGER_SERVICE:${trimmed}`),
    );
  }

  return serviceTokenRegistry.get(trimmed)!;
}
