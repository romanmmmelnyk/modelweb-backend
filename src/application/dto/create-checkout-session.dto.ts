import { IsEmail, IsString, IsOptional, IsArray, IsBoolean, IsEnum } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  about?: string;

  @IsArray()
  @IsString({ each: true })
  purposes: string[];

  @IsBoolean()
  customDesign: boolean;

  @IsEnum(['monthly', 'annual'])
  paymentPlan: 'monthly' | 'annual';
}
