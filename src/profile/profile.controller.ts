import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';
import type { CreateProfileDto, UpdateProfileDto, CreateSocialDto, UpdateSocialDto, CreateMeasurementDto, UpdateMeasurementDto } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  // Profile Management
  @Get()
  async getProfile(@Request() req) {
    return this.profileService.getProfile(req.user.id);
  }

  @Post()
  @HttpCode(201)
  async createProfile(@Request() req, @Body() createProfileDto: CreateProfileDto) {
    return this.profileService.createProfile(req.user.id, createProfileDto);
  }

  @Put()
  @HttpCode(200)
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.id, updateProfileDto);
  }

  // Social Media Management
  @Get('socials')
  async getSocials(@Request() req) {
    return this.profileService.getSocials(req.user.id);
  }

  @Post('socials')
  @HttpCode(201)
  async addSocial(@Request() req, @Body() createSocialDto: CreateSocialDto) {
    return this.profileService.addSocial(req.user.id, createSocialDto);
  }

  @Put('socials/:socialId')
  @HttpCode(200)
  async updateSocial(
    @Request() req,
    @Param('socialId') socialId: string,
    @Body() updateSocialDto: UpdateSocialDto
  ) {
    return this.profileService.updateSocial(req.user.id, socialId, updateSocialDto);
  }

  @Delete('socials/:socialId')
  @HttpCode(200)
  async deleteSocial(@Request() req, @Param('socialId') socialId: string) {
    return this.profileService.deleteSocial(req.user.id, socialId);
  }

  // Measurements Management
  @Get('measurements')
  async getMeasurements(@Request() req) {
    return this.profileService.getMeasurements(req.user.id);
  }

  @Get('measurements/latest')
  async getLatestMeasurements(@Request() req) {
    return this.profileService.getLatestMeasurements(req.user.id);
  }

  @Post('measurements')
  @HttpCode(201)
  async addMeasurement(@Request() req, @Body() createMeasurementDto: CreateMeasurementDto) {
    return this.profileService.addMeasurement(req.user.id, createMeasurementDto);
  }

  @Put('measurements/:measurementId')
  @HttpCode(200)
  async updateMeasurement(
    @Request() req,
    @Param('measurementId') measurementId: string,
    @Body() updateMeasurementDto: UpdateMeasurementDto
  ) {
    return this.profileService.updateMeasurement(req.user.id, measurementId, updateMeasurementDto);
  }

  @Delete('measurements/:measurementId')
  @HttpCode(200)
  async deleteMeasurement(@Request() req, @Param('measurementId') measurementId: string) {
    return this.profileService.deleteMeasurement(req.user.id, measurementId);
  }

  // Configuration endpoints
  @Get('config/measurement-types')
  async getAvailableMeasurementTypes() {
    return this.profileService.getAvailableMeasurementTypes();
  }

  @Get('config/social-platforms')
  async getAvailableSocialPlatforms() {
    return this.profileService.getAvailableSocialPlatforms();
  }
}