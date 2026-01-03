import nodemailer from 'nodemailer';
import { UserDataHelper } from '../data/UserDataHelper.js';

export class EmailService {
  private transporter: nodemailer.Transporter;
  private userDataHelper: UserDataHelper;

  constructor() {
    this.userDataHelper = new UserDataHelper();
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendBulkEmail(recipients: string[], subject: string, html: string): Promise<void> {
    const promises = recipients.map(email => this.sendEmail(email, subject, html));
    await Promise.all(promises);
  }

  async sendToAllMembers(subject: string, html: string): Promise<void> {
    const users = await this.userDataHelper.findAll();
    const memberEmails = users
      .filter(u => u.is_active && (u.member_type === 'member' || u.user_type === 'admin'))
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

