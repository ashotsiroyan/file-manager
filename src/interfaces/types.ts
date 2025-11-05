export type PutAction = 'put';
export type GetAction = 'get';

export type SignedAction = PutAction | GetAction;

export interface SignedUrlOptions {
  key: string;
  action: SignedAction;
  expiresInSeconds?: number;
  contentType?: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | NodeJS.ReadableStream | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
  aclPublic?: boolean;
}

export interface PutObjectResult {
  key: string;
  etag?: string;
  size?: number;
  checksum?: string;
  url?: string;
}

export interface GetObjectResult {
  stream: NodeJS.ReadableStream;
  contentType?: string;
  size?: number;
  metadata?: Record<string, string>;
  lastModified?: Date;
}

export interface ListObjectsResult {
  keys: string[];
  nextCursor?: string;
}
