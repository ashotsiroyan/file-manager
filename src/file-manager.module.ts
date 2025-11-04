import { DynamicModule, Module, Provider } from '@nestjs/common';
import { FileManagerService, FILE_MANAGER_ENGINE, FILE_MANAGER_OPTIONS, FileManagerModuleOptions } from './file-manager.service';
import { StorageEngine } from './interfaces/storage-engine';

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

  static forRootAsync(factory: () => Promise<{ engine: StorageEngine; options?: FileManagerModuleOptions }> | { engine: StorageEngine; options?: FileManagerModuleOptions }): DynamicModule {
    const provider: Provider = {
      provide: FILE_MANAGER_ENGINE,
      useFactory: async () => {
        const out = await Promise.resolve(factory());
        return out.engine;
      },
    };
    const optionsProvider: Provider = {
      provide: FILE_MANAGER_OPTIONS,
      useFactory: async () => {
        const out = await Promise.resolve(factory());
        return out.options || {};
      },
    };
    return {
      module: FileManagerModule,
      providers: [provider, optionsProvider, FileManagerService],
      exports: [FileManagerService],
    };
  }
}
