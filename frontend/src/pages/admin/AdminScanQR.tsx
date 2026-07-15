import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, QrCode } from 'lucide-react';
import {
  eventsAPI,
  ticketingAPI,
  type AdmissionResult,
  type AdmissionScanResult,
  type CheckinGate,
  type CheckinStats,
} from '../../services/api';
import { Event } from '../../types';

interface Html5QrcodeInstance {
  start(
    camera: unknown,
    config: unknown,
    onSuccess: (decodedText: string) => void,
    onError: (message: unknown) => void
  ): Promise<void>;
  stop(): Promise<void>;
  clear(): void;
  pause(shouldPauseVideo?: boolean): void;
  resume(): void;
  getState?(): number;
}
type Html5QrcodeCtor = new (elementId: string, config?: { verbose?: boolean }) => Html5QrcodeInstance;

async function loadHtml5Qrcode(): Promise<Html5QrcodeCtor> {
  const mod = await import('html5-qrcode');
  return mod.Html5Qrcode as unknown as Html5QrcodeCtor;
}

const EVENT_STORAGE_KEY = 'sanhoti_checkin_event';
const GATE_STORAGE_KEY = 'sanhoti_checkin_gate';
const SCANNER_ELEMENT_ID = 'admission-qr-reader';
const DUPLICATE_WINDOW_MS = 3000;
const RESULT_HOLD_MS = 4000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Tone = 'green' | 'amber' | 'red';

const RESULT_META: Record<AdmissionResult, { tone: Tone; title: string; vibrate: number[] }> = {
  admitted: { tone: 'green', title: 'Admitted', vibrate: [120] },
  already_checked_in: { tone: 'amber', title: 'Already checked in', vibrate: [80, 60, 80] },
  over_capacity: { tone: 'red', title: 'Over capacity', vibrate: [200, 80, 200] },
  payment_pending: { tone: 'amber', title: 'Payment pending', vibrate: [80, 60, 80] },
  wrong_gate: { tone: 'red', title: 'Wrong gate', vibrate: [200, 80, 200] },
  cancelled: { tone: 'red', title: 'Booking cancelled', vibrate: [200, 80, 200] },
  expired: { tone: 'red', title: 'Booking expired', vibrate: [200, 80, 200] },
  not_found: { tone: 'red', title: 'Booking not found', vibrate: [200, 80, 200] },
  invalid_qr: { tone: 'red', title: 'Invalid QR', vibrate: [200, 80, 200] },
};

const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-green-50 border-green-500 text-green-900',
  amber: 'bg-amber-50 border-amber-500 text-amber-900',
  red: 'bg-red-50 border-red-500 text-red-900',
};

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function recentEvents(events: Event[]): Event[] {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return events
    .filter(event => {
      const end = Date.parse(event.event_end_dt);
      return Number.isFinite(end) && end >= cutoff;
    })
    .sort((a, b) => Date.parse(a.event_start_dt) - Date.parse(b.event_start_dt));
}

function groupGates(gates: CheckinGate[]): Map<string, CheckinGate[]> {
  const map = new Map<string, CheckinGate[]>();
  for (const gate of gates) {
    const list = map.get(gate.group) ?? [];
    list.push(gate);
    map.set(gate.group, list);
  }
  return map;
}

