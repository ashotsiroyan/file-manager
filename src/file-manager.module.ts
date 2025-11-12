import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  FileManagerModuleAsyncOptions,
  FileManagerModuleFactoryResult,
  FileManagerModuleOptions,
  FileManagerServiceOptions,
} from './interfaces';
import {
  FileManagerService,
  getFileManagerServiceToken,
} from './file-manager.service';

const FILE_MANAGER_FACTORY_RESULT = Symbol('FILE_MANAGER_FACTORY_RESULT');

@Module({})
export class FileManagerModule {
  static forRoot(options: FileManagerModuleOptions): DynamicModule {
    const { engine, name, global } = options;
    const serviceDefaults = extractServiceOptions(options);
    const serviceToken = getFileManagerServiceToken(name);

    const serviceProvider: Provider = {
      provide: serviceToken,
      useFactory: () => new FileManagerService(engine, serviceDefaults),
    };

    const providers: Provider[] = [serviceProvider];
    const exports: Array<symbol | Function> = [serviceToken];

    if (!name) {
      providers.push({
        provide: FileManagerService,
        useExisting: serviceToken,
      });
      exports.push(FileManagerService);
    }

    return {
      module: FileManagerModule,
      global: !!global,
      providers,
      exports,
    };
  }

  static forRootAsync(options: FileManagerModuleAsyncOptions): DynamicModule {
    if (!options?.useFactory) {
      throw new Error(
        'FileManagerModule.forRootAsync requires a useFactory function.',
      );
    }

    const serviceToken = getFileManagerServiceToken(options.name);

    const factoryResultProvider: Provider<FileManagerModuleFactoryResult> = {
      provide: FILE_MANAGER_FACTORY_RESULT,
      useFactory: async (...args: any[]) =>
        Promise.resolve(options.useFactory!(...args)),
      inject: options.inject || [],
    };

    const serviceProvider: Provider = {
      provide: serviceToken,
      useFactory: (result: FileManagerModuleFactoryResult) =>
        new FileManagerService(result.engine, extractServiceOptions(result)),
      inject: [FILE_MANAGER_FACTORY_RESULT],
    };

    const providers: Provider[] = [factoryResultProvider, serviceProvider];
    const exports: Array<symbol | Function> = [serviceToken];

    if (!options.name) {
      providers.push({
        provide: FileManagerService,
        useExisting: serviceToken,
      });
      exports.push(FileManagerService);
    }

    return {
      module: FileManagerModule,
      global: !!options.global,
      imports: options.imports,
      providers,
      exports,
    };
  }
}

function extractServiceOptions(
  input: FileManagerModuleOptions | FileManagerModuleFactoryResult,
): FileManagerServiceOptions {
  return {
    defaultPrefix: input.defaultPrefix,
    publicReadByDefault: input.publicReadByDefault,
    maxConcurrentOps: input.maxConcurrentOps,
  };
}
