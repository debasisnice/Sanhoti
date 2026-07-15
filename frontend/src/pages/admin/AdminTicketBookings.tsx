import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { ticketingAPI, SeatBooking, BookingStatus } from '../../services/api';

const usd = (n: number) => `$${n.toFixed(2)}`;

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-600',
  expired: 'bg-orange-100 text-orange-800',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const BOOKINGS_PAGE_SIZE = 10;

function formatPaymentCountdown(dueAt: string): string {
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return 'Payment window lapsed';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `expires in ${days}d ${remHours}h`;
  }
  return `expires in ${hours}h ${minutes}m`;
}

export default function AdminTicketBookings() {
  const [bookings, setBookings] = useState<SeatBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [markPaidBooking, setMarkPaidBooking] = useState<SeatBooking | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [bookingPage, setBookingPage] = useState(1);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await ticketingAPI.listBookings());
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const changeBookingStatus = async (booking: SeatBooking, status: BookingStatus) => {
    const verb = status === 'cancelled' ? 'cancel' : status;
    if (!window.confirm(`Are you sure you want to ${verb} booking ${booking.booking_id} (${booking.name})?`)) return;
    try {
      const updated = await ticketingAPI.setBookingStatus(booking.booking_id, status);
      setBookings(prev => prev.map(b => (b.booking_id === updated.booking_id ? updated : b)));
      if (status === 'cancelled' && booking.seat_ids.length > 0) {
        toast.success('Booking cancelled — seats released for others');
      } else {
        toast.success(`Booking ${STATUS_LABELS[status].toLowerCase()}`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update booking');
    }
  };

  const openMarkPaid = (booking: SeatBooking) => {
    setMarkPaidBooking(booking);
    setPaymentReference(booking.payment_reference ?? '');
  };

  const submitMarkPaid = async () => {
    if (!markPaidBooking) return;
    try {
      const updated = await ticketingAPI.setBookingStatus(
        markPaidBooking.booking_id,
        'confirmed',
        paymentReference.trim() || undefined
      );
      setBookings(prev => prev.map(b => (b.booking_id === updated.booking_id ? updated : b)));
      toast.success(
        markPaidBooking.status === 'expired' ? 'Booking revived and confirmed' : 'Booking confirmed'
      );
      setMarkPaidBooking(null);
      setPaymentReference('');
    } catch (error: any) {
      const seats: string[] = error?.response?.data?.conflicting_seats ?? [];
      if (error?.response?.status === 409 && seats.length > 0) {
        toast.error(`Cannot revive — seats taken: ${seats.join(', ')}`);
      } else {
        toast.error(error?.response?.data?.error || 'Failed to confirm booking');
      }
    }
  };

  const extendBookingPayment = async (booking: SeatBooking) => {
    try {
      const updated = await ticketingAPI.extendBookingPayment(booking.booking_id, 24);
      setBookings(prev => prev.map(b => (b.booking_id === updated.booking_id ? updated : b)));
      toast.success('Payment window extended by 24 hours');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to extend booking');
    }
  };

  const resendTicket = async (booking: SeatBooking) => {
    if (!window.confirm(`Re-send the admission ticket email to ${booking.email}?`)) return;
    try {
      await ticketingAPI.resendTicket(booking.booking_id);
      toast.success('Admission ticket email sent');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to send ticket');
    }
  };

  const deleteBooking = async (booking: SeatBooking) => {
    if (!window.confirm(`Permanently delete cancelled booking ${booking.booking_id} (${booking.name})? This cannot be undone.`)) {
      return;
    }
    try {
      await ticketingAPI.deleteBooking(booking.booking_id);
      setBookings(prev => prev.filter(b => b.booking_id !== booking.booking_id));
      toast.success('Booking deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete booking');
    }
  };

  const filteredBookings = useMemo(
    () => bookings.filter(b => statusFilter === 'all' || b.status === statusFilter),
    [bookings, statusFilter]
  );

  const bookingPageCount = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PAGE_SIZE));

  useEffect(() => {
    setBookingPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (bookingPage > bookingPageCount) setBookingPage(bookingPageCount);
  }, [bookingPage, bookingPageCount]);

  const paginatedBookings = useMemo(() => {
    const start = (bookingPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredBookings.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filteredBookings, bookingPage]);

  const bookingRangeStart =
    filteredBookings.length === 0 ? 0 : (bookingPage - 1) * BOOKINGS_PAGE_SIZE + 1;
  const bookingRangeEnd = Math.min(bookingPage * BOOKINGS_PAGE_SIZE, filteredBookings.length);
  const pendingCount = bookings.filter(b => b.status === 'pending_payment').length;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary-600" />
            Ticket Bookings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Confirm payments, extend deadlines, resend tickets, and cancel bookings.
            {pendingCount > 0 && (
              <span className="ml-1 font-medium text-amber-700">{pendingCount} pending payment.</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBookings()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending_payment', 'confirmed', 'expired', 'cancelled'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {loading && bookings.length === 0 ? (
          <p className="text-gray-500 text-sm">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <p className="text-gray-500 text-sm">No bookings yet.</p>
        ) : filteredBookings.length === 0 ? (
          <p className="text-gray-500 text-sm">No bookings match this filter.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">
              Showing {bookingRangeStart}–{bookingRangeEnd} of {filteredBookings.length} booking
              {filteredBookings.length === 1 ? '' : 's'}
              {statusFilter !== 'all' ? ` (${STATUS_LABELS[statusFilter]})` : ''}
            </p>
            <div className="space-y-3">
              {paginatedBookings.map(b => (
                <div key={b.booking_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900">
                        <span className="font-mono">{b.booking_id}</span> — {b.name}
                        <span
                          className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status]}`}
                        >
                          {STATUS_LABELS[b.status]}
                        </span>
                      </p>
                      {b.event_context && (
                        <p className="text-sm text-primary-700 font-medium">{b.event_context}</p>
                      )}
                      <p className="text-sm text-gray-600">
                        {b.email} · {b.phone} · {new Date(b.created_at).toLocaleString()}
                      </p>
                      {b.status === 'pending_payment' && b.payment_due_at && (
                        <p className="text-sm text-amber-700 font-medium mt-1">
                          Payment {formatPaymentCountdown(b.payment_due_at)} (
                          {new Date(b.payment_due_at).toLocaleString()})
                        </p>
                      )}
                      {b.status === 'expired' && b.payment_due_at && (
                        <p className="text-sm text-orange-700 mt-1">
                          Lapsed {new Date(b.payment_due_at).toLocaleString()}
                        </p>
                      )}
                      {b.payment_reference && (
                        <p className="text-sm text-gray-600 mt-1">
                          Payment ref: <span className="font-mono">{b.payment_reference}</span>
                        </p>
                      )}
                      {b.seats_detail.length > 0 && (
                        <p className="text-sm text-gray-700 mt-1">
                          {b.seats_detail.map(s => `${s.map_name ? `${s.map_name} — ` : ''}${s.label}`).join('; ')}
                        </p>
                      )}
                      {(b.food_addons_detail ?? []).length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Food: {(b.food_addons_detail ?? []).map(f =>
                            `${f.name} (${f.adult_qty}A${f.child_qty ? `/${f.child_qty}C` : ''})`
                          ).join('; ')}
                        </p>
                      )}
                      {(b.meals_detail ?? []).length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Meals: {(b.meals_detail ?? []).map(m =>
                            `${m.label} ${m.meal_type} (${m.adult_qty}A/${m.child_qty}C)`
                          ).join('; ')}
                        </p>
                      )}
                      <p className="text-sm text-gray-900 font-medium mt-1">
                        Total {usd(b.total)}
                        {b.discount_code && (
                          <span className="text-green-700 font-normal">
                            {' '}(code {b.discount_code}, −{usd(b.discount_amount)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(b.status === 'pending_payment' || b.status === 'expired') && (
                        <button
                          type="button"
                          onClick={() => openMarkPaid(b)}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700"
                        >
                          Mark Paid
                        </button>
                      )}
                      {b.status === 'pending_payment' && (
                        <button
                          type="button"
                          onClick={() => extendBookingPayment(b)}
                          className="border border-amber-400 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-50"
                        >
                          Extend +24h
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => resendTicket(b)}
                          className="border border-primary-300 text-primary-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-50"
                        >
                          {b.admission_qr_token ? 'Resend ticket' : 'Send ticket'}
                        </button>
                      )}
                      {b.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => changeBookingStatus(b, 'cancelled')}
                          className="border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                      {b.status === 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => void deleteBooking(b)}
                          className="inline-flex items-center gap-1 border border-gray-400 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {bookingPageCount > 1 && (
              <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100 flex-wrap">
                <button
                  type="button"
                  disabled={bookingPage <= 1}
                  onClick={() => setBookingPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {bookingPage} of {bookingPageCount}
                </span>
                <button
                  type="button"
                  disabled={bookingPage >= bookingPageCount}
                  onClick={() => setBookingPage(p => Math.min(bookingPageCount, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {markPaidBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Mark booking paid</h3>
              <p className="text-sm text-gray-600 mb-4">
                {markPaidBooking.booking_id} — {markPaidBooking.name}
                {markPaidBooking.status === 'expired' && (
                  <span className="block text-orange-700 mt-1">
                    This booking expired — seats will be re-checked before confirming.
                  </span>
                )}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment reference (optional)
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Zelle confirmation # or note"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMarkPaidBooking(null);
                    setPaymentReference('');
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitMarkPaid()}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                >
                  Confirm payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
