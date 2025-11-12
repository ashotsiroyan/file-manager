import { ModuleMetadata } from '@nestjs/common';
import { StorageEngine } from './storage-engine';

/**
 * Shared configuration returned by sync/async factories.
 */
export interface FileManagerModuleFactoryResult
  extends FileManagerServiceOptions {
  /** Storage backend implementation used by the service. */
  engine: StorageEngine;
}

/**
 * Synchronous registration options for `FileManagerModule.forRoot`.
 */
export interface FileManagerModuleOptions
  extends FileManagerModuleFactoryResult {
  /** Unique storage identifier when registering multiple instances. */
  name?: string;
  /** Register the module globally across the Nest application. */
  global?: boolean;
}

/**
 * Asynchronous registration options for `FileManagerModule.forRootAsync`.
 */
export interface FileManagerModuleAsyncOptions {
  /** Unique storage identifier when registering multiple instances. */
  name?: string;
  /** Register the module globally across the Nest application. */
  global?: boolean;
  /** Modules to import when resolving the async factory. */
  imports?: ModuleMetadata['imports'];
  /** Providers to inject into the async factory. */
  inject?: any[];
  /** Factory returning the engine and defaults. */
  useFactory: (
    ...args: any[]
  ) => Promise<FileManagerModuleFactoryResult> | FileManagerModuleFactoryResult;
}

/**
 * Optional service-level defaults injected into `FileManagerService`.
 */
export interface FileManagerServiceOptions {
  /** Prefix used when generating keys without an explicit prefix. */
  defaultPrefix?: string;
  /** Default ACL flag applied to uploads when `aclPublic` is omitted. */
  publicReadByDefault?: boolean;
  /** Max number of concurrent storage operations allowed. */
  maxConcurrentOps?: number;
}
