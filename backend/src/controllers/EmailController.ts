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
      const { subject, html } = req.body;

      if (!subject || !html) {
        res.status(400).json({ error: 'Subject and HTML content are required' });
        return;
      }

      await this.emailService.sendToAllMembers(subject, html);
      res.json({ message: 'Emails sent successfully to all members' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send emails' });
    }
  }

  async sendToAdmins(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subject, html } = req.body;

      if (!subject || !html) {
        res.status(400).json({ error: 'Subject and HTML content are required' });
        return;
      }

      await this.emailService.sendToAdmins(subject, html);
      res.json({ message: 'Emails sent successfully to all admins' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send emails' });
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
        event.title,
        event.date,
        event.description
      );

      await this.emailService.sendToAllMembers(
        `Upcoming Event: ${event.title}`,
        html
      );

      res.json({ message: 'Event notification sent successfully to all members' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send event notification' });
    }
  }
}

