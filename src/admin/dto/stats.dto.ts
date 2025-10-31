import { IsOptional, IsDateString } from 'class-validator';

export class GetStatsQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
