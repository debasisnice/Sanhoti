import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { TicketingConflictError, TicketingService } from '../services/TicketingService.js';
import { BookingStatus } from '../models/types.js';
import { AuditService } from '../services/AuditService.js';

/** Messages from TicketingService are buyer/admin-facing validation errors. */
function status400(res: Response, error: unknown, fallback: string): void {
  if (error instanceof TicketingConflictError) {
    res.status(409).json({
      error: error.message,
      conflicting_seats: error.conflictingSeats,
    });
    return;
  }
  const message = error instanceof Error ? error.message : '';
  if (message) {
    res.status(400).json({ error: message });
  } else {
    res.status(500).json({ error: fallback });
  }
}

export class TicketingController {
  private ticketingService = new TicketingService();
  private auditService = new AuditService();

  // ------------------------------------------------------------- public

  /** Public config: active event, mapped sub-events, profile and all open maps. */
  async getPublicConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.getPublicConfig());
    } catch {
      res.status(500).json({ error: 'Failed to load booking configuration' });
    }
  }

  async getAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const unavailable = await this.ticketingService.getUnavailableSeats();
      res.json({ unavailable });
    } catch {
      res.status(500).json({ error: 'Failed to load seat availability' });
    }
  }

  async holdSeats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hold = await this.ticketingService.holdSeats(
        req.body?.seat_keys ?? req.body?.seat_ids,
        req.body?.category_id,
        req.body?.scope_sub_event_id,
        req.body?.adult_count,
        req.body?.child_count
      );
      res.status(201).json(hold);
    } catch (error) {
      status400(res, error, 'Failed to hold seats');
    }
  }

  async releaseHold(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.ticketingService.releaseHold(req.params.holdId);
      res.json({ released: true });
    } catch {
      res.status(500).json({ error: 'Failed to release hold' });
    }
  }

  async previewDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code } = req.body ?? {};
      const seatKeys = req.body?.seat_keys ?? req.body?.seat_ids;
      if (!code || !Array.isArray(seatKeys) || seatKeys.length === 0) {
        res.status(400).json({ error: 'code and seat_keys are required' });
        return;
      }
      const preview = await this.ticketingService.previewDiscount(String(code), seatKeys, {
        seat_audiences: req.body?.seat_audiences,
        scope_sub_event_id: req.body?.scope_sub_event_id,
        category_id: req.body?.category_id,
        adult_count: req.body?.adult_count,
        child_count: req.body?.child_count,
      });
      res.json(preview);
    } catch (error) {
      status400(res, error, 'Failed to validate discount');
    }
  }

  async previewMealsDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code, meal_selections, adult_count, child_count } = req.body ?? {};
      const preview = await this.ticketingService.previewMealsDiscountWithParty(
        String(code ?? ''),
        meal_selections,
        adult_count,
        child_count
      );
      res.json(preview);
    } catch (error) {
      status400(res, error, 'Failed to validate discount');
    }
  }

  async checkoutMeals(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, email, phone, discount_code, meal_selections, adult_count, child_count } = req.body ?? {};
      const result = await this.ticketingService.checkoutMeals({
        name,
        email,
        phone,
        discount_code,
        meal_selections,
        adult_count,
        child_count,
      });
      res.status(201).json(result);
    } catch (error) {
      status400(res, error, 'Failed to complete meal booking');
    }
  }

  async checkout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { hold_id, name, email, phone, discount_code, food_addons, adult_count, child_count, seat_audiences, scope_sub_event_id, category_id } = req.body ?? {};
      const result = await this.ticketingService.checkout({
        hold_id,
        name,
        email,
        phone,
        discount_code,
        food_addons,
        adult_count,
        child_count,
        seat_audiences,
        scope_sub_event_id,
        category_id,
      });
      res.status(201).json(result);
    } catch (error) {
      status400(res, error, 'Failed to complete booking');
    }
  }

  /** Buyer looks up their booking by id (shown on the confirmation screen). */
  async getBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const booking = await this.ticketingService.getBooking(req.params.id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json(booking);
    } catch {
      res.status(500).json({ error: 'Failed to load booking' });
    }
  }

  // -------------------------------------------------------------- admin

  async getAdminConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.getConfig());
    } catch {
      res.status(500).json({ error: 'Failed to load configuration' });
    }
  }

  async updateConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updated = await this.ticketingService.updateConfig(req.body ?? {});
      res.json(updated);
    } catch (error) {
      status400(res, error, 'Failed to update configuration');
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = String(req.query.event_id ?? '').trim();
      const profile = eventId
        ? await this.ticketingService.getProfile(eventId)
        : await this.ticketingService.getAdminProfile();
      if (!profile) {
        res.status(404).json({ error: 'Ticketing profile not found' });
        return;
      }
      res.json(profile);
    } catch {
      res.status(500).json({ error: 'Failed to load ticketing profile' });
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = String(req.body?.event_id ?? req.query.event_id ?? '');
      res.json(await this.ticketingService.updateProfile(eventId, req.body ?? {}));
    } catch (error) {
      status400(res, error, 'Failed to update ticketing profile');
    }
  }

  async listMaps(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = req.query.event_id ? String(req.query.event_id) : undefined;
      res.json(await this.ticketingService.listMaps(eventId));
    } catch {
      res.status(500).json({ error: 'Failed to load seat maps' });
    }
  }

  async createMap(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.status(201).json(await this.ticketingService.createMap(req.body ?? {}));
    } catch (error) {
      status400(res, error, 'Failed to create seat map');
    }
  }

  async updateMap(req: AuthRequest, res: Response): Promise<void> {
    try {
      const map = await this.ticketingService.updateMap(req.params.mapId, req.body ?? {});
      if (!map) {
        res.status(404).json({ error: 'Seat map not found' });
        return;
      }
      res.json(map);
    } catch (error) {
      status400(res, error, 'Failed to update seat map');
    }
  }

  async deleteMap(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!(await this.ticketingService.deleteMap(req.params.mapId))) {
        res.status(404).json({ error: 'Seat map not found' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      status400(res, error, 'Failed to delete seat map');
    }
  }

  async listMapTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.listMapTemplates());
    } catch {
      res.status(500).json({ error: 'Failed to load saved seat layouts' });
    }
  }

  async saveMapTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.saveMapTemplate(
        req.params.slot,
        req.body?.name,
        req.body?.map_id
      ));
    } catch (error) {
      status400(res, error, 'Failed to save seat layout');
    }
  }

  async deleteMapTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!(await this.ticketingService.deleteMapTemplate(req.params.slot))) {
        res.status(404).json({ error: 'Saved layout not found' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      status400(res, error, 'Failed to delete saved layout');
    }
  }

  async listHolds(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.getActiveHolds());
    } catch {
      res.status(500).json({ error: 'Failed to load holds' });
    }
  }

  async listBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.listBookings());
    } catch {
      res.status(500).json({ error: 'Failed to load bookings' });
    }
  }

  async setBookingStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const booking = await this.ticketingService.setBookingStatus(
        req.params.id,
        req.body?.status as BookingStatus,
        req.body?.payment_reference
      );
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json(booking);
    } catch (error) {
      status400(res, error, 'Failed to update booking');
    }
  }

  async deleteBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const deleted = await this.ticketingService.deleteBooking(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json({ deleted: true, booking_id: req.params.id });
    } catch (error) {
      status400(res, error, 'Failed to delete booking');
    }
  }

  async extendBookingPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hours = req.body?.hours === undefined ? 24 : Number(req.body.hours);
      const booking = await this.ticketingService.extendBookingPayment(req.params.id, hours);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json(booking);
    } catch (error) {
      status400(res, error, 'Failed to extend booking');
    }
  }

  async resendTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const booking = await this.ticketingService.resendAdmissionTicket(req.params.id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json({ resent: true, booking_id: booking.booking_id, email: booking.email });
    } catch (error) {
      status400(res, error, 'Failed to resend ticket');
    }
  }

  /**
   * Validate a scanned admission QR and (unless dry_run) check the party in.
   * Always HTTP 200 with a structured result. Audited manually so the QR
   * payload (an admission secret) never lands in the audit trail.
   */
  async scanAdmission(req: AuthRequest, res: Response): Promise<void> {
    try {
      const admitQty = req.body?.admit_qty;
      const result = await this.ticketingService.scanAdmission(
        req.body?.payload,
        req.body?.scope,
        {
          dryRun: req.body?.dry_run === true,
          manual: req.body?.manual === true,
          ...(admitQty !== undefined && admitQty !== null ? { admitQty: Number(admitQty) } : {}),
          ...(req.body?.event_id ? { eventId: String(req.body.event_id) } : {}),
        }
      );
      res.json(result);
      if (req.user && req.body?.dry_run !== true && result.admitted_now !== undefined) {
        void this.auditService
          .logAction({
            userId: req.user.userId,
            action: 'UPDATE',
            resource: 'admission-checkin',
            resourceId: result.booking?.booking_id,
            details: {
              method: req.method,
              path: req.path,
              result: result.result,
              scope: String(req.body?.scope ?? 'event'),
              admitted_now: result.admitted_now,
              manual: req.body?.manual === true,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
          })
          .catch(err => console.error('Audit log error:', err));
      }
    } catch (error) {
      status400(res, error, 'Failed to scan admission QR');
    }
  }

  async correctCheckin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const bookingId = String(req.body?.booking_id ?? '').trim();
      if (!bookingId) {
        res.status(400).json({ error: 'booking_id is required' });
        return;
      }
      const result = await this.ticketingService.setGateCheckin(
        bookingId,
        req.body?.scope,
        req.body?.count
      );
      if (!result) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json(result);
    } catch (error) {
      status400(res, error, 'Failed to correct check-in');
    }
  }

  async checkinStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(
        await this.ticketingService.checkinStats(req.query.scope, req.query.event_id)
      );
    } catch {
      res.status(500).json({ error: 'Failed to load check-in stats' });
    }
  }

  async listCheckinGates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = String(req.query.event_id ?? '').trim();
      if (!eventId) {
        res.status(400).json({ error: 'event_id is required' });
        return;
      }
      res.json(await this.ticketingService.listCheckinGates(eventId));
    } catch {
      res.status(500).json({ error: 'Failed to load check-in gates' });
    }
  }

  async getTicketStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = String(req.query.event_id ?? '').trim();
      if (!eventId) {
        res.status(400).json({ error: 'event_id is required' });
        return;
      }
      const scope = String(req.query.scope ?? '').trim() || undefined;
      res.json(await this.ticketingService.getTicketStats(eventId, scope));
    } catch (error) {
      status400(res, error, 'Failed to load ticket stats');
    }
  }

  async listDiscounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.ticketingService.listDiscounts());
    } catch {
      res.status(500).json({ error: 'Failed to load discounts' });
    }
  }

  async createDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.status(201).json(await this.ticketingService.createDiscount(req.body ?? {}));
    } catch (error) {
      status400(res, error, 'Failed to create discount');
    }
  }

  async updateDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updated = await this.ticketingService.updateDiscount(req.params.id, req.body ?? {});
      if (!updated) {
        res.status(404).json({ error: 'Discount not found' });
        return;
      }
      res.json(updated);
    } catch (error) {
      status400(res, error, 'Failed to update discount');
    }
  }

  async deleteDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ok = await this.ticketingService.deleteDiscount(req.params.id);
      if (!ok) {
        res.status(404).json({ error: 'Discount not found' });
        return;
      }
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete discount' });
    }
  }
}
