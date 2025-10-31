import {
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get()
  async getBillingInfo(@Request() req) {
    return this.billingService.getBillingInfo(req.user.id);
  }

  @Get('status')
  async getSubscriptionStatus(@Request() req) {
    return this.billingService.getSubscriptionStatus(req.user.id);
  }

  @Get('history')
  async getBillingHistory(@Request() req) {
    return this.billingService.getBillingHistory(req.user.id);
  }

  @Post('cancel')
  @HttpCode(200)
  async cancelSubscription(@Request() req) {
    return this.billingService.cancelSubscription(req.user.id);
  }

  @Post('reactivate')
  @HttpCode(200)
  async reactivateSubscription(@Request() req) {
    return this.billingService.reactivateSubscription(req.user.id);
  }
}

