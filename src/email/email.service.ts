import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail = require('@sendgrid/mail');
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid configured successfully');
    } else {
      this.logger.warn('SENDGRID_API_KEY not configured - emails will not be sent');
    }
  }

  /**
   * Generate PDF receipt
   */
  private async generateReceiptPDF(
    firstName: string,
    lastName: string,
    email: string,
    amount: number,
    currency: string,
    paymentPlan: string,
    transactionId: string,
    paymentDate: Date,
    nextBillingDate: Date | null,
    nextBillingAmount: number | null,
    setupFee?: number,
    customDesignFee?: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Add logo at the top center
      try {
        const logoPath = require('path').join(__dirname, '../../public/moth icon.png');
        doc.image(logoPath, doc.page.width / 2 - 60, 30, { width: 120 });
        doc.moveDown(6);
      } catch (error) {
        this.logger.warn('Could not load logo for receipt PDF');
        doc.moveDown(1);
      }

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica').fillColor('#666666').text('Moth Models', { align: 'center' });
      doc.moveDown(2.5);

      // Receipt Details Section
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('RECEIPT DETAILS', { underline: true });
      doc.moveDown(0.5);

      const startY = doc.y;
      const labelX = 50;
      const valueX = 250;

      // Receipt information
      const formattedDate = paymentDate.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const formattedAmount = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount);

      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      
      let currentY = startY;
      const lineHeight = 22; // Increased from 18 to 22 for better spacing

      // Transaction ID (with smaller font for long IDs)
      doc.text('Transaction ID:', labelX, currentY);
      doc.fontSize(8).text(transactionId, valueX, currentY, { width: 300 });
      doc.fontSize(10); // Reset font size
      currentY += lineHeight + 5; // Extra spacing after transaction ID

      // Date
      doc.text('Date:', labelX, currentY);
      doc.text(formattedDate, valueX, currentY);
      currentY += lineHeight;

      // Customer Name
      doc.text('Customer Name:', labelX, currentY);
      doc.text(`${firstName} ${lastName}`, valueX, currentY);
      currentY += lineHeight;

      // Email
      doc.text('Email Address:', labelX, currentY);
      doc.text(email, valueX, currentY);
      currentY += lineHeight;

      // Plan Type
      let planType = 'Monthly Subscription';
      if (paymentPlan === 'annual') {
        planType = 'Annual Subscription (£19.99/month)';
      } else if (paymentPlan === 'lifetime') {
        planType = 'Lifetime Access';
      }
      doc.text('Plan Type:', labelX, currentY);
      doc.text(planType, valueX, currentY);
      currentY += lineHeight + 5; // Extra spacing before breakdown

      // Show breakdown if setup fee exists
      if (setupFee) {
        doc.text('Setup Fee:', labelX, currentY);
        doc.text(`£${setupFee.toFixed(2)}`, valueX, currentY);
        currentY += lineHeight;
      }

      if (customDesignFee && customDesignFee > 0) {
        doc.text('Custom Design:', labelX, currentY);
        doc.text(`£${customDesignFee.toFixed(2)}`, valueX, currentY);
        currentY += lineHeight;
      }

      currentY += 15; // Increased spacing before amount box

      // Amount Section with border
      doc.rect(labelX, currentY, 500, 40).stroke();
      currentY += 12;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Amount Paid:', labelX + 10, currentY);
      doc.text(formattedAmount, valueX, currentY, { align: 'right' });
      currentY += 40;

      // Next Billing Information (if applicable)
      if (nextBillingDate && nextBillingAmount !== null) {
        doc.moveDown(1);
        currentY = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('BILLING INFORMATION', { underline: true });
        doc.moveDown(0.5);
        currentY = doc.y;

        const formattedNextDate = nextBillingDate.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const formattedNextAmount = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: currency.toUpperCase(),
        }).format(nextBillingAmount);

        doc.fontSize(10).font('Helvetica').fillColor('#000000');
        doc.text('Next Billing Date:', labelX, currentY);
        doc.text(formattedNextDate, valueX, currentY);
        currentY += lineHeight;

        const subscriptionLabel = paymentPlan === 'monthly' ? 'Monthly Subscription:' : 'Annual Subscription:';
        doc.text(subscriptionLabel, labelX, currentY);
        doc.text(formattedNextAmount, valueX, currentY);
        currentY += lineHeight;
      }

      // Payment Processor Note
      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('Payment processed securely via Stripe', 50, doc.y, { 
        width: doc.page.width - 100, 
        align: 'center' 
      });
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('Thank you for your business!', 50, doc.y, { 
        width: doc.page.width - 100, 
        align: 'center' 
      });
      doc.moveDown(0.5);
      doc.fontSize(8).text('This is an official payment receipt from Moth Solutions Ltd', 50, doc.y, { 
        width: doc.page.width - 100, 
        align: 'center' 
      });
      doc.moveDown(0.3);
      doc.text('For support, contact: support@moth.solutions', 50, doc.y, { 
        width: doc.page.width - 100, 
        align: 'center' 
      });
      doc.moveDown(1);
      doc.text(`© ${new Date().getFullYear()} Moth Solutions Ltd. All rights reserved.`, 50, doc.y, { 
        width: doc.page.width - 100, 
        align: 'center' 
      });

      doc.end();
    });
  }

  /**
   * Send payment receipt email with PDF attachment
   */
  async sendPaymentReceipt(
    email: string,
    firstName: string,
    lastName: string,
    amount: number,
    currency: string,
    paymentPlan: string,
    transactionId: string,
    paymentDate: Date,
    nextBillingDate: Date | null = null,
    nextBillingAmount: number | null = null,
    setupFee: number = 60.00,
    customDesignFee: number = 0,
  ): Promise<{ success: boolean; error?: string }> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    
    if (!apiKey) {
      this.logger.warn(`Skipping receipt email to ${email} - SendGrid not configured`);
      return { success: false, error: 'SendGrid not configured' };
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@moth.solutions';
    const companyName = 'Moth Models';

    try {
      // Generate PDF receipt
      const pdfBuffer = await this.generateReceiptPDF(
        firstName,
        lastName,
        email,
        amount,
        currency,
        paymentPlan,
        transactionId,
        paymentDate,
        nextBillingDate,
        nextBillingAmount,
        setupFee,
        customDesignFee,
      );

      const formattedAmount = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount);

      const msg = {
        to: email,
        from: {
          email: fromEmail,
          name: companyName,
        },
        subject: `Payment Receipt - ${companyName}`,
        html: this.getSimpleReceiptEmailTemplate(firstName, formattedAmount, companyName),
        text: `Hi ${firstName},\n\nThank you for your payment of ${formattedAmount}.\n\nYour receipt is attached to this email.\n\nBest regards,\nThe ${companyName} Team`,
        attachments: [
          {
            content: pdfBuffer.toString('base64'),
            filename: `receipt-${transactionId}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ],
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Payment receipt sent successfully to ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ Failed to send receipt email to ${email}:`, error.message);
      if (error.response) {
        this.logger.error('SendGrid error details:', error.response.body);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Simple email template for receipt notification
   */
  private getSimpleReceiptEmailTemplate(firstName: string, amount: string, companyName: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 20px;
      line-height: 1.8;
    }
    .amount-box {
      background: #f0fdf4;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
      text-align: center;
    }
    .amount-label {
      font-size: 14px;
      color: #065f46;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 28px;
      color: #064e3b;
      font-weight: 700;
    }
    .attachment-notice {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      border-radius: 4px;
      margin: 25px 0;
    }
    .attachment-notice p {
      margin: 0;
      font-size: 14px;
      color: #1e3a8a;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Successful</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${firstName},</div>
      <p class="message">
        Thank you for your payment! We've successfully processed your transaction.
      </p>
      <div class="amount-box">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">${amount}</div>
      </div>
      <div class="attachment-notice">
        <p><strong>📄 Your receipt is attached</strong></p>
        <p>Please find your official payment receipt attached to this email as a PDF file.</p>
      </div>
      <p class="message">
        Keep this receipt for your records. If you have any questions, feel free to contact us at support@moth.solutions
      </p>
      <p class="message">
        Best regards,<br>
        <strong>The ${companyName} Team</strong>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Moth Solutions Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Send welcome email with login credentials
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string,
    lastName: string,
    tempPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    
    if (!apiKey) {
      this.logger.warn(`Skipping email to ${email} - SendGrid not configured`);
      return { success: false, error: 'SendGrid not configured' };
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@moth.solutions';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:8200';
    const companyName = 'Moth Models';

    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: companyName,
      },
      subject: `Welcome to ${companyName}! Your Account is Ready`,
      html: this.getWelcomeEmailTemplate(
        firstName,
        lastName,
        email,
        tempPassword,
        frontendUrl,
        companyName,
      ),
      text: this.getWelcomeEmailText(firstName, email, tempPassword, frontendUrl),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`✅ Welcome email sent successfully to ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ Failed to send welcome email to ${email}:`, error.message);
      if (error.response) {
        this.logger.error('SendGrid error details:', error.response.body);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Professional HTML email template
   */
  private getWelcomeEmailTemplate(
    firstName: string,
    lastName: string,
    email: string,
    tempPassword: string,
    frontendUrl: string,
    companyName: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header p {
      font-size: 18px;
      opacity: 0.95;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      background-color: #ffffff;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .intro-text {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .credentials-box {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 2px solid #dee2e6;
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
    }
    .credentials-header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
    }
    .lock-icon {
      width: 24px;
      height: 24px;
      margin-right: 10px;
    }
    .credential-item {
      margin-bottom: 15px;
      background: white;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #d1d5db;
    }
    .credential-item:last-child {
      margin-bottom: 0;
    }
    .credential-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #667eea;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .credential-value {
      font-family: 'Courier New', Courier, monospace;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      word-break: break-all;
      padding: 8px;
      background: #f9fafb;
      border-radius: 4px;
      border-left: 3px solid #667eea;
    }
    .warning-box {
      background: #fef3c7;
      border: 2px solid #fbbf24;
      border-radius: 8px;
      padding: 15px;
      margin: 25px 0;
      display: flex;
      align-items: flex-start;
    }
    .warning-icon {
      font-size: 24px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .warning-text {
      font-size: 14px;
      color: #92400e;
      line-height: 1.6;
    }
    .warning-text strong {
      font-weight: 700;
      color: #78350f;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin: 30px 0;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
    }
    .cta-button:hover {
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      transform: translateY(-2px);
    }
    .button-container {
      text-align: center;
      margin: 35px 0;
    }
    .info-section {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .info-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 10px;
    }
    .info-section p {
      font-size: 14px;
      color: #1e3a8a;
      margin: 5px 0;
      line-height: 1.6;
    }
    .features-list {
      margin: 25px 0;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    .feature-icon {
      font-size: 20px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .feature-text {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.6;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      border-radius: 0 0 10px 10px;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin: 8px 0;
    }
    .footer-links {
      margin: 15px 0;
    }
    .footer-link {
      color: #667eea;
      text-decoration: none;
      margin: 0 10px;
      font-size: 13px;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e5e7eb, transparent);
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .header { padding: 30px 20px; }
      .header h1 { font-size: 26px; }
      .content { padding: 30px 20px; }
      .credentials-box { padding: 20px; }
      .credential-value { font-size: 16px; }
      .cta-button { padding: 14px 30px; font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="header">
      <h1>🎉 Welcome to ${companyName}!</h1>
      <p>Your account is ready to go</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">Hi ${firstName},</div>
      
      <p class="intro-text">
        Thank you for your payment! We're thrilled to have you on board. Your personal management dashboard is now active and ready for you to start creating your own website.
      </p>

      <!-- Credentials Box -->
      <div class="credentials-box">
        <div class="credentials-header">
          <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Your Login Credentials
        </div>
        
        <div class="credential-item">
          <div class="credential-label">Email Address</div>
          <div class="credential-value">${email}</div>
        </div>
        
        <div class="credential-item">
          <div class="credential-label">Temporary Password</div>
          <div class="credential-value">${tempPassword}</div>
        </div>
      </div>

      <!-- Warning Box -->
      <div class="warning-box">
        <div class="warning-icon">⚠️</div>
        <div class="warning-text">
          <strong>Important Security Notice:</strong><br>
          This is a temporary password. For your security, please change it immediately after your first login. You can update your password in the Settings section of your dashboard.
        </div>
      </div>

      <!-- CTA Button -->
      <div class="button-container">
        <a href="${frontendUrl}/login" class="cta-button">
          🚀 Log In to Your Dashboard
        </a>
      </div>

      <div class="divider"></div>

      <!-- What's Next Section -->
      <div class="info-section">
        <h3>🎯 What's Next?</h3>
        <p>Once you log in, you'll be able to:</p>
      </div>

      <div class="features-list">
        <div class="feature-item">
          <div class="feature-icon">✨</div>
          <div class="feature-text">
            <strong>Create Your Website:</strong> Use our intuitive builder to design your perfect website
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📊</div>
          <div class="feature-text">
            <strong>Manage Content:</strong> Upload images, edit your profile, and customize everything
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📅</div>
          <div class="feature-text">
            <strong>Track Bookings:</strong> Manage your schedule and appointments effortlessly
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🔒</div>
          <div class="feature-text">
            <strong>Stay Secure:</strong> Enable two-factor authentication for extra protection
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Help Section -->
      <div class="info-section">
        <h3>💬 Need Help?</h3>
        <p>If you have any questions or need assistance, we're here to help!</p>
        <p>Contact us at <a href="mailto:support@moth.solutions" style="color: #667eea;">support@moth.solutions</a></p>
      </div>

      <p class="intro-text" style="margin-top: 30px;">
        Thank you for choosing ${companyName}. We're excited to see what you'll create!
      </p>

      <p style="font-size: 15px; color: #6b7280; margin-top: 20px;">
        Best regards,<br>
        <strong style="color: #1f2937;">The ${companyName} Team</strong>
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        This email was sent to <strong>${email}</strong>
      </p>
      <div class="footer-links">
        <a href="${frontendUrl}" class="footer-link">Visit Website</a>
        <a href="${frontendUrl}/login" class="footer-link">Login</a>
      </div>
      <p class="footer-text">
        © ${new Date().getFullYear()} ${companyName}. All rights reserved.
      </p>
      <p class="footer-text" style="margin-top: 15px; font-size: 11px;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Payment receipt HTML template
   */
  private getReceiptEmailTemplate(
    firstName: string,
    lastName: string,
    email: string,
    amount: number,
    currency: string,
    paymentPlan: string,
    transactionId: string,
    paymentDate: Date,
    companyName: string,
  ): string {
    const formattedAmount = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);

    const formattedDate = paymentDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let planType = 'Monthly Subscription (£24.99/month)';
    if (paymentPlan === 'annual') {
      planType = 'Annual Subscription (£239.88/year = £19.99/month)';
    } else if (paymentPlan === 'lifetime') {
      planType = 'Lifetime Access';
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .receipt-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .content {
      padding: 40px 30px;
      background-color: #ffffff;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .intro-text {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .receipt-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 2px solid #10b981;
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
    }
    .receipt-header {
      font-size: 18px;
      font-weight: 600;
      color: #065f46;
      margin-bottom: 20px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .receipt-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #a7f3d0;
    }
    .receipt-item:last-child {
      border-bottom: none;
      padding-top: 15px;
      margin-top: 10px;
      border-top: 2px solid #10b981;
      font-weight: 700;
      font-size: 18px;
    }
    .receipt-label {
      color: #065f46;
      font-weight: 500;
    }
    .receipt-value {
      color: #064e3b;
      font-weight: 600;
      text-align: right;
    }
    .success-box {
      background: #d1fae5;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 15px;
      margin: 25px 0;
      display: flex;
      align-items: center;
    }
    .success-icon {
      font-size: 24px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .success-text {
      font-size: 15px;
      color: #065f46;
      font-weight: 600;
    }
    .info-section {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .info-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 10px;
    }
    .info-section p {
      font-size: 14px;
      color: #1e3a8a;
      margin: 5px 0;
      line-height: 1.6;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e5e7eb, transparent);
      margin: 30px 0;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      border-radius: 0 0 10px 10px;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin: 8px 0;
    }
    @media only screen and (max-width: 600px) {
      .header { padding: 30px 20px; }
      .header h1 { font-size: 26px; }
      .content { padding: 30px 20px; }
      .receipt-box { padding: 20px; }
      .receipt-item { flex-direction: column; gap: 5px; }
      .receipt-value { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="header">
      <div class="receipt-icon">✅</div>
      <h1>Payment Successful!</h1>
      <p>Thank you for your purchase</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">Hi ${firstName},</div>
      
      <p class="intro-text">
        Thank you for your payment! This email confirms that your transaction was processed successfully. Below you'll find the details of your purchase.
      </p>

      <!-- Success Message -->
      <div class="success-box">
        <div class="success-icon">✅</div>
        <div class="success-text">
          Your payment has been received and processed successfully
        </div>
      </div>

      <!-- Receipt Details -->
      <div class="receipt-box">
        <div class="receipt-header">Payment Receipt</div>
        
        <div class="receipt-item">
          <div class="receipt-label">Customer Name:</div>
          <div class="receipt-value">${firstName} ${lastName}</div>
        </div>
        
        <div class="receipt-item">
          <div class="receipt-label">Email Address:</div>
          <div class="receipt-value">${email}</div>
        </div>
        
        <div class="receipt-item">
          <div class="receipt-label">Transaction ID:</div>
          <div class="receipt-value">${transactionId}</div>
        </div>
        
        <div class="receipt-item">
          <div class="receipt-label">Payment Date:</div>
          <div class="receipt-value">${formattedDate}</div>
        </div>
        
        <div class="receipt-item">
          <div class="receipt-label">Plan Type:</div>
          <div class="receipt-value">${planType}</div>
        </div>
        
        <div class="receipt-item">
          <div class="receipt-label">Total Amount Paid:</div>
          <div class="receipt-value">${formattedAmount}</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- What's Next -->
      <div class="info-section">
        <h3>📧 What's Next?</h3>
        <p>You'll receive a separate email with your login credentials shortly. If you don't see it, please check your spam folder.</p>
      </div>

      ${paymentPlan === 'monthly' ? `
      <div class="info-section">
        <h3>🔄 Monthly Subscription</h3>
        <p>You're subscribed to our Monthly Plan (£24.99/month). Your subscription will automatically renew monthly. You can manage or cancel your subscription anytime from your dashboard.</p>
      </div>
      ` : paymentPlan === 'annual' ? `
      <div class="info-section">
        <h3>🎉 Annual Subscription - Save 20%!</h3>
        <p>You're subscribed to our Annual Plan (£239.88/year = £19.99/month). Your subscription will automatically renew annually. You can manage or cancel your subscription anytime from your dashboard.</p>
      </div>
      ` : `
      <div class="info-section">
        <h3>🎉 Lifetime Access</h3>
        <p>Congratulations! You now have lifetime access to ${companyName}. No recurring payments - you're all set!</p>
      </div>
      `}

      <div class="info-section">
        <h3>💬 Need Help?</h3>
        <p>If you have any questions about your payment or need assistance, we're here to help!</p>
        <p>Contact us at <a href="mailto:support@moth.solutions" style="color: #10b981; text-decoration: none; font-weight: 600;">support@moth.solutions</a></p>
      </div>

      <p class="intro-text" style="margin-top: 30px;">
        Thank you for choosing ${companyName}!
      </p>

      <p style="font-size: 15px; color: #6b7280; margin-top: 20px;">
        Best regards,<br>
        <strong style="color: #1f2937;">The ${companyName} Team</strong>
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        This is a payment receipt for ${email}
      </p>
      <p class="footer-text">
        Keep this email for your records
      </p>
      <p class="footer-text" style="margin-top: 15px;">
        © ${new Date().getFullYear()} ${companyName}. All rights reserved.
      </p>
      <p class="footer-text" style="margin-top: 10px; font-size: 11px;">
        Transaction ID: ${transactionId}
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Payment receipt plain text
   */
  private getReceiptEmailText(
    firstName: string,
    amount: number,
    currency: string,
    paymentPlan: string,
    transactionId: string,
    paymentDate: Date,
  ): string {
    const formattedAmount = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);

    const formattedDate = paymentDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let planType = 'Monthly Subscription (£24.99/month)';
    if (paymentPlan === 'annual') {
      planType = 'Annual Subscription (£239.88/year = £19.99/month)';
    } else if (paymentPlan === 'lifetime') {
      planType = 'Lifetime Access';
    }

    return `
PAYMENT SUCCESSFUL - ${formattedAmount}

Hi ${firstName},

Thank you for your payment! This email confirms that your transaction was processed successfully.

========================================
PAYMENT RECEIPT
========================================

Transaction ID: ${transactionId}
Payment Date: ${formattedDate}
Plan Type: ${planType}
Amount Paid: ${formattedAmount}

========================================

WHAT'S NEXT?
You'll receive a separate email with your login credentials shortly.

${paymentPlan === 'monthly' ? `
SUBSCRIPTION DETAILS
Your subscription will automatically renew monthly at £24.99/month. You can manage or cancel anytime from your dashboard.
` : paymentPlan === 'annual' ? `
SUBSCRIPTION DETAILS
Your subscription will automatically renew annually at £239.88/year (£19.99/month - save 20%!). You can manage or cancel anytime from your dashboard.
` : `
LIFETIME ACCESS
Congratulations! You now have lifetime access with no recurring payments.
`}

NEED HELP?
Contact us at support@moth.solutions

Thank you for choosing Moth Models!

Best regards,
The Moth Models Team

---
© ${new Date().getFullYear()} Moth Solutions Ltd. All rights reserved.
Transaction ID: ${transactionId}
    `.trim();
  }

  /**
   * Plain text version for email clients that don't support HTML
   */
  private getWelcomeEmailText(
    firstName: string,
    email: string,
    tempPassword: string,
    frontendUrl: string,
  ): string {
    return `
Welcome to Moth Models, ${firstName}!

Your account has been created successfully and your personal management dashboard is now active.

========================================
YOUR LOGIN CREDENTIALS
========================================

Email: ${email}
Temporary Password: ${tempPassword}

========================================

⚠️ IMPORTANT SECURITY NOTICE
This is a temporary password. Please change it immediately after your first login for your security.

🚀 GET STARTED
Log in now: ${frontendUrl}/login

WHAT'S NEXT?
Once you log in, you'll be able to:
✨ Create your website using our intuitive builder
📊 Manage your content and customize everything
📅 Track bookings and manage your schedule
🔒 Enable two-factor authentication for extra security

NEED HELP?
If you have any questions, contact us at support@moth.solutions

Thank you for choosing Moth Models!

Best regards,
The Moth Models Team

---
© ${new Date().getFullYear()} Moth Solutions Ltd. All rights reserved.
This is an automated email. Please do not reply to this message.
    `.trim();
  }

  /**
   * Send email verification code
   */
  async sendVerificationCode(
    email: string,
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    
    if (!apiKey) {
      this.logger.warn(`Skipping verification email to ${email} - SendGrid not configured`);
      return { success: false, error: 'SendGrid not configured' };
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@moth.solutions';
    const companyName = 'Moth Models';

    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: companyName,
      },
      subject: `Your Verification Code - ${companyName}`,
      html: this.getVerificationEmailTemplate(email, code, companyName),
      text: this.getVerificationEmailText(email, code),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`✅ Verification code sent successfully to ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ Failed to send verification email to ${email}:`, error.message);
      if (error.response) {
        this.logger.error('SendGrid error details:', error.response.body);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Verification email HTML template
   */
  private getVerificationEmailTemplate(email: string, code: string, companyName: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 20px;
      line-height: 1.8;
    }
    .code-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      text-align: center;
    }
    .code-label {
      font-size: 14px;
      color: #1e40af;
      font-weight: 600;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .code-value {
      font-family: 'Courier New', Courier, monospace;
      font-size: 42px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 8px;
      margin: 10px 0;
      text-align: center;
    }
    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #fbbf24;
      padding: 15px;
      border-radius: 4px;
      margin: 25px 0;
    }
    .warning-box p {
      margin: 0;
      font-size: 14px;
      color: #92400e;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Email Verification</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi there,</div>
      <p class="message">
        Thank you for starting your application with ${companyName}! To verify your email address, please use the code below:
      </p>
      <div class="code-box">
        <div class="code-label">Your Verification Code</div>
        <div class="code-value">${code}</div>
      </div>
      <div class="warning-box">
        <p><strong>⏰ This code will expire in 15 minutes.</strong></p>
        <p>If you didn't request this code, you can safely ignore this email.</p>
      </div>
      <p class="message">
        Enter this code in the application form to continue with your registration.
      </p>
      <p class="message">
        If you have any questions, feel free to contact us at support@moth.solutions
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Moth Solutions Ltd. All rights reserved.</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Verification email plain text
   */
  private getVerificationEmailText(email: string, code: string): string {
    return `
EMAIL VERIFICATION

Hi there,

Thank you for starting your application with Moth Models! To verify your email address, please use the code below:

========================================
YOUR VERIFICATION CODE
========================================

${code}

========================================

⏰ This code will expire in 15 minutes.

If you didn't request this code, you can safely ignore this email.

Enter this code in the application form to continue with your registration.

If you have any questions, contact us at support@moth.solutions

Best regards,
The Moth Models Team

---
© ${new Date().getFullYear()} Moth Solutions Ltd. All rights reserved.
This is an automated email. Please do not reply to this message.
    `.trim();
  }

  /**
   * Send refund notification to customer
   */
  async sendRefundNotification(
    email: string,
    amount: number,
    currency: string,
    sessionId: string,
    errorReason: string,
  ) {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        this.logger.warn('SendGrid not configured - skipping refund notification email');
        return { success: false, message: 'SendGrid not configured' };
      }

      const msg = {
        to: email,
        from: this.configService.get<string>('EMAIL_FROM') || 'noreply@moth.solutions',
        subject: 'Refund Issued - MOTH Solutions',
        html: this.getRefundNotificationHTML(amount, currency, sessionId),
        text: this.getRefundNotificationText(amount, currency, sessionId),
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Refund notification sent to ${email}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send refund notification: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send critical alert to admin
   */
  async sendCriticalAlert(adminEmail: string, subject: string, message: string) {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        this.logger.warn('SendGrid not configured - skipping critical alert');
        return { success: false, message: 'SendGrid not configured' };
      }

      const msg = {
        to: adminEmail,
        from: this.configService.get<string>('EMAIL_FROM') || 'noreply@moth.solutions',
        subject: `🚨 ${subject}`,
        html: this.getCriticalAlertHTML(subject, message),
        text: message,
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Critical alert sent to ${adminEmail}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send critical alert: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refund notification HTML
   */
  private getRefundNotificationHTML(amount: number, currency: string, sessionId: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a;">Refund Issued</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">Dear Customer,</p>
              
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #333;">
                We encountered a technical issue while processing your application, and your payment has been refunded.
              </p>
              
              <!-- Refund Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%">
                      <tr>
                        <td style="padding: 8px 0; font-size: 15px; color: #666;">Refund Amount:</td>
                        <td style="padding: 8px 0; font-size: 18px; font-weight: 600; color: #1a1a1a; text-align: right;">
                          ${amount.toFixed(2)} ${currency}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 15px; color: #666;">Reference:</td>
                        <td style="padding: 8px 0; font-size: 13px; font-family: monospace; color: #666; text-align: right;">
                          ${sessionId}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                  <strong>✓ Refund processed successfully</strong><br>
                  The refund will appear in your account within 5-10 business days, depending on your bank.
                </p>
              </div>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                We sincerely apologize for the inconvenience. If you'd like to try again or have any questions, please don't hesitate to contact us.
              </p>
              
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background-color: #1a1a1a; border-radius: 6px; text-align: center;">
                    <a href="mailto:support@moth.solutions" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Contact Support
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 16px; line-height: 1.6; color: #333;">
                Best regards,<br>
                <strong>The MOTH Solutions Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #e5e5e5; background-color: #f9f9f9; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 10px; font-size: 13px; color: #999;">© ${new Date().getFullYear()} MOTH Solutions Ltd. All rights reserved.</p>
              <p style="margin: 0; font-size: 13px; color: #999;">This is an automated email. Please do not reply to this message.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Refund notification plain text
   */
  private getRefundNotificationText(amount: number, currency: string, sessionId: string): string {
    return `
REFUND ISSUED

Dear Customer,

We encountered a technical issue while processing your application, and your payment has been refunded.

========================================
REFUND DETAILS
========================================

Refund Amount: ${amount.toFixed(2)} ${currency}
Reference: ${sessionId}

========================================

✓ Refund processed successfully

The refund will appear in your account within 5-10 business days, depending on your bank.

We sincerely apologize for the inconvenience. If you'd like to try again or have any questions, please contact us at support@moth.solutions

Best regards,
The MOTH Solutions Team

---
© ${new Date().getFullYear()} MOTH Solutions Ltd. All rights reserved.
This is an automated email. Please do not reply to this message.
    `.trim();
  }

  /**
   * Critical alert HTML
   */
  private getCriticalAlertHTML(subject: string, message: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-top: 4px solid #f44336;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🚨</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f44336;">${subject}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #ffebee; border-left: 4px solid #f44336; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #c62828; white-space: pre-wrap;">${message}</p>
              </div>
              
              <p style="margin: 0; font-size: 15px; color: #666;">
                This is an automated alert from the MOTH Solutions payment processing system.
                Please review and take appropriate action immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #e5e5e5; background-color: #f9f9f9; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #999;">
                © ${new Date().getFullYear()} MOTH Solutions Ltd. | Automated Alert System
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}

