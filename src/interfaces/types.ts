export type PutAction = 'put';
export type GetAction = 'get';

export type SignedAction = PutAction | GetAction;

/**
 * Configuration for generating a signed URL from a storage engine.
 * Supports both upload (`put`) and download (`get`) flows.
 */
export interface SignedUrlOptions {
  /** Object key within the storage backend. */
  key: string;
  /** Action the signed URL will authorize (`put` or `get`). */
  action: SignedAction;
  /** Expiration in seconds from now; falls back to engine defaults. */
  expiresInSeconds?: number;
  /** MIME type enforced for signed uploads. */
  contentType?: string;
}

/**
 * Payload accepted by storage engines to persist a single object.
 */
export interface PutObjectInput {
  /** Object key (path) within the storage backend. */
  key: string;
  /** Data to store, supplied as a buffer or readable stream. */
  body: Buffer | NodeJS.ReadableStream | Uint8Array;
  /** Explicit MIME type stored alongside the object. */
  contentType?: string;
  /** Optional metadata forwarded to the backend. */
  metadata?: Record<string, string>;
  /** Force public ACL regardless of service default. */
  aclPublic?: boolean;
}

/**
 * Result returned after successfully storing an object.
 */
export interface PutObjectResult {
  /** Object key that was persisted. */
  key: string;
  /** Entity tag supplied by the backend, when available. */
  etag?: string;
  /** Number of bytes stored. */
  size?: number;
  /** Checksum returned by the backend, if supported. */
  checksum?: string;
  /** Publicly accessible URL, when supported. */
  url?: string;
}

/**
 * Object fetched from a storage backend including stream and metadata.
 */
export interface GetObjectResult {
  /** Readable stream for the object contents. */
  stream: NodeJS.ReadableStream;
  /** Resolved MIME type of the stored object. */
  contentType?: string;
  /** Total size of the payload in bytes. */
  size?: number;
  /** Arbitrary metadata persisted with the object. */
  metadata?: Record<string, string>;
  /** Last modification time reported by the backend. */
  lastModified?: Date;
}

/**
 * Listing response for paginated object enumeration.
 */
export interface ListObjectsResult {
  /** Object keys included in the current page. */
  keys: string[];
  /** Cursor to continue listing, if more objects remain. */
  nextCursor?: string;
}
