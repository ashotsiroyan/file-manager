import { ModuleMetadata } from '@nestjs/common';
import { StorageEngine } from './storage-engine';

/**
 * Synchronous registration options for `FileManagerModule.forRoot`.
 * Extends the factory result with the ability to mark the module as global.
 */
export interface FileManagerModuleOptions
  extends FileManagerModuleFactoryResult {
  /** Register the module globally across the Nest application. */
  global?: boolean;
}

/**
 * Asynchronous registration options for `FileManagerModule.forRootAsync`.
 */
export interface FileManagerModuleAsyncOptions {
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
 * Result expected from both sync and async factories configuring the module.
 */
export interface FileManagerModuleFactoryResult {
  /** Storage backend implementation used by the service. */
  engine: StorageEngine;
  /** Prefix used when generating keys without an explicit prefix. */
  defaultPrefix?: string;
  /** Default ACL flag applied to uploads when `aclPublic` is omitted. */
  publicReadByDefault?: boolean;
}

/**
 * Optional service-level defaults injected into `FileManagerService`.
 */
export interface FileManagerServiceOptions {
  /** Prefix used when generating keys without an explicit prefix. */
  defaultPrefix?: string;
  /** Default ACL flag applied to uploads when `aclPublic` is omitted. */
  publicReadByDefault?: boolean;
}
