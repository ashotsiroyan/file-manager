/**
 * Credentials used when the S3 client is instantiated internally.
 */
export interface S3CredentialsOptions {
  /** AWS access key ID with permissions for the target bucket. */
  accessKeyId: string;
  /** AWS secret access key paired with `accessKeyId`. */
  secretAccessKey: string;
  /** Optional session token when using temporary credentials. */
  sessionToken?: string;
}

/**
 * Configuration accepted by `S3StorageEngine`.
 */
export interface S3EngineOptions {
  /** Target S3 bucket name. */
  bucket: string;
  /** AWS region where the bucket resides. */
  region?: string;
  /** Optional base URL used to build public links. */
  baseUrlPublic?: string;
  /** Custom endpoint for S3-compatible services (e.g. MinIO). */
  endpoint?: string;
  /** Force path-style addressing instead of virtual-hosted style. */
  forcePathStyle?: boolean;
  /** Credentials used when `client` is not provided. */
  credentials?: S3CredentialsOptions;
  /** Pre-built S3 client to reuse. */
  client?: any;
  /** Extra config forwarded to the S3 client constructor. */
  clientConfig?: Record<string, any>;
  /** Number of parts to upload concurrently during multipart uploads. */
  uploadQueueSize?: number;
  /** Multipart chunk size in bytes. Must be at least 5 MiB when set. */
  uploadPartSize?: number;
  /** Keep uploaded parts in S3 when a multipart upload fails. */
  leavePartsOnError?: boolean;
}

/**
 * Subset of the AWS SDK modules that can be lazily injected into the engine.
 */
export type AwsSdkModules = {
  S3Client: any;
  Upload: any;
  GetObjectCommand: any;
  PutObjectCommand: any;
  CopyObjectCommand: any;
  DeleteObjectCommand: any;
  DeleteObjectsCommand: any;
  ListObjectsV2Command: any;
  HeadObjectCommand: any;
  getSignedUrl: any;
};
