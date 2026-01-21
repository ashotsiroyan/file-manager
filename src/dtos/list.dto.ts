import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListQueryDto {
  @IsString()
  @IsOptional()
  prefix?: string;

  @IsString()
  @IsOptional()
  cursor?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number = 100;
}
