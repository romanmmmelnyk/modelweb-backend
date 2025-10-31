import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import Stripe from 'stripe';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class ApplicationService {
  private stripe: Stripe;
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-09-30.clover',
      });
    }
  }

  /**
   * Generates a secure random password
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Gets or creates the default tenant
   * @param tx Optional transaction client (required when called within a transaction)
   */
  private async getDefaultTenant(tx?: any) {
    const prismaClient = tx || this.prisma;
    
    let tenant = await prismaClient.tenant.findFirst();
    
    if (!tenant) {
      tenant = await prismaClient.tenant.create({
        data: {
          name: 'Default Tenant',
          description: 'Default tenant for new users',
        },
      });
    }

    return tenant;
  }

  /**
   * Calculates next billing date for subscriptions
   */
  private calculateNextBillingDate(billingDay: number, isAnnual: boolean = false): Date {
    const now = new Date();
    
    if (isAnnual) {
      // For annual: add 1 year
      return new Date(now.getFullYear() + 1, now.getMonth(), billingDay);
    } else {
      // For monthly: add 1 month
      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
      
      // If the billing day doesn't exist in the next month (e.g., 31st of February),
      // use the last day of the month
      if (nextDate.getDate() !== billingDay) {
        nextDate.setDate(0); // Go to last day of previous month
      }
      
      return nextDate;
    }
  }

  async createCheckoutSession(createDto: CreateCheckoutSessionDto) {
    // Save application to database
    const application = await this.prisma.application.create({
      data: {
        email: createDto.email,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        about: createDto.about,
        purposes: JSON.stringify(createDto.purposes),
        customDesign: createDto.customDesign,
        paymentPlan: createDto.paymentPlan,
        status: 'pending',
      },
    });

    // Calculate pricing based on plan and custom design
    // New Pricing: Setup £60, Monthly £24.99, Annual £239.88, Custom Design +£99
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    
    // Setup fee (one-time, always included)
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'Website Setup Fee',
          description: 'One-time setup fee',
        },
        unit_amount: 6000, // £60 in pence
      },
      quantity: 1,
    });

    // Custom design fee (one-time, if selected)
    if (createDto.customDesign) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Custom Design Service',
            description: 'Professional custom design for your website',
          },
          unit_amount: 9900, // £99 in pence
        },
        quantity: 1,
      });
    }

    // Subscription (monthly or annual)
    if (createDto.paymentPlan === 'monthly') {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Monthly Subscription',
            description: `Website with: ${createDto.purposes.join(', ')}`,
          },
          unit_amount: 2499, // £24.99 in pence
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      });
    } else {
      // Annual subscription
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Annual Subscription',
            description: `Website with: ${createDto.purposes.join(', ')} (Save 20% - £19.99/month)`,
          },
          unit_amount: 23988, // £239.88 in pence
          recurring: {
            interval: 'year',
          },
        },
        quantity: 1,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/cancel`,
      client_reference_id: application.id,
      customer_email: createDto.email,
      metadata: {
        applicationId: application.id,
        purposes: JSON.stringify(createDto.purposes),
        customDesign: createDto.customDesign.toString(),
      },
    });

    // Update application with Stripe session ID
    await this.prisma.application.update({
      where: { id: application.id },
      data: { stripeSessionId: session.id },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * CRITICAL: Processes the payment and creates user account
   * This function uses database transactions to ensure atomicity
   * If any step fails, everything rolls back to prevent inconsistent state
   */
  async processPaymentAndCreateUser(sessionId: string, stripeSession: Stripe.Checkout.Session) {
    this.logger.log(`Starting user creation process for session: ${sessionId}`);
    
    try {
      // Generate temporary password and hash it OUTSIDE transaction
      // bcrypt is slow by design (security) and shouldn't be in a transaction
      const tempPassword = this.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Use Prisma transaction to ensure all-or-nothing operation
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Find the application
        const application = await tx.application.findFirst({
          where: { stripeSessionId: sessionId },
        });

        if (!application) {
          throw new Error('Application not found');
        }

        // 2. Check if already processed (idempotency check)
        if (application.processed) {
          this.logger.warn(`Application ${application.id} already processed`);
          return {
            success: true,
            alreadyProcessed: true,
            userId: application.userId,
            tempPassword: null, // Don't return password for already processed
          };
        }

        // 3. Check if user with email already exists
        const existingUser = await tx.user.findUnique({
          where: { email: application.email },
        });

        if (existingUser) {
          this.logger.warn(`User with email ${application.email} already exists`);
          // Link existing user to application
          await tx.application.update({
            where: { id: application.id },
            data: {
              userId: existingUser.id,
              processed: true,
              processedAt: new Date(),
              status: 'completed',
            },
          });
          return {
            success: true,
            userExists: true,
            userId: existingUser.id,
            tempPassword: null, // Don't return password for existing users
          };
        }

        // 4. Get default tenant (pass transaction client to avoid SQLite lock)
        const tenant = await this.getDefaultTenant(tx);

        // 5. Create user account (using pre-hashed password from outside transaction)
        const user = await tx.user.create({
          data: {
            email: application.email,
            password: hashedPassword,
            provider: 'email',
            tenantId: tenant.id,
          },
        });

        this.logger.log(`User created successfully: ${user.id}`);

        // 6. Create user profile
        await tx.profile.create({
          data: {
            userId: user.id,
            firstName: application.firstName,
            lastName: application.lastName,
            bio: application.about,
          },
        });

        this.logger.log(`Profile created for user: ${user.id}`);

        // 7. Extract billing information from Stripe session
        // Customer and subscription can be either string IDs or expanded objects
        const stripeCustomerId = typeof stripeSession.customer === 'string' 
          ? stripeSession.customer 
          : (stripeSession.customer as any)?.id;
        
        const subscription = stripeSession.subscription;
        const stripeSubscriptionId = typeof subscription === 'string'
          ? subscription
          : (subscription as any)?.id || null;
        
        const isAnnual = application.paymentPlan === 'annual';

        // Calculate billing day and next billing date for subscriptions
        const now = new Date();
        const billingDay = now.getDate();
        const nextBillingDate = this.calculateNextBillingDate(billingDay, isAnnual);

        // Calculate amounts
        const amountInPence = stripeSession.amount_total || 0;
        const totalAmount = amountInPence / 100; // Convert to pounds (includes setup + first period)
        
        // Pricing breakdown
        const setupFee = 60.00;
        const customDesignFee = application.customDesign ? 99.00 : 0;
        const recurringAmount = isAnnual ? 239.88 : 24.99;
        const initialAmount = setupFee + recurringAmount + customDesignFee;

        // 8. Create billing record
        await tx.billing.create({
          data: {
            userId: user.id,
            applicationId: application.id,
            stripeCustomerId: stripeCustomerId,
            stripeSubscriptionId: stripeSubscriptionId,
            billingType: application.paymentPlan,
            billingDay: billingDay,
            nextBillingDate: nextBillingDate,
            amount: totalAmount, // Legacy field
            initialAmount: initialAmount,
            recurringAmount: recurringAmount,
            setupFee: setupFee,
            customDesignFee: customDesignFee > 0 ? customDesignFee : null,
            currency: 'gbp',
            status: 'active',
          },
        });

        this.logger.log(`Billing created for user: ${user.id}`);

        // 9. Update application with user link and mark as processed
        await tx.application.update({
          where: { id: application.id },
          data: {
            userId: user.id,
            processed: true,
            processedAt: new Date(),
            status: 'completed',
            tempPassword: hashedPassword, // Store hashed temp password
          },
        });

        this.logger.log(`Application marked as processed: ${application.id}`);

        return {
          success: true,
          userId: user.id,
          email: user.email,
          tempPassword: tempPassword, // Return plain password for display
          firstName: application.firstName,
          lastName: application.lastName,
        };
      }, {
        timeout: 10000, // Increase timeout to 10 seconds for safety
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to process payment and create user: ${error.message}`, error.stack);
      throw new Error(`Failed to process payment: ${error.message}`);
    }
  }

  async verifyPayment(sessionId: string) {
    try {
      // Retrieve the checkout session from Stripe
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'subscription', 'customer'],
      });

      // Check if payment was successful
      const isPaid = session.payment_status === 'paid';

      if (!isPaid) {
        return {
          verified: false,
          message: 'Payment not completed',
        };
      }

      // Find the application
      const application = await this.prisma.application.findFirst({
        where: { stripeSessionId: sessionId },
      });

      if (!application) {
        return {
          verified: true,
          message: 'Payment verified but application not found',
        };
      }

      // If already processed, return existing data
      if (application.processed) {
        this.logger.log(`Application ${application.id} already processed, returning existing data`);
        return {
          verified: true,
          alreadyProcessed: true,
          application: {
            id: application.id,
            email: application.email,
            firstName: application.firstName,
            lastName: application.lastName,
            paymentPlan: application.paymentPlan,
            customDesign: application.customDesign,
            userId: application.userId,
          },
        };
      }

      // Process payment and create user account
      this.logger.log(`Processing payment and creating user for application: ${application.id}`);
      const userCreationResult = await this.processPaymentAndCreateUser(sessionId, session);

      return {
        verified: true,
        userCreated: true,
        application: {
          id: application.id,
          email: application.email,
          firstName: application.firstName,
          lastName: application.lastName,
          paymentPlan: application.paymentPlan,
          customDesign: application.customDesign,
          userId: userCreationResult.userId,
        },
        credentials: userCreationResult.userExists ? null : {
          email: userCreationResult.email,
          tempPassword: userCreationResult.tempPassword,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to verify payment: ${error.message}`, error.stack);
      throw new Error(`Failed to verify payment: ${error.message}`);
    }
  }

  /**
   * Webhook handler for Stripe events
   * This is the MOST RELIABLE way to process payments
   * Webhooks are sent by Stripe even if the user closes the browser
   */
  async handleStripeWebhook(signature: string, rawBody: Buffer) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      throw new Error('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Received webhook event: ${event.type}`);

    try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true, eventType: event.type };
    } catch (error) {
      this.logger.error(`Error handling webhook event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle successful checkout session
   * This is where we create the user account
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    this.logger.log(`Checkout session completed: ${session.id}`);

    try {
      // Process payment and create user
      const result = await this.processPaymentAndCreateUser(session.id, session);
      
      if (result.success && !result.alreadyProcessed && !result.userExists && result.tempPassword) {
        this.logger.log(`✅ User created via webhook: ${result.userId}`);
        
        // Get billing information for receipt
        const application = await this.prisma.application.findFirst({
          where: { stripeSessionId: session.id },
          include: { billing: true },
        });
        
        // Send both emails: 1) Payment Receipt, 2) Welcome with Credentials
        try {
          // 1. Send Payment Receipt Email
          if (application?.billing) {
            // Next billing amount is the recurring subscription amount (monthly or annual)
            const nextBillingAmount = application.billing.recurringAmount || null;
            
            // Get the initial amount paid (should always exist, but fallback to amount for safety)
            const initialAmount = application.billing.initialAmount || application.billing.amount;
            
            const receiptResult = await this.emailService.sendPaymentReceipt(
              result.email,
              result.firstName,
              result.lastName,
              initialAmount, // Use initialAmount (includes setup + first period + design)
              application.billing.currency,
              application.paymentPlan,
              session.id,
              new Date(),
              application.billing.nextBillingDate,
              nextBillingAmount,
              application.billing.setupFee,
              application.billing.customDesignFee || 0,
            );
            
            if (receiptResult.success) {
              this.logger.log(`💳 Payment receipt sent successfully to ${result.email}`);
            } else {
              this.logger.warn(`⚠️ Payment receipt failed: ${result.email}`);
            }
          }
          
          // 2. Send Welcome Email with Credentials
          const welcomeResult = await this.emailService.sendWelcomeEmail(
            result.email,
            result.firstName,
            result.lastName,
            result.tempPassword,
          );
          
          if (welcomeResult.success) {
            this.logger.log(`📧 Welcome email sent successfully to ${result.email}`);
          } else {
            this.logger.warn(`⚠️ Welcome email failed but user created: ${result.email}`);
            // Log credentials so they can be manually sent if needed
            this.logger.log(`📝 Backup credentials: ${result.email} / ${result.tempPassword}`);
          }
        } catch (emailError) {
          this.logger.error(`❌ Failed to send emails: ${emailError.message}`);
          // Log credentials as backup
          this.logger.log(`📝 Backup credentials: ${result.email} / ${result.tempPassword}`);
          // Don't fail the webhook if email fails - user account was created successfully
        }
      } else if (result.alreadyProcessed) {
        this.logger.log(`ℹ️ Application already processed, skipping emails`);
      } else if (result.userExists) {
        this.logger.log(`ℹ️ User already exists, skipping emails`);
      }
    } catch (error) {
      this.logger.error(`Failed to process checkout session: ${error.message}`, error.stack);
      
      // CRITICAL: Issue automatic refund when user creation fails
      await this.handleFailedCheckout(session, error);
      
      // Don't throw - we don't want to fail the webhook
      // Stripe will retry the webhook automatically
    }
  }

  /**
   * Handle failed checkout - Issue automatic refund and notify customer
   */
  private async handleFailedCheckout(session: Stripe.Checkout.Session, error: any) {
    try {
      this.logger.warn(`🔄 Initiating automatic refund for session: ${session.id}`);

      // Check if payment intent exists
      if (!session.payment_intent) {
        this.logger.error(`❌ No payment intent found for session ${session.id}`);
        await this.sendCriticalAlert(session, error, 'No payment intent');
        return;
      }

      // Check if already refunded
      const application = await this.prisma.application.findFirst({
        where: { stripeSessionId: session.id },
      });

      if (application?.status === 'refunded') {
        this.logger.log(`ℹ️ Session ${session.id} already refunded`);
        return;
      }

      // Issue refund through Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: session.payment_intent as string,
        reason: 'requested_by_customer',
        metadata: {
          error: error.message,
          sessionId: session.id,
          automated: 'true',
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(`✅ Automatic refund issued: ${refund.id} for amount ${refund.amount / 100} ${refund.currency}`);

      // Update application status
      if (application) {
        await this.prisma.application.update({
          where: { id: application.id },
          data: {
            status: 'refunded',
          },
        });
        
        // Log the refund details
        this.logger.log(`📝 Refund details: ${refund.id} - ${error.message}`);

        // Send refund notification email to customer
        try {
          await this.emailService.sendRefundNotification(
            application.email,
            refund.amount / 100,
            refund.currency.toUpperCase(),
            session.id,
            error.message,
          );
          this.logger.log(`📧 Refund notification sent to ${application.email}`);
        } catch (emailError) {
          this.logger.error(`Failed to send refund notification email: ${emailError.message}`);
        }
      }

      // Send internal alert
      await this.sendCriticalAlert(session, error, `Refund issued: ${refund.id}`);

    } catch (refundError) {
      this.logger.error(`❌ CRITICAL: Failed to refund session ${session.id}: ${refundError.message}`, refundError.stack);
      
      // Send urgent alert to admin
      await this.sendCriticalAlert(session, error, `MANUAL REFUND REQUIRED: ${refundError.message}`);
    }
  }

  /**
   * Send critical alert to admin about payment issues
   */
  private async sendCriticalAlert(session: Stripe.Checkout.Session, error: any, additionalInfo: string) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 'admin@moth.solutions';
      
      await this.emailService.sendCriticalAlert(
        adminEmail,
        'Manual Intervention Required - Payment Processing',
        `
          Session ID: ${session.id}
          Customer Email: ${session.customer_details?.email || 'Unknown'}
          Amount: ${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'Unknown'} ${session.currency?.toUpperCase() || ''}
          Error: ${error.message}
          Additional Info: ${additionalInfo}
          
          Time: ${new Date().toISOString()}
          
          Action Required: Review and take appropriate action.
        `,
      );
      
      this.logger.log(`🚨 Critical alert sent to ${adminEmail}`);
    } catch (alertError) {
      this.logger.error(`Failed to send critical alert: ${alertError.message}`);
    }
  }

  /**
   * Handle subscription update
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    this.logger.log(`Subscription updated: ${subscription.id}`);
    this.logger.log(`Subscription status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}`);

    try {
      const billing = await this.prisma.billing.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (billing) {
        // Update billing status based on subscription status
        let status = 'active';
        let cancelledAt = billing.cancelledAt;

        // Check if subscription is scheduled to cancel at period end
        if (subscription.cancel_at_period_end) {
          status = 'cancelled';
          cancelledAt = billing.cancelledAt || new Date(); // Set if not already set
          this.logger.log(`Subscription is set to cancel at period end`);
        } else if (subscription.status === 'past_due') {
          status = 'past_due';
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          status = 'cancelled';
          cancelledAt = new Date();
        } else if (subscription.status === 'active') {
          status = 'active';
          cancelledAt = null; // Clear cancellation if reactivated
        }

        await this.prisma.billing.update({
          where: { id: billing.id },
          data: { 
            status,
            cancelledAt,
          },
        });

        this.logger.log(`Billing status updated to: ${status}, cancelledAt: ${cancelledAt}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update subscription: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle subscription deletion
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    this.logger.log(`Subscription deleted: ${subscription.id}`);

    try {
      const billing = await this.prisma.billing.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (billing) {
        await this.prisma.billing.update({
          where: { id: billing.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        });

        this.logger.log(`Billing marked as cancelled`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle subscription deletion: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle successful invoice payment
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    this.logger.log(`Invoice payment succeeded: ${invoice.id}`);

    try {
      // Extract subscription ID - it can be a string ID or an expanded Subscription object
      const subscription = (invoice as any).subscription;
      const subscriptionId = typeof subscription === 'string' 
        ? subscription 
        : subscription?.id;

      if (subscriptionId) {
        const billing = await this.prisma.billing.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (billing) {
          // Update next billing date
          const nextBillingDate = billing.billingDay 
            ? this.calculateNextBillingDate(billing.billingDay)
            : null;

          await this.prisma.billing.update({
            where: { id: billing.id },
            data: {
              status: 'active',
              nextBillingDate,
            },
          });

          this.logger.log(`Next billing date updated`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle invoice payment: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    this.logger.log(`Invoice payment failed: ${invoice.id}`);

    try {
      // Extract subscription ID - it can be a string ID or an expanded Subscription object
      const subscription = (invoice as any).subscription;
      const subscriptionId = typeof subscription === 'string' 
        ? subscription 
        : subscription?.id;

      if (subscriptionId) {
        const billing = await this.prisma.billing.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (billing) {
          await this.prisma.billing.update({
            where: { id: billing.id },
            data: { status: 'past_due' },
          });

          this.logger.log(`Billing status updated to past_due`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle invoice payment failure: ${error.message}`, error.stack);
    }
  }
}
