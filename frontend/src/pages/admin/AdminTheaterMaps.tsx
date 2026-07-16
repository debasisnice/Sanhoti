import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { theaterMapsAPI, TheaterMap, SeatCategory } from '../../services/api';
import SeatGridDesigner, { GridSeat, newSid } from './SeatGridDesigner';

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function categoriesFromTheaterMap(map: TheaterMap | null): SeatCategory[] {
  const names = [...new Set((map?.seats ?? []).map(s => s.category_name.trim()).filter(Boolean))];
  if (names.length === 0) {
    return [
      {
        category_id: 'TM_GENERAL',
        name: 'General',
        color: PALETTE[0],
        adult_price: 0,
        child_price: 0,
        price: 0,
      },
    ];
  }
  return names.map((name, i) => ({
    category_id: `TM_${name.replace(/\W+/g, '_').toUpperCase()}`,
    name,
    color: PALETTE[i % PALETTE.length],
    adult_price: 0,
    child_price: 0,
    price: 0,
  }));
}

function gridFromTheaterMap(
  map: TheaterMap,
  categories: SeatCategory[]
): { seats: GridSeat[]; blockedSids: string[] } {
  const idByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c.category_id]));
  const fallback = categories[0]?.category_id ?? 'TM_GENERAL';
  const seats: GridSeat[] = [];
  const blockedSids: string[] = [];
  for (const seat of map.seats) {
    const sid = newSid();
    const category_id = idByName.get(seat.category_name.trim().toLowerCase()) ?? fallback;
    seats.push({ sid, row: seat.row, col: seat.col, category_id });
    if (seat.blocked) blockedSids.push(sid);
  }
  return { seats, blockedSids };
}

function theaterSeatsFromGrid(
  seats: GridSeat[],
  blockedSids: string[],
  categories: SeatCategory[]
): TheaterMap['seats'] {
  const nameById = new Map(categories.map(c => [c.category_id, c.name]));
  const blocked = new Set(blockedSids);
  return seats.map(seat => ({
    row: seat.row,
    col: seat.col,
    category_name: nameById.get(seat.category_id) ?? 'General',
    ...(blocked.has(seat.sid) ? { blocked: true } : {}),
  }));
}

export default function AdminTheaterMaps() {
  const [maps, setMaps] = useState<TheaterMap[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<SeatCategory[]>([]);
  const [gridSeats, setGridSeats] = useState<GridSeat[]>([]);
  const [blockedSids, setBlockedSids] = useState<string[]>([]);
  const [matrixDims, setMatrixDims] = useState({ rows: 15, cols: 24 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const selected = useMemo(
    () => maps.find(m => m.theater_map_id === selectedId) ?? null,
    [maps, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMaps(await theaterMapsAPI.list());
    } catch {
      toast.error('Failed to load theater maps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectMap = (map: TheaterMap) => {
    setIsNew(false);
    setSelectedId(map.theater_map_id);
    setName(map.name);
    setMatrixDims(map.matrix);
    const cats = categoriesFromTheaterMap(map);
    setCategories(cats);
    const parsed = gridFromTheaterMap(map, cats);
    setGridSeats(parsed.seats);
    setBlockedSids(parsed.blockedSids);
  };

  const startNew = () => {
    setIsNew(true);
    setSelectedId('');
    setName('New theater map');
    setMatrixDims({ rows: 15, cols: 24 });
    const cats = categoriesFromTheaterMap(null);
    setCategories(cats);
    setGridSeats([]);
    setBlockedSids([]);
  };

  const saveMap = async () => {
    const trimmed = name.trim();
    if (!trimmed) return void toast.error('Map name is required');
    const seats = theaterSeatsFromGrid(gridSeats, blockedSids, categories);
    if (seats.length === 0) return void toast.error('Paint at least one seat');
    setSaving(true);
    try {
      const payload = { name: trimmed, matrix: matrixDims, seats };
      if (isNew || !selectedId) {
        const created = await theaterMapsAPI.create(payload);
        setMaps(prev => [created, ...prev]);
        selectMap(created);
        toast.success('Theater map created');
      } else {
        const updated = await theaterMapsAPI.update(selectedId, payload);
        setMaps(prev => prev.map(m => (m.theater_map_id === updated.theater_map_id ? updated : m)));
        selectMap(updated);
        toast.success('Theater map saved');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save theater map');
    } finally {
      setSaving(false);
    }
  };

  const deleteMap = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.name}"?`)) return;
    setSaving(true);
    try {
      await theaterMapsAPI.remove(selected.theater_map_id);
      setMaps(prev => prev.filter(m => m.theater_map_id !== selected.theater_map_id));
      setSelectedId('');
      setIsNew(false);
      toast.success('Theater map deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const label = window.prompt('Category name (e.g. VIP, General):')?.trim();
    if (!label) return;
    if (categories.some(c => c.name.toLowerCase() === label.toLowerCase())) {
      return void toast.error('Category already exists');
    }
    setCategories(prev => [
      ...prev,
      {
        category_id: `TM_${label.replace(/\W+/g, '_').toUpperCase()}_${Date.now()}`,
        name: label,
        color: PALETTE[prev.length % PALETTE.length],
        adult_price: 0,
        child_price: 0,
        price: 0,
      },
    ]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Reusable seat layouts for any event. Category names here are labels only — event pricing is set when you apply a map in New Ticket Setup.
          </p>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> New map
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {maps.map(map => (
            <button
              key={map.theater_map_id}
              type="button"
              onClick={() => selectMap(map)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                selectedId === map.theater_map_id && !isNew
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {map.name}
              <span className="text-gray-500 ml-1">({map.seats.length} seats)</span>
            </button>
          ))}
        </div>
      </div>

      {(selected || isNew) && (
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Map name</label>
              <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
              <div className="flex flex-wrap gap-2 items-center">
                {categories.map(c => (
                  <span
                    key={c.category_id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                    style={{ borderColor: c.color, color: c.color }}
                  >
                    {c.name}
                  </span>
                ))}
                <button type="button" onClick={addCategory} className="text-sm text-primary-600 hover:text-primary-700">
                  + Add
                </button>
              </div>
            </div>
          </div>

          <SeatGridDesigner
            mapId={selectedId || 'new-theater-map'}
            categories={categories}
            seats={gridSeats}
            setSeats={setGridSeats}
            blockedSids={blockedSids}
            setBlockedSids={setBlockedSids}
            dims={matrixDims}
            setDims={setMatrixDims}
            unavailable={{}}
            bookedBy={{}}
            saving={saving}
            onSave={() => void saveMap()}
            onRefresh={load}
          />

          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => void saveMap()}
              disabled={saving}
              className="bg-primary-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save map'}
            </button>
            {selected && !isNew && (
              <button
                type="button"
                onClick={() => void deleteMap()}
                disabled={saving}
                className="inline-flex items-center gap-1 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {!selected && !isNew && maps.length > 0 && (
        <p className="text-sm text-gray-500 text-center">Select a map above or create a new one.</p>
      )}
    </div>
  );
}
