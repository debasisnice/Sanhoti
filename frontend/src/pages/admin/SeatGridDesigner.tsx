import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Grid3X3, Paintbrush, RefreshCw } from 'lucide-react';
import {
  SeatCategory,
  SeatMap,
  SeatingSection,
  SeatBooking,
  SeatPosition,
  UnavailableSeats,
} from '../../services/api';

/**
 * Movie-theater style seat grid designer.
 *
 * The venue is a rows × cols grid with the STAGE on top. The admin paints
 * cells with tools: Seat (with a category), Passage (blank aisle/gap),
 * Block, Unblock. Click paints one cell; click-and-drag paints many.
 *
 * Every seat is stored as its own 1×1 section (stable id), positioned by
 * cell: seat_positions[seatId] = { x: column, y: row }. Labels are
 * "A1, A2…" per row (A = row nearest the stage), counting seats only —
 * passages don't consume numbers.
 */

export interface GridSeat {
  sid: string;
  name?: string;
  row: number; // 1-based, row 1 nearest the stage
  col: number; // 1-based
  category_id: string;
}

export function newSid(): string {
  return `S${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export function rowLetter(row: number): string {
  let label = '';
  let n = row;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** Read seats + blocked list out of a saved config (per-seat sections only). */
export function seatsFromConfig(config: Pick<SeatMap, 'sections' | 'seat_positions' | 'blocked_seats'>): { seats: GridSeat[]; blockedSids: string[] } {
  const seats: GridSeat[] = [];
  const blockedSids: string[] = [];
  const positions = config.seat_positions ?? {};
  const blocked = new Set(config.blocked_seats ?? []);
  for (const s of config.sections) {
    if (s.rows !== 1 || s.seats_per_row !== 1) continue; // legacy grid sections aren't editable here
    const pos = positions[`${s.section_id}:1:1`];
    if (!pos) continue;
    seats.push({
      sid: s.section_id,
      name: s.name,
      row: Math.round(pos.y),
      col: Math.round(pos.x),
      category_id: s.category_id,
    });
    if (blocked.has(`${s.section_id}:1:1`)) blockedSids.push(s.section_id);
  }
  return { seats, blockedSids };
}

export interface MatrixLayoutPayload {
  layout_mode: 'matrix';
  matrix: { rows: number; cols: number };
  sections: SeatingSection[];
  seat_positions: Record<string, SeatPosition>;
  blocked_seats: string[];
}

/** Build the config payload: row-letter labels count seats only, left→right. */
export function buildMatrixLayout(
  seats: GridSeat[],
  blockedSids: string[],
  rows: number,
  cols: number
): MatrixLayoutPayload {
  const sorted = [...seats].sort((a, b) => a.row - b.row || a.col - b.col);
  const sections: SeatingSection[] = [];
  const seat_positions: Record<string, SeatPosition> = {};
  let currentRow = 0;
  let numInRow = 0;
  for (const seat of sorted) {
    if (seat.row !== currentRow) {
      currentRow = seat.row;
      numInRow = 0;
    }
    numInRow++;
    sections.push({
      section_id: seat.sid,
      name: `${rowLetter(seat.row)}${numInRow}`,
      rows: 1,
      seats_per_row: 1,
      category_id: seat.category_id,
    });
    seat_positions[`${seat.sid}:1:1`] = { x: seat.col, y: seat.row };
  }
  const sids = new Set(seats.map(s => s.sid));
  return {
    layout_mode: 'matrix',
    matrix: { rows, cols },
    sections,
    seat_positions,
    blocked_seats: blockedSids.filter(sid => sids.has(sid)).map(sid => `${sid}:1:1`),
  };
}

type Tool = 'seat' | 'passage' | 'block' | 'unblock';

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
};

export default function SeatGridDesigner({
  mapId,
  categories,
  seats,
  setSeats,
  blockedSids,
  setBlockedSids,
  dims,
  setDims,
  unavailable,
  bookedBy,
  saving,
  onSave,
  onRefresh,
}: {
  mapId: string;
  categories: SeatCategory[];
  seats: GridSeat[];
  setSeats: (s: GridSeat[]) => void;
  blockedSids: string[];
  setBlockedSids: (b: string[]) => void;
  dims: { rows: number; cols: number };
  setDims: (d: { rows: number; cols: number }) => void;
  unavailable: UnavailableSeats;
  bookedBy: Record<string, SeatBooking>;
  saving: boolean;
  onSave: (payload: MatrixLayoutPayload) => void;
  onRefresh: () => void;
}) {
  const [tool, setTool] = useState<Tool>('seat');
  const [activeCategory, setActiveCategory] = useState(categories[0]?.category_id ?? '');
  const painting = useRef(false);

  const catById = useMemo(() => {
    const m: Record<string, SeatCategory> = {};
    for (const c of categories) m[c.category_id] = c;
    return m;
  }, [categories]);

  const seatAt = useMemo(() => {
    const m: Record<string, GridSeat> = {};
    for (const s of seats) m[`${s.row}:${s.col}`] = s;
    return m;
  }, [seats]);

  const seatState = (seat: GridSeat) => {
    const innerSeatId = `${seat.sid}:1:1`;
    const seatId = `${mapId}|${innerSeatId}`;
    return {
      booking: bookedBy[seatId] ?? bookedBy[innerSeatId],
      held: unavailable[seatId] === 'held',
      blocked: blockedSids.includes(seat.sid),
    };
  };

  /** Apply the current tool to one cell (used by click and drag-paint). */
  const paintCell = (row: number, col: number) => {
    const existing = seatAt[`${row}:${col}`];
    const state = existing ? seatState(existing) : null;
    if (state?.booking || state?.held) return; // never touch sold/held seats

    if (tool === 'seat') {
      if (!activeCategory) return;
      if (existing) {
        if (existing.category_id !== activeCategory) {
          setSeats(seats.map(s => (s.sid === existing.sid ? { ...s, category_id: activeCategory } : s)));
        }
      } else {
        setSeats([...seats, { sid: newSid(), row, col, category_id: activeCategory }]);
      }
    } else if (tool === 'passage') {
      if (existing) {
        setSeats(seats.filter(s => s.sid !== existing.sid));
        setBlockedSids(blockedSids.filter(sid => sid !== existing.sid));
      }
    } else if (tool === 'block') {
      if (existing && !blockedSids.includes(existing.sid)) {
        setBlockedSids([...blockedSids, existing.sid]);
      }
    } else if (tool === 'unblock') {
      if (existing) setBlockedSids(blockedSids.filter(sid => sid !== existing.sid));
    }
  };

  const generateGrid = () => {
    if (!activeCategory) {
      toast.error('Add a category first (Setup tab), then pick it in the toolbar');
      return;
    }
    if (seats.length > 0) {
      const withBookings = seats.filter(s => seatState(s).booking);
      if (
        !window.confirm(
          `Fill the whole ${dims.rows}×${dims.cols} grid with "${catById[activeCategory]?.name}" seats? ` +
            `Existing seats are replaced${withBookings.length ? ` (except ${withBookings.length} booked seat(s))` : ''}.`
        )
      )
        return;
      const fresh: GridSeat[] = [...withBookings];
      const taken = new Set(withBookings.map(s => `${s.row}:${s.col}`));
      for (let r = 1; r <= dims.rows; r++) {
        for (let c = 1; c <= dims.cols; c++) {
          if (!taken.has(`${r}:${c}`)) fresh.push({ sid: newSid(), row: r, col: c, category_id: activeCategory });
        }
      }
      setSeats(fresh);
      setBlockedSids(blockedSids.filter(sid => withBookings.some(s => s.sid === sid)));
    } else {
      const fresh: GridSeat[] = [];
      for (let r = 1; r <= dims.rows; r++) {
        for (let c = 1; c <= dims.cols; c++) {
          fresh.push({ sid: newSid(), row: r, col: c, category_id: activeCategory });
        }
      }
      setSeats(fresh);
    }
    toast.success('Grid filled — now paint the passages (aisles) with the Passage tool');
  };

  const resize = (rows: number, cols: number) => {
    rows = Math.min(60, Math.max(1, rows || 1));
    cols = Math.min(80, Math.max(1, cols || 1));
    const outside = seats.filter(s => s.row > rows || s.col > cols);
    const outsideBooked = outside.filter(s => seatState(s).booking);
    if (outsideBooked.length > 0) {
      toast.error(`Cannot shrink: ${outsideBooked.length} booked seat(s) would fall outside the grid`);
      return;
    }
    if (outside.length > 0 && !window.confirm(`${outside.length} seat(s) outside the new size will be removed. Continue?`)) {
      return;
    }
    setDims({ rows, cols });
    if (outside.length > 0) {
      setSeats(seats.filter(s => s.row <= rows && s.col <= cols));
      setBlockedSids(blockedSids.filter(sid => seats.some(s => s.sid === sid && s.row <= rows && s.col <= cols)));
    }
  };

  const toolBtn = (t: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool(t)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
        tool === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  // Cell size scales down for wide grids so the whole map stays visible
  const cell = dims.cols > 40 ? 'w-4 h-4 text-[7px]' : dims.cols > 25 ? 'w-5 h-5 text-[8px]' : 'w-6 h-6 sm:w-7 sm:h-7 text-[9px]';

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <label className="text-xs text-gray-500">
          Rows
          <input
            type="number"
            min={1}
            max={60}
            className="block w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={dims.rows}
            onChange={e => resize(parseInt(e.target.value, 10), dims.cols)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Columns
          <input
            type="number"
            min={1}
            max={80}
            className="block w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={dims.cols}
            onChange={e => resize(dims.rows, parseInt(e.target.value, 10))}
          />
        </label>
        <button
          type="button"
          onClick={generateGrid}
          className="inline-flex items-center gap-1 border-2 border-primary-600 text-primary-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-50 self-end"
        >
          <Grid3X3 className="w-4 h-4" /> Fill Grid with Seats
        </button>
        <span className="text-gray-300 self-end pb-1.5">|</span>
        <div className="flex items-center gap-1.5 self-end">
          <Paintbrush className="w-4 h-4 text-gray-400" />
          {toolBtn('seat', 'Seat')}
          {toolBtn('passage', 'Passage')}
          {toolBtn('block', 'Block')}
          {toolBtn('unblock', 'Unblock')}
        </div>
        {tool === 'seat' && (
          <select
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm self-end focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={activeCategory}
            onChange={e => setActiveCategory(e.target.value)}
          >
            <option value="">Category…</option>
            {categories.map(c => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-2 self-end">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => onSave(buildMatrixLayout(seats, blockedSids, dims.rows, dims.cols))}
            disabled={saving}
            className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Layout'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        {tool === 'seat'
          ? 'Click or drag over cells to paint seats with the chosen category.'
          : tool === 'passage'
            ? 'Click or drag over cells to clear them into passages/aisles (booked seats are protected).'
            : tool === 'block'
              ? 'Click or drag over seats to block them from sale (reserved, broken…).'
              : 'Click or drag over blocked seats to make them sellable again.'}{' '}
        Row A is nearest the stage; seat numbers skip passages automatically.
      </p>

      {/* The grid */}
      <div
        className="inline-block min-w-max"
        onMouseDown={() => (painting.current = true)}
        onMouseUp={() => (painting.current = false)}
        onMouseLeave={() => (painting.current = false)}
      >
        <div className="bg-gray-800 text-white text-center text-sm font-semibold tracking-widest rounded-lg py-2 mb-4">
          STAGE
        </div>
        <div className="space-y-1">
          {Array.from({ length: dims.rows }, (_, r) => {
            const row = r + 1;
            // Precompute display numbers for this row (seats only, left→right)
            let n = 0;
            const numbers: Record<number, number> = {};
            for (let c = 1; c <= dims.cols; c++) {
              if (seatAt[`${row}:${c}`]) numbers[c] = ++n;
            }
            return (
              <div key={row} className="flex items-center gap-1">
                <span className="w-7 text-xs text-gray-400 text-right pr-1 flex-shrink-0">
                  {rowLetter(row)}
                </span>
                {Array.from({ length: dims.cols }, (_, c) => {
                  const col = c + 1;
                  const seat = seatAt[`${row}:${col}`];
                  if (!seat) {
                    return (
                      <button
                        key={col}
                        type="button"
                        onMouseDown={() => paintCell(row, col)}
                        onMouseEnter={() => painting.current && paintCell(row, col)}
                        title={`${rowLetter(row)} · column ${col} — passage`}
                        className={`${cell} rounded border border-dashed border-gray-200 hover:border-gray-400 flex-shrink-0`}
                      />
                    );
                  }
                  const { booking, held, blocked } = seatState(seat);
                  let bg = catById[seat.category_id]?.color ?? '#9ca3af';
                  let title = `${rowLetter(row)}${numbers[col]} — ${catById[seat.category_id]?.name ?? ''}`;
                  if (booking) {
                    bg = booking.status === 'confirmed' ? '#dc2626' : '#f97316';
                    title += ` — ${STATUS_LABELS[booking.status] ?? booking.status}: ${booking.name} (${booking.booking_id})`;
                  } else if (held) {
                    bg = '#eab308';
                    title += ' — held by a buyer right now';
                  } else if (blocked) {
                    bg = '#374151';
                    title += ' — blocked';
                  }
                  return (
                    <button
                      key={col}
                      type="button"
                      onMouseDown={() => paintCell(row, col)}
                      onMouseEnter={() => painting.current && paintCell(row, col)}
                      title={title}
                      className={`${cell} rounded-t-md font-medium text-white/90 flex-shrink-0 ${
                        booking || held ? 'cursor-not-allowed' : 'hover:scale-110 transition-transform'
                      }`}
                      style={{ backgroundColor: bg }}
                    >
                      {numbers[col]}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend + counts */}
      <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {categories.map(c => (
            <span key={c.category_id} className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-t inline-block" style={{ backgroundColor: c.color }} />
              {c.name} ({seats.filter(s => s.category_id === c.category_id).length})
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-t inline-block" style={{ backgroundColor: '#dc2626' }} /> Confirmed</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-t inline-block" style={{ backgroundColor: '#f97316' }} /> Pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-t inline-block" style={{ backgroundColor: '#eab308' }} /> Held</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-t inline-block" style={{ backgroundColor: '#374151' }} /> Blocked</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-dashed border-gray-300 inline-block" /> Passage</span>
        </div>
        <span className="text-sm text-gray-500">{seats.length} seats</span>
      </div>
    </div>
  );
}
