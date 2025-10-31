import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);
  
  // Pricing constants
  private readonly SETUP_FEE = 60.00;
  private readonly MONTHLY_PRICE = 24.99;
  private readonly ANNUAL_PRICE = 239.88;
  private readonly CUSTOM_DESIGN_FEE = 99.00;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-09-30.clover',
      });
    }
  }

  async getBillingInfo(userId: string) {
    const billing = await this.prisma.billing.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
        application: {
          select: {
            firstName: true,
            lastName: true,
            paymentPlan: true,
          },
        },
      },
    });

    if (!billing) {
      throw new NotFoundException('No billing information found');
    }

    // Calculate amounts based on current pricing
    const setupFee = billing.setupFee || this.SETUP_FEE;
    const customDesignFee = billing.customDesignFee || 0;
    
    let recurringAmount: number;
    let initialAmount: number;
    
    if (billing.billingType === 'monthly') {
      recurringAmount = this.MONTHLY_PRICE;
      initialAmount = setupFee + this.MONTHLY_PRICE + customDesignFee;
    } else if (billing.billingType === 'annual') {
      recurringAmount = this.ANNUAL_PRICE;
      initialAmount = setupFee + this.ANNUAL_PRICE + customDesignFee;
    } else {
      // Legacy: lifetime or old data
      initialAmount = billing.initialAmount || billing.amount;
      recurringAmount = billing.recurringAmount || 0;
    }

    return {
      id: billing.id,
      billingType: billing.billingType,
      initialAmount,
      recurringAmount,
      setupFee,
      customDesignFee,
      currency: billing.currency,
      status: billing.status,
      nextBillingDate: billing.nextBillingDate,
      billingDay: billing.billingDay,
      cancelledAt: billing.cancelledAt,
      createdAt: billing.createdAt,
      customerEmail: billing.user.email,
      accountCreated: billing.user.createdAt,
      paymentPlan: billing.application.paymentPlan,
      customerName: `${billing.application.firstName} ${billing.application.lastName}`,
    };
  }

  async cancelSubscription(userId: string) {
    const billing = await this.prisma.billing.findUnique({
      where: { userId },
    });

    if (!billing) {
      throw new NotFoundException('No billing information found');
    }

    if (billing.status === 'cancelled') {
      throw new Error('Subscription is already cancelled');
    }

    // Cancel subscription in Stripe if subscriptionId exists
    if (billing.stripeSubscriptionId) {
      try {
        this.logger.log(`Cancelling Stripe subscription: ${billing.stripeSubscriptionId}`);
        
        // Cancel at period end so user keeps access until billing period ends
        await this.stripe.subscriptions.update(billing.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        
        this.logger.log(`Successfully cancelled Stripe subscription: ${billing.stripeSubscriptionId}`);
      } catch (error) {
        this.logger.error(`Failed to cancel Stripe subscription: ${error.message}`);
        throw new Error(`Failed to cancel subscription in Stripe: ${error.message}`);
      }
    } else {
      this.logger.warn(`No Stripe subscription ID found for user ${userId}, only updating database`);
    }

    // Update billing status to cancelled but keep nextBillingDate
    // User will have access until the end of their billing period
    const updatedBilling = await this.prisma.billing.update({
      where: { userId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        // Keep nextBillingDate - user retains access until then
      },
    });

    return {
      success: true,
      message: 'Subscription cancelled successfully. You will have access until the end of your billing period.',
      accessUntil: billing.nextBillingDate,
      billing: updatedBilling,
    };
  }

  async reactivateSubscription(userId: string) {
    const billing = await this.prisma.billing.findUnique({
      where: { userId },
    });

    if (!billing) {
      throw new NotFoundException('No billing information found');
    }

    if (billing.status !== 'cancelled') {
      throw new Error('Subscription is not cancelled');
    }

    // Reactivate subscription in Stripe if subscriptionId exists
    if (billing.stripeSubscriptionId) {
      try {
        this.logger.log(`Reactivating Stripe subscription: ${billing.stripeSubscriptionId}`);
        
        // Remove the cancel_at_period_end flag to reactivate
        await this.stripe.subscriptions.update(billing.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
        
        this.logger.log(`Successfully reactivated Stripe subscription: ${billing.stripeSubscriptionId}`);
      } catch (error) {
        this.logger.error(`Failed to reactivate Stripe subscription: ${error.message}`);
        throw new Error(`Failed to reactivate subscription in Stripe: ${error.message}`);
      }
    } else {
      this.logger.warn(`No Stripe subscription ID found for user ${userId}, only updating database`);
    }

    // Reactivate the subscription
    const updatedBilling = await this.prisma.billing.update({
      where: { userId },
      data: {
        status: 'active',
        cancelledAt: null,
      },
    });

    return {
      success: true,
      message: 'Subscription reactivated successfully',
      billing: updatedBilling,
    };
  }

  async getBillingHistory(userId: string) {
    // This would typically fetch from Stripe or a payments history table
    // For now, return the current billing info as history
    const billing = await this.prisma.billing.findUnique({
      where: { userId },
    });

    if (!billing) {
      return [];
    }

    const history: Array<{
      id: string;
      date: Date | null;
      amount: number;
      currency: string;
      status: string;
      description: string;
    }> = [];
    
    const setupFee = billing.setupFee || this.SETUP_FEE;
    const customDesignFee = billing.customDesignFee || 0;
    
    let recurringAmount: number;
    let initialAmount: number;
    
    if (billing.billingType === 'monthly') {
      recurringAmount = this.MONTHLY_PRICE;
      initialAmount = setupFee + this.MONTHLY_PRICE + customDesignFee;
    } else if (billing.billingType === 'annual') {
      recurringAmount = this.ANNUAL_PRICE;
      initialAmount = setupFee + this.ANNUAL_PRICE + customDesignFee;
    } else {
      // Legacy data
      initialAmount = billing.initialAmount || billing.amount;
      recurringAmount = billing.recurringAmount || 0;
    }
    
    // Add initial payment breakdown
    history.push({
      id: billing.id,
      date: billing.createdAt,
      amount: initialAmount,
      currency: billing.currency,
      status: 'paid',
      description: `Initial Payment (Setup: £${setupFee.toFixed(2)}, ${billing.billingType === 'monthly' ? 'Monthly' : 'Annual'}: £${recurringAmount.toFixed(2)}${customDesignFee > 0 ? `, Design: £${customDesignFee.toFixed(2)}` : ''})`,
    });

    // For subscriptions, show recurring payment info
    if (recurringAmount > 0) {
      history.push({
        id: `${billing.id}-recurring`,
        date: null,
        amount: recurringAmount,
        currency: billing.currency,
        status: 'upcoming',
        description: billing.billingType === 'monthly' 
          ? 'Monthly Recurring Payment (£24.99/month)' 
          : 'Annual Recurring Payment (£239.88/year = £19.99/month)',
      });
    }

    return history;
  }

  async getSubscriptionStatus(userId: string) {
    const billing = await this.prisma.billing.findUnique({
      where: { userId },
    });

    if (!billing) {
      return {
        hasSubscription: false,
        status: 'none',
      };
    }

    // Check if cancelled subscription still has access
    const hasAccess = billing.status === 'active' || 
      (billing.status === 'cancelled' && billing.nextBillingDate && new Date(billing.nextBillingDate) > new Date());

    return {
      hasSubscription: true,
      status: billing.status,
      type: billing.billingType,
      isActive: billing.status === 'active',
      isCancelled: billing.status === 'cancelled',
      hasAccess,
      accessUntil: billing.status === 'cancelled' ? billing.nextBillingDate : null,
      canCancel: (billing.billingType === 'monthly' || billing.billingType === 'annual') && billing.status === 'active',
      canReactivate: (billing.billingType === 'monthly' || billing.billingType === 'annual') && billing.status === 'cancelled',
    };
  }

  /**
   * Calculate pricing for new subscription
   */
  calculatePricing(billingType: 'monthly' | 'annual', includeCustomDesign: boolean = false) {
    const setupFee = this.SETUP_FEE;
    const customDesignFee = includeCustomDesign ? this.CUSTOM_DESIGN_FEE : 0;
    
    let recurringAmount: number;
    let initialAmount: number;
    
    if (billingType === 'monthly') {
      recurringAmount = this.MONTHLY_PRICE;
      initialAmount = setupFee + this.MONTHLY_PRICE + customDesignFee;
    } else {
      recurringAmount = this.ANNUAL_PRICE;
      initialAmount = setupFee + this.ANNUAL_PRICE + customDesignFee;
    }
    
    return {
      setupFee,
      customDesignFee,
      recurringAmount,
      initialAmount,
      breakdown: {
        setup: setupFee,
        subscription: recurringAmount,
        design: customDesignFee,
        total: initialAmount,
      },
    };
  }
}



