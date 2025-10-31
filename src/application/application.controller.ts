import { Controller, Post, Body, HttpCode, Get, Param, Headers, Req, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationService } from './application.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Controller('applications')
export class ApplicationController {
  constructor(private applicationService: ApplicationService) {}

  @Post('checkout')
  @HttpCode(200)
  async createCheckoutSession(@Body() createDto: CreateCheckoutSessionDto) {
    return this.applicationService.createCheckoutSession(createDto);
  }

  @Get('verify/:sessionId')
  async verifyPayment(@Param('sessionId') sessionId: string) {
    try {
      const result = await this.applicationService.verifyPayment(sessionId);
      
      // Extract email from different result types
      const email = result.application?.email || result.credentials?.email || '';
      
      return {
        success: result.verified,
        status: result.verified ? 'completed' : 'failed',
        message: result.message || 'Payment verified successfully',
        email,
        verified: result.verified,
        willRefund: false,
        retryable: !result.verified,
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        message: error.message || 'Failed to verify payment',
        errorCode: error.code || 'VERIFICATION_ERROR',
        retryable: true,
        willRefund: false,
        contactSupport: true,
      };
    }
  }

  /**
   * Stripe Webhook Handler
   * This endpoint receives real-time payment events from Stripe
   * IMPORTANT: This is the most reliable way to process payments
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // The raw body is needed for webhook signature verification
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    return this.applicationService.handleStripeWebhook(signature, rawBody);
  }
}
