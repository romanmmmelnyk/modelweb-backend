import { Controller, Get, Post, Put, Delete, Body, Request, Query, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebsiteService } from './website.service';
import type { CreateWebsiteDto } from './website.service';

@Controller('website')
@UseGuards(JwtAuthGuard)
export class WebsiteController {
  constructor(private websiteService: WebsiteService) {}

  @Get()
  async getWebsite(@Request() req) {
    return this.websiteService.getWebsite(req.user.id);
  }

  @Post()
  @HttpCode(200)
  async createOrUpdateWebsite(@Request() req, @Body() dto: CreateWebsiteDto) {
    return this.websiteService.createOrUpdateWebsite(req.user.id, dto);
  }

  @Post('submit')
  @HttpCode(200)
  async submitWebsiteRequest(@Request() req) {
    return this.websiteService.submitWebsiteRequest(req.user.id);
  }

  @Post('withdraw')
  @HttpCode(200)
  async withdrawWebsiteRequest(@Request() req) {
    return this.websiteService.withdrawWebsiteRequest(req.user.id);
  }

  @Get('check-subdomain')
  async checkSubdomainAvailability(
    @Request() req,
    @Query('subdomain') subdomain: string,
  ) {
    return this.websiteService.checkSubdomainAvailability(subdomain, req.user.id);
  }

  @Delete()
  @HttpCode(200)
  async deleteWebsite(@Request() req) {
    return this.websiteService.deleteWebsite(req.user.id);
  }

  @Get('templates')
  async getTemplates() {
    return this.websiteService.getTemplates();
  }

  @Get('gallery-images')
  async getUserGalleryImages(@Request() req) {
    return this.websiteService.getUserGalleryImages(req.user.id);
  }
}

