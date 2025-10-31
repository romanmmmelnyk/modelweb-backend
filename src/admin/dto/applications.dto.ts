import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetApplicationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: string; // 'pending', 'completed', 'failed', 'cancelled'

  @IsOptional()
  @IsBoolean()
  processed?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateApplicationStatusDto {
  @IsString()
  status: string; // 'pending', 'completed', 'failed', 'cancelled'

  @IsOptional()
  @IsString()
  notes?: string;
}
