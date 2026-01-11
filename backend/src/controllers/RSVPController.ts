import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { RSVPService } from '../services/RSVPService.js';
import { RSVP } from '../models/types.js';

export class RSVPController {
  private rsvpService: RSVPService;

  constructor() {
    this.rsvpService = new RSVPService();
  }

  async getAllRSVPs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rsvps = await this.rsvpService.getAllRSVPs();
      res.json(rsvps);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
  }

  async getRSVPById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rsvp = await this.rsvpService.getRSVPById(id);
      if (!rsvp) {
        res.status(404).json({ error: 'RSVP not found' });
        return;
      }
      res.json(rsvp);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RSVP' });
    }
  }

  async getRSVPsByEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const rsvps = await this.rsvpService.getRSVPsByEvent(eventId);
      res.json(rsvps);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
  }

  async getRSVPsBySubEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subEventId } = req.params;
      const rsvps = await this.rsvpService.getRSVPsBySubEvent(subEventId);
      res.json(rsvps);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
  }

  async getMyRSVPs(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Get RSVPs by userId (for logged-in users)
      const rsvpsByUserId = await this.rsvpService.getRSVPsByUser(req.user.userId);
      
      // Also get RSVPs by email (for guest RSVPs made with the same email)
      const userEmail = req.user.email;
      let rsvpsByEmail: RSVP[] = [];
      if (userEmail) {
        rsvpsByEmail = await this.rsvpService.getRSVPsByEmail(userEmail);
      }
      
      // Combine and deduplicate by RSVP id
      const allRSVPs = [...rsvpsByUserId, ...rsvpsByEmail];
      const uniqueRSVPs = Array.from(
        new Map(allRSVPs.map(rsvp => [rsvp.id, rsvp])).values()
      );
      
      res.json(uniqueRSVPs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
  }

  async createRSVP(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId, subEventId, email, name, phone, numberOfGuests, numberOfAdults, numberOfChildren, attendeeNames } = req.body;

      // Either eventId or subEventId must be provided
      if ((!eventId && !subEventId) || !email || !name || !phone) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Support both new format (numberOfAdults, numberOfChildren) and legacy format (numberOfGuests)
      let adults: number;
      let children: number;

      if (numberOfAdults !== undefined) {
        adults = parseInt(numberOfAdults) || 0;
        children = parseInt(numberOfChildren) || 0;
      } else if (numberOfGuests !== undefined) {
        // Legacy format: assume all guests are adults
        adults = parseInt(numberOfGuests) || 0;
        children = 0;
      } else {
        res.status(400).json({ error: 'Number of adults is required' });
        return;
      }

      if (adults < 0) {
        res.status(400).json({ error: 'Number of adults cannot be negative' });
        return;
      }

      // Validate attendeeNames if provided
      const totalAttendees = adults + children;
      
      // Validate that at least one attendee is entered
      if (totalAttendees === 0) {
        res.status(400).json({ error: 'At least one attendee must be entered' });
        return;
      }
      if (attendeeNames && Array.isArray(attendeeNames)) {
        const validNames = attendeeNames.filter((n: string) => n && n.trim() !== '');
        if (validNames.length !== totalAttendees) {
          res.status(400).json({ error: `Please provide names for all ${totalAttendees} attendees` });
          return;
        }

        // Check for duplicate names (case-insensitive, trimmed)
        const nameMap = new Map<string, number>();
        for (let i = 0; i < validNames.length; i++) {
          const trimmedName = validNames[i].trim().toLowerCase();
          if (nameMap.has(trimmedName)) {
            res.status(400).json({ error: 'All attendee names must be unique. Please use different names for each attendee.' });
            return;
          }
          nameMap.set(trimmedName, i);
        }
      }

      const rsvp = await this.rsvpService.createRSVP({
        eventId: eventId || undefined,
        subEventId: subEventId || undefined,
        userId: req.user?.userId,
        email,
        name,
        phone,
        numberOfAdults: adults,
        numberOfChildren: children,
        attendeeNames: attendeeNames && Array.isArray(attendeeNames) ? attendeeNames : undefined,
      });

      res.status(201).json(rsvp);
    } catch (error: any) {
      // Check if it's a duplicate RSVP error
      if (error.message && error.message.includes('already RSVP')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to create RSVP' });
    }
  }

  async updateRSVP(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const rsvp = await this.rsvpService.updateRSVP(id, updates);
      if (!rsvp) {
        res.status(404).json({ error: 'RSVP not found' });
        return;
      }

      res.json(rsvp);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update RSVP' });
    }
  }

  async cancelRSVP(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rsvp = await this.rsvpService.cancelRSVP(id);
      if (!rsvp) {
        res.status(404).json({ error: 'RSVP not found' });
        return;
      }

      res.json(rsvp);
    } catch (error) {
      res.status(500).json({ error: 'Failed to cancel RSVP' });
    }
  }

  async deleteRSVP(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.rsvpService.deleteRSVP(id);
      if (!success) {
        res.status(404).json({ error: 'RSVP not found' });
        return;
      }

      res.json({ message: 'RSVP deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete RSVP' });
    }
  }
}

