import { Controller, Get, Param } from '@nestjs/common';
import { WebsiteService } from './website.service';

@Controller('public/website')
export class PublicWebsiteController {
  constructor(private websiteService: WebsiteService) {}

  @Get(':subdomain')
  async getPublicConfig(@Param('subdomain') subdomain: string) {
    return this.websiteService.getPublicWebsiteConfig(subdomain);
  }
}


