export interface GcsEngineOptions {
  bucket: string;
  baseUrlPublic?: string;
  projectId?: string;
  auth?: GcsAuthOptions;
  storage?: any;
  storageOptions?: Record<string, any>;
}

export interface GcsAuthOptions {
  keyFilename?: string;
  keyFileJson?: string;
  clientEmail?: string;
  privateKey?: string;
  credentials?: { client_email: string; private_key: string };
}

export type GcsSdkModule = { Storage: any };