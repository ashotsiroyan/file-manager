/**
 * Configuration accepted by `GcsStorageEngine`.
 */
export interface GcsEngineOptions {
  /** Target Google Cloud Storage bucket to read from and write to. */
  bucket: string;
  /** Optional base URL used to construct public links. */
  baseUrlPublic?: string;
  /** GCP project identifier used when creating the storage client. */
  projectId?: string;
  /** Authentication material, passed through to the underlying SDK. */
  auth?: GcsAuthOptions;
  /** Pre-instantiated `Storage` instance to reuse instead of creating one. */
  storage?: any;
  /** Extra options forwarded to the `Storage` constructor. */
  storageOptions?: Record<string, any>;
}

/**
 * Supported Google Cloud credential inputs for the storage engine.
 */
export interface GcsAuthOptions {
  /** Path to a service-account key file. */
  keyFilename?: string;
  /** Raw or base64-encoded service-account JSON payload. */
  keyFileJson?: string;
  /** Service-account client email (used with `privateKey`). */
  clientEmail?: string;
  /** PEM-formatted private key (paired with `clientEmail`). */
  privateKey?: string;
  /** Direct credentials object compatible with the SDK. */
  credentials?: { client_email: string; private_key: string };
}

/**
 * Shape of the lazy-loaded Google Cloud Storage SDK module.
 */
export type GcsSdkModule = { Storage: any };
