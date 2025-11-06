import { ModuleMetadata } from '@nestjs/common';
import { StorageEngine } from './storage-engine';

export interface FileManagerModuleOptions extends FileManagerModuleFactoryResult {
  global?: boolean;
}

export interface FileManagerModuleAsyncOptions {
  global?: boolean;
  imports?: ModuleMetadata['imports'];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<FileManagerModuleFactoryResult> | FileManagerModuleFactoryResult;
}

export interface FileManagerModuleFactoryResult {
  engine: StorageEngine;
  defaultPrefix?: string;
  publicReadByDefault?: boolean;
}

export interface FileManagerServiceOptions {
  defaultPrefix?: string;
  publicReadByDefault?: boolean;
}