export default function AdminScanQR() {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;

  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState(() => {
    try {
      return sessionStorage.getItem(EVENT_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [gates, setGates] = useState<CheckinGate[]>([]);
  const [scope, setScope] = useState(() => {
    try {
      return sessionStorage.getItem(GATE_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<AdmissionScanResult | null>(null);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [manualId, setManualId] = useState('');
  const [lastPayload, setLastPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [admitQty, setAdmitQty] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastManual, setLastManual] = useState(false);

  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const lastScanRef = useRef<{ payload: string; scope: string; at: number }>({
    payload: '',
    scope: '',
    at: 0,
  });
  const processingRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eventOptions = useMemo(() => recentEvents(events), [events]);

  useEffect(() => {
    void eventsAPI.getAll().then(setEvents).catch(() => toast.error('Could not load events'));
  }, []);

  useEffect(() => {
    if (!eventId) {
      setGates([]);
      return;
    }
    void ticketingAPI
      .checkinGates(eventId)
      .then(res => {
        setGates(res.gates);
        setScope(prev => {
          if (prev && res.gates.some(g => g.scope === prev)) return prev;
          return res.gates[0]?.scope ?? '';
        });
      })
      .catch(() => toast.error('Could not load gates for this event'));
  }, [eventId]);

  useEffect(() => {
    try {
      if (eventId) sessionStorage.setItem(EVENT_STORAGE_KEY, eventId);
    } catch {
      /* ignore */
    }
  }, [eventId]);

  useEffect(() => {
    try {
      if (scope) sessionStorage.setItem(GATE_STORAGE_KEY, scope);
    } catch {
      /* ignore */
    }
  }, [scope]);

  const refreshStats = useCallback(async () => {
    if (!scope) return;
    try {
      setStats(await ticketingAPI.checkinStats(scope, eventId || undefined));
    } catch {
      /* non-fatal */
    }
  }, [scope, eventId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const vibrate = (pattern: number[]) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* no-op */
    }
  };

  const previewScan = useCallback(
    async (payload: string, manual: boolean) => {
      if (!scope) {
        toast.error('Select a gate first');
        return null;
      }
      setBusy(true);
      setLastPayload(payload);
      setLastManual(manual);
      try {
        const res = await ticketingAPI.scanAdmission(payload, scope, {
          dryRun: true,
          manual,
          eventId: eventId || undefined,
        });
        setResult(res);
        setAdmitQty(Math.max(1, res.remaining ?? 1));
        setCorrectCount(res.already ?? res.checked_in ?? 0);
        vibrate(RESULT_META[res.result].vibrate);
        return res;
      } catch {
        toast.error('Scan failed — please try again');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [scope, eventId]
  );

  const commitAdmit = async () => {
    if (!result || !lastPayload || !scope) return;
    setBusy(true);
    try {
      const res = await ticketingAPI.scanAdmission(lastPayload, scope, {
        manual: lastManual,
        admitQty,
        eventId: eventId || undefined,
      });
      setResult(res);
      setCorrectCount(res.checked_in ?? res.already ?? 0);
      vibrate(RESULT_META[res.result].vibrate);
      void refreshStats();
      if (res.result === 'admitted' && lastManual) setManualId('');
    } catch {
      toast.error('Could not admit — please try again');
    } finally {
      setBusy(false);
    }
  };

  const handleCorrect = async () => {
    if (!result?.booking || !scope) return;
    setBusy(true);
    try {
      const res = await ticketingAPI.correctCheckin(result.booking.booking_id, scope, correctCount);
      setResult(res);
      setAdmitQty(Math.max(1, res.remaining ?? 0));
      vibrate(RESULT_META[res.result].vibrate);
      void refreshStats();
      toast.success('Count updated');
    } catch {
      toast.error('Could not update count');
    } finally {
      setBusy(false);
    }
  };

  const handleDecode = useCallback(
    async (decodedText: string) => {
      const now = Date.now();
      if (processingRef.current) return;
      if (
        decodedText === lastScanRef.current.payload &&
        scope === lastScanRef.current.scope &&
        now - lastScanRef.current.at < DUPLICATE_WINDOW_MS
      ) {
        return;
      }
      lastScanRef.current = { payload: decodedText, scope, at: now };
      processingRef.current = true;

      const scanner = scannerRef.current;
      try {
        scanner?.pause(true);
      } catch {
        /* ignore */
      }

      const res = await previewScan(decodedText, false);

      // Actionable result (a real gate with capacity): keep the camera paused so
      // the admin can choose a quantity / correct the count without the next
      // guest's QR replacing it. It resumes on Admit, Correct, or Dismiss.
      if (res?.booking && (res.capacity ?? 0) > 0) {
        return;
      }

      // Terminal result (invalid QR, wrong gate, cancelled, …): auto-resume.
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        try {
          if (scannerRef.current?.getState?.() === 3) scannerRef.current.resume();
        } catch {
          /* ignore */
        }
        processingRef.current = false;
      }, RESULT_HOLD_MS);
    },
    [previewScan, scope]
  );

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    processingRef.current = false;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      /* already stopped */
    }
  }, []);

  const resumeScanning = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    processingRef.current = false;
    try {
      if (scannerRef.current?.getState?.() === 3) scannerRef.current.resume();
    } catch {
      /* ignore */
    }
  }, []);

  const resetScanSession = useCallback(() => {
    lastScanRef.current = { payload: '', scope: '', at: 0 };
    processingRef.current = false;
    setCameraOn(false);
    setResult(null);
    setLastPayload('');
    setLastManual(false);
    setAdmitQty(1);
    setCorrectCount(0);
  }, []);

  const handleGateChange = (nextScope: string) => {
    resetScanSession();
    setScope(nextScope);
  };

  const startCamera = useCallback(async () => {
    if (scannerRef.current || !secureContext) return;
    setStarting(true);
    try {
      const Html5Qrcode = await loadHtml5Qrcode();
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        text => {
          void handleDecode(text);
        },
        () => {
          /* per-frame decode failure — expected */
        }
      );
    } catch {
      scannerRef.current = null;
      setCameraOn(false);
      toast.error('Could not start the camera. Check camera permission and try again.');
    } finally {
      setStarting(false);
    }
  }, [handleDecode, secureContext]);

  useEffect(() => {
    if (cameraOn) void startCamera();
    else void stopCamera();
  }, [cameraOn, startCamera, stopCamera]);

  useEffect(() => () => {
    void stopCamera();
  }, [stopCamera]);

  const handleManualPreview = async () => {
    const id = manualId.trim();
    if (!id) return;
    await previewScan(id, true);
  };

  const meta = result ? RESULT_META[result.result] : null;
  const gateGroups = groupGates(gates);

  const showAdmitControls =
    Boolean(result?.booking) &&
    result?.result === 'admitted' &&
    (result.remaining ?? 0) > 0;

  const showCorrectControls = Boolean(result?.booking) && (result?.capacity ?? 0) > 0 && Boolean(scope);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="h-7 w-7 text-primary-600" />
            Scan QR
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Event-day admission check-in — select event and gate, then scan guest tickets.
          </p>
        </div>
        {stats && (
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-600">
              {stats.checked_in}
              <span className="text-gray-400 text-lg font-medium"> / {stats.total}</span>
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              people checked in ({stats.bookings_done}/{stats.bookings_total} bookings full)
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={eventId}
            onChange={e => setEventId(e.target.value)}
          >
            <option value="">Select event…</option>
            {eventOptions.map(event => (
              <option key={event.event_id} value={event.event_id}>
                {event.event_name}
                {event.year ? ` (${event.year})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gate</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={scope}
            onChange={e => handleGateChange(e.target.value)}
            disabled={!eventId || gates.length === 0}
          >
            {!gates.length && <option value="">No gates</option>}
            {[...gateGroups.entries()].map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map(gate => (
                  <option key={gate.scope} value={gate.scope}>
                    {gate.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {!secureContext && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>
            The camera needs a secure (HTTPS) connection. On <code>http://</code> the camera won't open —
            use the production site on your phone, or enter the booking ID manually below.
          </span>
        </div>
      )}

      {secureContext && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Camera</span>
            <button
              type="button"
              onClick={() => setCameraOn(on => !on)}
              disabled={starting || !scope}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                cameraOn
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {starting ? 'Starting…' : cameraOn ? 'Stop camera' : 'Start camera'}
            </button>
          </div>
          <div
            id={SCANNER_ELEMENT_ID}
            className={`mx-auto w-full max-w-sm overflow-hidden rounded-lg bg-gray-900 ${
              cameraOn ? '' : 'hidden'
            }`}
          />
          {!cameraOn && (
            <div className="mx-auto flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-gray-400">
              <span>Camera is off</span>
              {scope && (
                <span className="text-xs text-gray-500">Tap Start camera to scan at the selected gate</span>
              )}
            </div>
          )}
        </div>
      )}

      {result && meta && (
        <div className={`rounded-xl border-2 p-4 ${TONE_CLASSES[meta.tone]}`}>
          <div className="flex items-center gap-2">
            {meta.tone === 'green' ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : meta.tone === 'amber' ? (
              <AlertTriangle className="h-7 w-7" />
            ) : (
              <XCircle className="h-7 w-7" />
            )}
            <span className="text-xl font-bold">{meta.title}</span>
          </div>

          {result.gate_label && (
            <div className="mt-1 text-sm opacity-80">Gate: {result.gate_label}</div>
          )}

          {(result.result === 'invalid_qr' || result.result === 'not_found') && lastPayload && (
            <div className="mt-2 text-sm">
              <div className="opacity-80">
                {result.result === 'invalid_qr'
                  ? "This code isn't a Sanhoti admission ticket. Scan the QR from the “Booking confirmed” email."
                  : 'No booking matches this ticket.'}
              </div>
              <div className="mt-1 break-all rounded bg-white/60 px-2 py-1 font-mono text-xs">
                Scanned: {lastPayload}
              </div>
            </div>
          )}

          {result.booking && (
            <div className="mt-2 space-y-1 text-sm">
              <div className="text-base font-semibold">{result.booking.name}</div>
              <div className="opacity-80">{result.booking.event_context}</div>
              {result.capacity !== undefined && (
                <div className="font-medium">
                  {result.result === 'already_checked_in'
                    ? `Already checked in — ${result.already ?? 0}/${result.capacity}`
                    : `At this gate: ${result.already ?? 0}/${result.capacity} (${result.remaining ?? 0} remaining)`}
                </div>
              )}
              {result.booking.seat_count > 0 && (
                <div>
                  <div className="font-medium">Seats ({result.booking.seat_count}):</div>
                  {result.booking.seat_groups.map((group, gi) => (
                    <div key={gi} className="ml-1 mt-0.5">
                      <span className="font-semibold">{group.sub_event_name}:</span>{' '}
                      {group.seats
                        .map(s => `${s.label}${s.audience_type ? ` (${s.audience_type})` : ''}`)
                        .join(', ')}
                    </div>
                  ))}
                </div>
              )}
              {result.booking.meals_detail.length > 0 && (
                <div className="mt-1">
                  <span className="font-medium">Meals ({result.booking.meal_headcount}): </span>
                  {result.booking.meals_detail
                    .map(m => `${m.label} ${m.meal_type} — ${m.adult_qty}A/${m.child_qty}C`)
                    .join(', ')}
                </div>
              )}
              {result.result === 'already_checked_in' && result.booking.admission_checked_in_at && (
                <div className="text-xs opacity-80">
                  Last entry at {formatTime(result.booking.admission_checked_in_at)}
                </div>
              )}
              {result.gate_progress && result.gate_progress.length > 1 && (
                <div className="mt-2 rounded-lg bg-white/60 p-2 text-xs">
                  <div className="font-medium mb-1">All gates for this pass (same QR):</div>
                  <ul className="space-y-0.5">
                    {result.gate_progress.map(gate => (
                      <li key={gate.scope} className={gate.current ? 'font-semibold' : ''}>
                        {gate.label}: {gate.already}/{gate.capacity}
                        {gate.remaining === 0 ? ' — done' : ` — ${gate.remaining} remaining`}
                        {gate.current ? ' (this gate)' : ''}
                      </li>
                    ))}
                  </ul>
                  {result.result === 'already_checked_in' &&
                    result.gate_progress.some(gate => !gate.current && gate.remaining > 0) && (
                      <p className="mt-1.5 font-medium">
                        Fully checked in at this gate. Select another gate above, start the camera, and
                        scan the same QR again.
                      </p>
                    )}
                </div>
              )}
            </div>
          )}

          {showAdmitControls && (result.remaining ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">People entering now</label>
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={admitQty}
                  onChange={e => setAdmitQty(Number(e.target.value))}
                >
                  {Array.from({ length: result.remaining ?? 0 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void commitAdmit()}
                disabled={busy}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Admit {admitQty}
              </button>
            </div>
          )}

          {showCorrectControls && (
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/40 pt-3">
              <div>
                <label className="block text-xs font-medium mb-1">Correct count at gate</label>
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={correctCount}
                  onChange={e => setCorrectCount(Number(e.target.value))}
                >
                  {Array.from({ length: (result.capacity ?? 0) + 1 }, (_, i) => i).map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleCorrect()}
                disabled={busy}
                className="rounded-lg bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
              >
                Save count
              </button>
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                resumeScanning();
              }}
              className="text-sm font-medium underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Manual check-in</label>
        <p className="mb-2 text-xs text-gray-500">
          For a lost email or HTTP connection: enter the booking ID, preview, then admit.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleManualPreview();
            }}
            placeholder="Booking ID"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => void handleManualPreview()}
            disabled={busy || !manualId.trim() || !scope}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Look up
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
