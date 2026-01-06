import nodemailer from 'nodemailer';
import { UserDataHelper } from '../data/UserDataHelper.js';
import { SettingsDataHelper } from '../data/SettingsDataHelper.js';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private userDataHelper: UserDataHelper;
  private settingsDataHelper: SettingsDataHelper;

  constructor() {
    this.userDataHelper = new UserDataHelper();
    this.settingsDataHelper = new SettingsDataHelper();
    this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      const settings = await this.settingsDataHelper.get();
      const emailAddress = settings?.emailAddress || process.env.EMAIL_USER;
      const emailPassword = settings?.emailPassword || process.env.EMAIL_PASS;

      if (!emailAddress || !emailPassword) {
        console.warn('Email credentials not configured. Email functionality will not work.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false,
        auth: {
          user: emailAddress,
          pass: emailPassword,
        },
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  async refreshTransporter(): Promise<void> {
    await this.initializeTransporter();
  }

  async sendEmail(to: string, subject: string, html: string, bcc?: string[]): Promise<void> {
    if (!this.transporter) {
      await this.initializeTransporter();
    }

    if (!this.transporter) {
      throw new Error('Email transporter not initialized. Please configure email settings.');
    }

    try {
      const settings = await this.settingsDataHelper.get();
      const emailAddress = settings?.emailAddress || process.env.EMAIL_USER;
      
      if (!emailAddress) {
        throw new Error('Email address not configured');
      }

      const mailOptions: any = {
        from: emailAddress,
        to,
        subject,
        html,
      };

      if (bcc && bcc.length > 0) {
        mailOptions.bcc = bcc;
      }

      await this.transporter.sendMail(mailOptions);
    } catch (error: any) {
      console.error('Email sending failed:', error);
      
      // Provide more helpful error messages for common Gmail issues
      if (error.code === 'EAUTH' || error.responseCode === 535) {
        throw new Error('Gmail authentication failed. Please use an App Password instead of your regular password. Enable 2-Step Verification and generate an App Password from your Google Account settings.');
      }
      
      throw new Error(error.message || 'Failed to send email');
    }
  }

  async sendBulkEmail(recipients: string[], subject: string, html: string): Promise<void> {
    const promises = recipients.map(email => this.sendEmail(email, subject, html));
    await Promise.all(promises);
  }

  async sendEmailWithBCC(to: string, bcc: string[], subject: string, html: string): Promise<void> {
    await this.sendEmail(to, subject, html, bcc);
  }

  async sendToAllMembers(subject: string, html: string): Promise<void> {
    const users = await this.userDataHelper.findAll();
    // Include all active users (members, board members, admins, etc.)
    const memberEmails = users
      .filter(u => u.is_active && u.email_address)
      .map(u => u.email_address);
    
    await this.sendBulkEmail(memberEmails, subject, html);
  }

  async sendToAdmins(subject: string, html: string): Promise<void> {
    const users = await this.userDataHelper.findAll();
    const adminEmails = users
      .filter(u => u.is_active && u.user_type === 'admin')
      .map(u => u.email_address);
    
    await this.sendBulkEmail(adminEmails, subject, html);
  }

  async sendToExternalOrganizations(organizations: string[], subject: string, html: string): Promise<void> {
    await this.sendBulkEmail(organizations, subject, html);
  }

  async getMemberEmails(): Promise<string[]> {
    const users = await this.userDataHelper.findAll();
    // Include all active users (members, board members, admins, etc.)
    return users
      .filter(u => u.is_active && u.email_address)
      .map(u => u.email_address);
  }

  async getAdminEmails(): Promise<string[]> {
    const users = await this.userDataHelper.findAll();
    return users
      .filter(u => u.is_active && u.user_type === 'admin')
      .map(u => u.email_address);
  }

  generateEventNotificationHTML(eventTitle: string, eventDate: string, eventDescription: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .event-title { font-size: 24px; color: #ef4444; margin-bottom: 15px; }
            .event-date { font-size: 18px; color: #666; margin-bottom: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Bengali Community Event</h1>
            </div>
            <div class="content">
              <h2 class="event-title">${eventTitle}</h2>
              <p class="event-date"><strong>Date:</strong> ${new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>${eventDescription}</p>
              <p style="margin-top: 20px;">We hope to see you there!</p>
            </div>
            <div class="footer">
              <p>Bengali Community of USA</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

