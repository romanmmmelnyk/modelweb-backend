import { Module } from '@nestjs/common';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicWebsiteController } from './public-website.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WebsiteController, PublicWebsiteController],
  providers: [WebsiteService],
  exports: [WebsiteService],
})
export class WebsiteModule {}

