import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { EmailService } from '../services/EmailService.js';
import { EventService } from '../services/EventService.js';

export class EmailController {
  private emailService: EmailService;
  private eventService: EventService;

  constructor() {
    this.emailService = new EmailService();
    this.eventService = new EventService();
  }

  async sendToMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { emails, subject, html } = req.body;

      if (!subject || !html) {
        res.status(400).json({ error: 'Subject and HTML content are required' });
        return;
      }

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        res.status(400).json({ error: 'At least one recipient email is required' });
        return;
      }

      await this.emailService.sendBulkEmail(emails, subject, html);
      res.json({ message: `Emails sent successfully to ${emails.length} recipient(s)` });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send emails';
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  }

  async sendToAdmins(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { emails, subject, html } = req.body;

      if (!subject || !html) {
        res.status(400).json({ error: 'Subject and HTML content are required' });
        return;
      }

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        res.status(400).json({ error: 'At least one recipient email is required' });
        return;
      }

      await this.emailService.sendBulkEmail(emails, subject, html);
      res.json({ message: `Emails sent successfully to ${emails.length} recipient(s)` });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send emails';
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  }

  async sendToOrganizations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { organizations, subject, html } = req.body;

      if (!organizations || !Array.isArray(organizations) || !subject || !html) {
        res.status(400).json({ error: 'Organizations array, subject, and HTML content are required' });
        return;
      }

      await this.emailService.sendToExternalOrganizations(organizations, subject, html);
      res.json({ message: 'Emails sent successfully to organizations' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send emails' });
    }
  }

  async sendEventNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;

      const event = await this.eventService.getEventById(eventId);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const html = this.emailService.generateEventNotificationHTML(
        event.title || event.event_name,
        event.date || event.event_start_dt,
        event.description || event.event_description
      );

      await this.emailService.sendToAllMembers(
        `Upcoming Event: ${event.title || event.event_name}`,
        html
      );

      res.json({ message: 'Event notification sent successfully to all members' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send event notification' });
    }
  }

  async testEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { to } = req.body;
      
      if (!to || typeof to !== 'string') {
        res.status(400).json({ error: 'Recipient email address is required' });
        return;
      }

      // Refresh transporter to use latest settings
      await this.emailService.refreshTransporter();

      const testHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Email Test</h1>
              </div>
              <div class="content">
                <p>This is a test email from Sanhoti Bengali Association of Orange County.</p>
                <p>If you received this email, your email configuration is working correctly!</p>
              </div>
            </div>
          </body>
        </html>
      `;

      await this.emailService.sendEmail(to, 'Test Email from Sanhoti', testHtml);
      res.json({ message: 'Test email sent successfully' });
    } catch (error: any) {
      console.error('Test email failed:', error);
      const errorMessage = error.message || 'Failed to send test email';
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  }

  async getMemberEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const emails = await this.emailService.getMemberEmails();
      res.json({ emails });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch member emails' });
    }
  }

  async getAdminEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const emails = await this.emailService.getAdminEmails();
      res.json({ emails });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admin emails' });
    }
  }
}

