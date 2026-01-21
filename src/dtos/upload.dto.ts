import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  prefix?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  originalName?: string;

  @IsOptional()
  @IsString()
  action?: 'put' | 'get';
}
