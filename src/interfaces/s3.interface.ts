export interface S3CredentialsOptions {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface S3EngineOptions {
  bucket: string;
  region?: string;
  baseUrlPublic?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: S3CredentialsOptions;
  client?: any;
  clientConfig?: Record<string, any>;
}

export type AwsSdkModules = {
  S3Client: any;
  GetObjectCommand: any;
  PutObjectCommand: any;
  CopyObjectCommand: any;
  DeleteObjectCommand: any;
  ListObjectsV2Command: any;
  getSignedUrl: any;
};