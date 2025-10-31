import { IsArray, IsString, IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class BulkUpdateUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

export enum BulkAction {
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  DELETE = 'delete',
}

export class BulkActionDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsEnum(BulkAction)
  action: BulkAction;
}
