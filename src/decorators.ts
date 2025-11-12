import { getFileManagerServiceToken } from './file-manager.service';
import { Inject } from '@nestjs/common';

export function InjectFileManager(name?: string): ParameterDecorator {
  const token = getFileManagerServiceToken(name);
  return Inject(token);
}
