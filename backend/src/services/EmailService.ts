import nodemailer from 'nodemailer';
import { UserDataHelper } from '../data/UserDataHelper.js';
import { SettingsDataHelper } from '../data/SettingsDataHelper.js';
import { SeatBooking } from '../models/types.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatPaymentDeadline(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function renderBookingLineItems(
  booking: SeatBooking,
  totalLabel: string,
  subEventNames: Record<string, string> = {}
): string {
  // Group seats sub-event-wise; entire-event seats fall under "Entire Event".
  const seatGroups = new Map<string, { heading: string; seats: typeof booking.seats_detail }>();
  for (const seat of booking.seats_detail ?? []) {
    const key = seat.sub_event_id ?? '__entire__';
    if (!seatGroups.has(key)) {
      const heading = seat.sub_event_id
        ? (subEventNames[seat.sub_event_id] || seat.map_name || 'Sub-event')
        : 'Entire Event';
      seatGroups.set(key, { heading, seats: [] });
    }
    seatGroups.get(key)!.seats.push(seat);
  }
  const seatLines = [...seatGroups.values()].map(group => {
    const headingRow = `
        <tr>
          <td colspan="2" style="padding:14px 0 4px;font-weight:700;font-size:13px;color:#111827;text-transform:uppercase;letter-spacing:0.03em;">
            ${escapeHtml(group.heading)}
          </td>
        </tr>`;
    const rows = group.seats.map(seat => {
      const audience =
        seat.audience_type === 'child'
          ? ' · Child'
          : seat.audience_type === 'adult'
            ? ' · Adult'
            : '';
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;">
            ${escapeHtml(seat.label)}
            <span style="color:#9ca3af;">(${escapeHtml(seat.category_name)}${audience})</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;">${usd(seat.price)}</td>
        </tr>`;
    }).join('');
    return headingRow + rows;
  }).join('');

  const hasMeals = (booking.meals_detail ?? []).length > 0 || (booking.food_addons_detail ?? []).length > 0;
  const mealHeadingRow = hasMeals
    ? `
        <tr>
          <td colspan="2" style="padding:14px 0 4px;font-weight:700;font-size:13px;color:#111827;text-transform:uppercase;letter-spacing:0.03em;">
            Meals
          </td>
        </tr>`
    : '';

  const mealLines = (booking.meals_detail ?? []).map(meal => {
    const qtyParts = [
      meal.adult_qty > 0 ? `${meal.adult_qty} adult` : '',
      meal.child_qty > 0 ? `${meal.child_qty} child` : '',
    ].filter(Boolean).join(', ');
    return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;">
            ${escapeHtml(meal.label)} — ${meal.meal_type}
            ${qtyParts ? `<span style="color:#9ca3af;"> · ${escapeHtml(qtyParts)}</span>` : ''}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;">${usd(meal.line_total)}</td>
        </tr>`;
  }).join('');

  const foodLines = (booking.food_addons_detail ?? []).map(addon => {
    const qtyParts = [
      addon.adult_qty > 0 ? `${addon.adult_qty} adult` : '',
      addon.child_qty > 0 ? `${addon.child_qty} child` : '',
    ].filter(Boolean).join(', ');
    return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;">
            ${escapeHtml(addon.name)}
            ${qtyParts ? `<span style="color:#9ca3af;"> · ${escapeHtml(qtyParts)}</span>` : ''}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;">${usd(addon.line_total)}</td>
        </tr>`;
  }).join('');

  const discountRow =
    booking.discount_amount > 0
      ? `
        <tr>
          <td style="padding:8px 0;color:#15803d;">Promo discount (${escapeHtml(booking.discount_code ?? '')})</td>
          <td style="padding:8px 0;text-align:right;color:#15803d;">−${usd(booking.discount_amount)}</td>
        </tr>`
      : '';

  return `
                ${seatLines}
                ${mealHeadingRow}
                ${mealLines}
                ${foodLines}
                ${discountRow}
                <tr>
                  <td style="padding:12px 0 0;font-weight:bold;font-size:16px;color:#111827;">${escapeHtml(totalLabel)}</td>
                  <td style="padding:12px 0 0;font-weight:bold;font-size:16px;text-align:right;color:#111827;">${usd(booking.total)}</td>
                </tr>`;
}

function bookingEmailShell(
  headline: string,
  eventContext: string,
  headerGradient: string,
  borderColor: string,
  bodyHtml: string
): string {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${headline}</title>
        </head>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f3f4f6;">
          <div style="max-width:600px;margin:0 auto;padding:24px;">
            <div style="background:${headerGradient};color:white;padding:28px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;font-size:24px;">${headline}</h1>
              <p style="margin:8px 0 0;font-size:16px;opacity:0.95;">${eventContext}</p>
            </div>
            <div style="background:#ffffff;padding:28px;border-radius:0 0 12px 12px;border:1px solid ${borderColor};border-top:none;">
              ${bodyHtml}
            </div>
            <p style="text-align:center;margin-top:20px;color:#6b7280;font-size:12px;">Sanhoti — Bengali Association of Orange County</p>
          </div>
        </body>
      </html>
    `;
}

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

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: {
      bcc?: string[];
      attachments?: Array<{
        filename: string;
        content: Buffer;
        cid?: string;
        contentType?: string;
      }>;
    }
  ): Promise<void> {
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

      if (options?.bcc && options.bcc.length > 0) {
        mailOptions.bcc = options.bcc;
      }

      if (options?.attachments?.length) {
        mailOptions.attachments = options.attachments.map(item => ({
          filename: item.filename,
          content: item.content,
          cid: item.cid,
          contentType: item.contentType,
        }));
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
    await this.sendEmail(to, subject, html, { bcc });
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

  generateBookingConfirmationHTML(
    booking: SeatBooking,
    payment: { zelle_phone?: string } = {},
    includeQrImage = false,
    subEventNames: Record<string, string> = {}
  ): string {
    const isMealsOnly =
      booking.seat_ids.length === 0 && (booking.meals_detail?.length ?? 0) > 0;
    const headline = isMealsOnly ? 'Meals reserved!' : 'Seats reserved!';
    const name = escapeHtml(booking.name);
    const eventContext = escapeHtml(booking.event_context || 'Sanhoti event');
    const bookingId = escapeHtml(booking.booking_id);
    const lineItems = renderBookingLineItems(booking, 'Total due', subEventNames);

    const zellePhone = payment.zelle_phone ? escapeHtml(payment.zelle_phone) : '';
    const paymentBlock = zellePhone
      ? `Please pay <strong>${usd(booking.total)}</strong> via Zelle to <strong>${zellePhone}</strong> with your Booking ID <strong>${bookingId}</strong> in the memo.`
      : `Please pay <strong>${usd(booking.total)}</strong> via Zelle with your Booking ID <strong>${bookingId}</strong> in the memo.`;

    const deadlineBlock = booking.payment_due_at
      ? `<p style="margin:12px 0 0;color:#b45309;font-weight:600;">Pay by ${escapeHtml(formatPaymentDeadline(booking.payment_due_at))} or your reservation will lapse.</p>`
      : '';

    const qrBlock = includeQrImage
      ? `
                <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #fde68a;">
                  <p style="margin:0 0 8px;font-size:13px;color:#374151;font-weight:600;">Send Money with Zelle®</p>
                  <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Scan in your banking app to pay</p>
                  <img src="cid:payment-qr" alt="Zelle payment QR code" width="220" style="max-width:220px;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;" />
                </div>`
      : '';

    return bookingEmailShell(
      headline,
      eventContext,
      'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
      '#fde68a',
      `
              <p style="margin:0 0 8px;">Hi ${name},</p>
              <p style="margin:0 0 16px;">Thank you for your reservation. Your booking is held as <strong>pending payment</strong> until we receive your Zelle transfer.</p>
              <p style="margin:0 0 20px;font-size:15px;">
                Booking ID: <strong style="font-family:monospace;font-size:16px;">${bookingId}</strong><br />
                <span style="color:#6b7280;font-size:13px;">Save this ID — you'll need it for any questions about your booking.</span>
              </p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
                ${lineItems}
              </table>
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-top:8px;">
                <h2 style="margin:0 0 8px;font-size:16px;color:#111827;">Complete your payment</h2>
                <p style="margin:0;font-size:14px;color:#374151;">${paymentBlock}</p>
                <p style="margin:8px 0 0;font-size:14px;color:#374151;">We'll confirm your booking once payment is received.</p>
                ${deadlineBlock}
                ${qrBlock}
              </div>`
    );
  }

  generateBookingPaidHTML(
    booking: SeatBooking,
    includeAdmissionQr = false,
    subEventNames: Record<string, string> = {}
  ): string {
    const isMealsOnly =
      booking.seat_ids.length === 0 && (booking.meals_detail?.length ?? 0) > 0;
    const headline = isMealsOnly ? 'Meals confirmed!' : 'Booking confirmed!';
    const name = escapeHtml(booking.name);
    const eventContext = escapeHtml(booking.event_context || 'Sanhoti event');
    const bookingId = escapeHtml(booking.booking_id);
    const lineItems = renderBookingLineItems(booking, 'Total paid', subEventNames);

    const admissionQrBlock = includeAdmissionQr
      ? `
              <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:16px;margin-top:16px;text-align:center;">
                <h2 style="margin:0 0 8px;font-size:16px;color:#111827;">Your event-day admission QR</h2>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;">Show this QR at the venue entrance on event day. Our team will scan it to check you in.</p>
                <img src="cid:admission-qr" alt="Event admission QR code" width="240" style="max-width:240px;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;" />
                <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Save or screenshot this email — you'll need the QR at the gate.</p>
              </div>`
      : '';

    return bookingEmailShell(
      headline,
      eventContext,
      'linear-gradient(135deg,#059669 0%,#047857 100%)',
      '#6ee7b7',
      `
              <p style="margin:0 0 8px;">Hi ${name},</p>
              <p style="margin:0 0 16px;">Great news — your payment has been received and your booking is <strong>confirmed</strong>.</p>
              <p style="margin:0 0 20px;font-size:15px;">
                Booking ID: <strong style="font-family:monospace;font-size:16px;">${bookingId}</strong>
              </p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
                ${lineItems}
              </table>
              ${admissionQrBlock}`
    );
  }

  generateBookingExtendedHTML(
    booking: SeatBooking,
    payment: { zelle_phone?: string } = {}
  ): string {
    const name = escapeHtml(booking.name);
    const eventContext = escapeHtml(booking.event_context || 'Sanhoti event');
    const bookingId = escapeHtml(booking.booking_id);
    const lineItems = renderBookingLineItems(booking, 'Total due');
    const zellePhone = payment.zelle_phone ? escapeHtml(payment.zelle_phone) : '';
    const paymentBlock = zellePhone
      ? `Please pay <strong>${usd(booking.total)}</strong> via Zelle to <strong>${zellePhone}</strong> with your Booking ID <strong>${bookingId}</strong> in the memo.`
      : `Please pay <strong>${usd(booking.total)}</strong> via Zelle with your Booking ID <strong>${bookingId}</strong> in the memo.`;
    const deadlineBlock = booking.payment_due_at
      ? `<p style="margin:12px 0 0;color:#b45309;font-weight:600;">Your new payment deadline is ${escapeHtml(formatPaymentDeadline(booking.payment_due_at))}.</p>`
      : '';

    return bookingEmailShell(
      'Payment deadline extended',
      eventContext,
      'linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)',
      '#bfdbfe',
      `
              <p style="margin:0 0 8px;">Hi ${name},</p>
              <p style="margin:0 0 16px;">We've extended your payment window. Your reservation is still held as <strong>pending payment</strong>.</p>
              <p style="margin:0 0 20px;font-size:15px;">
                Booking ID: <strong style="font-family:monospace;font-size:16px;">${bookingId}</strong>
              </p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
                ${lineItems}
              </table>
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin-top:8px;">
                <h2 style="margin:0 0 8px;font-size:16px;color:#111827;">Complete your payment</h2>
                <p style="margin:0;font-size:14px;color:#374151;">${paymentBlock}</p>
                ${deadlineBlock}
              </div>`
    );
  }

  generateBookingCancelledHTML(booking: SeatBooking, seatsReleased = false): string {
    const name = escapeHtml(booking.name);
    const eventContext = escapeHtml(booking.event_context || 'Sanhoti event');
    const bookingId = escapeHtml(booking.booking_id);
    const lineItems = renderBookingLineItems(booking, 'Order total');

    return bookingEmailShell(
      'Booking cancelled',
      eventContext,
      'linear-gradient(135deg,#6b7280 0%,#4b5563 100%)',
      '#d1d5db',
      `
              <p style="margin:0 0 8px;">Hi ${name},</p>
              <p style="margin:0 0 16px;">Your booking has been <strong>cancelled</strong>${seatsReleased ? ' and your seats have been released' : ''}.</p>
              <p style="margin:0 0 20px;font-size:15px;">
                Booking ID: <strong style="font-family:monospace;font-size:16px;">${bookingId}</strong>
              </p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
                ${lineItems}
              </table>
              <p style="margin:0;font-size:14px;color:#374151;">If you believe this was a mistake or you'd like to book again, please contact us or visit our website.</p>`
    );
  }
}

