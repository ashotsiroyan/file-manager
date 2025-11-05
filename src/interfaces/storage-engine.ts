import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from './types';

export interface StorageEngine {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(key: string): Promise<GetObjectResult>;
  deleteObject(key: string): Promise<void>;
  copyObject(srcKey: string, destKey: string): Promise<void>;
  moveObject(srcKey: string, destKey: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string, cursor?: string, limit?: number): Promise<ListObjectsResult>;
  getSignedUrl(opts: SignedUrlOptions): Promise<string>;
  resolvePublicUrl?(key: string): string | undefined;
}
