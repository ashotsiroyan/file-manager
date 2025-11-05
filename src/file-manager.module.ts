import { DynamicModule, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { FileManagerService, FILE_MANAGER_ENGINE, FILE_MANAGER_OPTIONS, FileManagerModuleOptions } from './file-manager.service';
import { StorageEngine } from './interfaces/storage-engine';

export interface FileManagerModuleFactoryResult {
  engine: StorageEngine;
  options?: FileManagerModuleOptions;
}

export interface FileManagerModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<FileManagerModuleFactoryResult> | FileManagerModuleFactoryResult;
}

const FILE_MANAGER_FACTORY_RESULT = Symbol('FILE_MANAGER_FACTORY_RESULT');

@Module({})
export class FileManagerModule {
  static forRoot(engine: StorageEngine, options?: FileManagerModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: FILE_MANAGER_ENGINE, useValue: engine },
      { provide: FILE_MANAGER_OPTIONS, useValue: options || {} },
      FileManagerService,
    ];
    return {
      module: FileManagerModule,
      providers,
      exports: [FileManagerService],
    };
  }

  static forRootAsync(
    options:
      | FileManagerModuleAsyncOptions
      | (() => Promise<FileManagerModuleFactoryResult> | FileManagerModuleFactoryResult),
  ): DynamicModule {
    const asyncOptions: FileManagerModuleAsyncOptions =
      typeof options === 'function' ? { useFactory: options } : options;

    if (!asyncOptions?.useFactory) {
      throw new Error('FileManagerModule.forRootAsync requires a useFactory function.');
    }

    const factoryResultProvider: Provider = {
      provide: FILE_MANAGER_FACTORY_RESULT,
      useFactory: async (...args: any[]) =>
        await Promise.resolve(asyncOptions.useFactory(...args)),
      inject: asyncOptions.inject || [],
    };

    const engineProvider: Provider = {
      provide: FILE_MANAGER_ENGINE,
      useFactory: (result: FileManagerModuleFactoryResult) => result.engine,
      inject: [FILE_MANAGER_FACTORY_RESULT],
    };

    const optionsProvider: Provider = {
      provide: FILE_MANAGER_OPTIONS,
      useFactory: (result: FileManagerModuleFactoryResult) => result.options || {},
      inject: [FILE_MANAGER_FACTORY_RESULT],
    };

    return {
      module: FileManagerModule,
      imports: asyncOptions.imports,
      providers: [factoryResultProvider, engineProvider, optionsProvider, FileManagerService],
      exports: [FileManagerService],
    };
  }
}
