import { DynamicModule, Module, Provider } from '@nestjs/common';
import { FILE_MANAGER_ENGINE, FILE_MANAGER_OPTIONS, FileManagerService } from './file-manager.service';
import {
  FileManagerModuleAsyncOptions,
  FileManagerModuleFactoryResult, FileManagerModuleOptions
} from './interfaces/file-manager-module.interface';

const FILE_MANAGER_FACTORY_RESULT = Symbol('FILE_MANAGER_FACTORY_RESULT');

@Module({})
export class FileManagerModule {
  static forRoot(options: FileManagerModuleOptions): DynamicModule {
    const { engine, ...rest } = options;
    const providers: Provider[] = [
      { provide: FILE_MANAGER_ENGINE, useValue: engine },
      { provide: FILE_MANAGER_OPTIONS, useValue: rest || {} },
      FileManagerService,
    ];
    return {
      global: !!options.global,
      module: FileManagerModule,
      providers,
      exports: [FileManagerService],
    };
  }
  
  static forRootAsync(
    options: FileManagerModuleAsyncOptions
  ): DynamicModule {
    if (!options?.useFactory) {
      throw new Error('FileManagerModule.forRootAsync requires a useFactory function.');
    }
    
    const factoryResultProvider: Provider<FileManagerModuleFactoryResult> = {
      provide: FILE_MANAGER_FACTORY_RESULT,
      useFactory: async (...args: any[]) => Promise.resolve(options.useFactory!(...args)),
      inject: options.inject || [],
    };
    
    const engineProvider: Provider = {
      provide: FILE_MANAGER_ENGINE,
      useFactory: (result: FileManagerModuleFactoryResult) => result.engine,
      inject: [FILE_MANAGER_FACTORY_RESULT],
    };
    
    const optionsProvider: Provider = {
      provide: FILE_MANAGER_OPTIONS,
      useFactory: (result: FileManagerModuleFactoryResult) => {
        const { engine, ...rest } = result;
        return rest;
      },
      inject: [FILE_MANAGER_FACTORY_RESULT],
    };
    
    return {
      global: !!options.global,
      module: FileManagerModule,
      imports: options.imports,
      providers: [factoryResultProvider, engineProvider, optionsProvider, FileManagerService],
      exports: [FileManagerService],
    };
  }
}
