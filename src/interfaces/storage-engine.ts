import {
  GetObjectResult,
  ListObjectsResult,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
} from './types';

/**
 * Contract implemented by storage engines plugged into the service.
 */
export interface StorageEngine {
  /** Store an object and return metadata about the write. */
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  /** Retrieve an object as a readable stream. */
  getObject(key: string): Promise<GetObjectResult>;
  /** Permanently remove an object. */
  deleteObject(key: string): Promise<void>;
  /** Remove every object stored under the provided prefix/directory. */
  deleteDirectory(prefix: string): Promise<void>;
  /** Create a logical copy of an object. */
  copyObject(srcKey: string, destKey: string): Promise<void>;
  /** Move/rename an object within the backend. */
  moveObject(srcKey: string, destKey: string): Promise<void>;
  /** Check whether an object exists. */
  exists(key: string): Promise<boolean>;
  /** Enumerate objects under a prefix with optional pagination. */
  list(
    prefix: string,
    cursor?: string,
    limit?: number,
  ): Promise<ListObjectsResult>;
  /** Generate a signed URL for direct operations. */
  getSignedUrl(opts: SignedUrlOptions): Promise<string>;
  /** Resolve a public URL for the object, when supported. */
  resolvePublicUrl?(key: string): string | undefined;
}
