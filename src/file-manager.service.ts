import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { StorageEngine } from './interfaces/storage-engine';
import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from './interfaces/types';
import { makeStorageKey } from './file-key.util';

export const FILE_MANAGER_ENGINE = Symbol('FILE_MANAGER_ENGINE');
export const FILE_MANAGER_OPTIONS = Symbol('FILE_MANAGER_OPTIONS');

export interface FileManagerModuleOptions {
  defaultPrefix?: string;
  publicReadByDefault?: boolean;
}

@Injectable()
export class FileManagerService {
  private readonly logger = new Logger(FileManagerService.name);

  constructor(
    @Inject(FILE_MANAGER_ENGINE) private readonly engine: StorageEngine,
    @Optional() @Inject(FILE_MANAGER_OPTIONS) private readonly opts?: FileManagerModuleOptions,
  ) {}

  makeKey(prefix?: string, originalName?: string) {
    return makeStorageKey(prefix || this.opts?.defaultPrefix || 'uploads', originalName);
  }

  async put(input: Omit<PutObjectInput, 'key'> & { key?: string; prefix?: string; originalName?: string }): Promise<PutObjectResult> {
    const key = input.key ?? this.makeKey(input.prefix, input.originalName);
    const res = await this.engine.putObject({
      ...input,
      key,
      aclPublic: input.aclPublic ?? this.opts?.publicReadByDefault ?? false,
    });
    return res;
  }

  async get(key: string): Promise<GetObjectResult> {
    return this.engine.getObject(key);
  }

  async delete(key: string): Promise<void> {
    await this.engine.deleteObject(key);
  }

  async move(srcKey: string, destKey: string): Promise<void> {
    await this.engine.moveObject(srcKey, destKey);
  }

  async copy(srcKey: string, destKey: string): Promise<void> {
    await this.engine.copyObject(srcKey, destKey);
  }

  async exists(key: string): Promise<boolean> {
    return this.engine.exists(key);
  }

  async list(prefix: string, cursor?: string, limit?: number): Promise<ListObjectsResult> {
    return this.engine.list(prefix, cursor, limit);
  }

  async signedUrl(opts: SignedUrlOptions): Promise<string> {
    return this.engine.getSignedUrl(opts);
  }

  publicUrl(key: string): string | undefined {
    return this.engine.resolvePublicUrl?.(key);
  }
}
