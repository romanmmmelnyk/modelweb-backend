import { Module } from '@nestjs/common';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Module({
  controllers: [ApplicationController],
  providers: [ApplicationService, PrismaService, EmailService],
  exports: [ApplicationService],
})
export class ApplicationModule {}
