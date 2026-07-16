import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, Trash2 } from 'lucide-react';
import { ticketSetupsAPI, TicketSetup } from '../../services/api';
import TicketSetupView, { snapshotSummaryLine } from './TicketSetupView';

const inputCls =
  'border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

export default function AdminEventTickets() {
  const [setups, setSetups] = useState<TicketSetup[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ticketSetupsAPI.list();
      setSetups(list);
      setSelectedId(prev => {
        if (prev && list.some(s => s.setup_id === prev)) return prev;
        const active = list.find(s => s.status === 'active');
        return active?.setup_id ?? list[0]?.setup_id ?? '';
      });
    } catch {
      toast.error('Failed to load ticket setups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => setups.find(s => s.setup_id === selectedId) ?? null,
    [setups, selectedId]
  );

  const archiveSetup = async () => {
    if (!selected || selected.status !== 'active') return;
    if (!window.confirm(`Archive "${selected.label}"? It will become read-only.`)) return;
    setBusy(true);
    try {
      await ticketSetupsAPI.archive(selected.setup_id);
      toast.success('Setup archived');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to archive setup');
    } finally {
      setBusy(false);
    }
  };

  const deleteSetup = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.label}" permanently? This does not change live booking config.`)) return;
    setBusy(true);
    try {
      await ticketSetupsAPI.remove(selected.setup_id);
      toast.success('Setup deleted');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete setup');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (setups.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center text-gray-600">
        <p>No saved ticket setups yet.</p>
        <p className="text-sm mt-2">Save a setup from the New Ticket Setup tab to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="setup-select" className="block text-sm font-medium text-gray-700 mb-1">
              Saved setup
            </label>
            <select
              id="setup-select"
              className={`${inputCls} w-full`}
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              {setups.map(setup => (
                <option key={setup.setup_id} value={setup.setup_id}>
                  {setup.event_name} — {setup.status === 'active' ? 'Active' : 'Archived'} (
                  {new Date(setup.updated_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <p className="text-sm text-gray-500 pb-2">{snapshotSummaryLine(selected.snapshot)}</p>
          )}
        </div>

        {selected && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            {selected.status === 'active' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void archiveSetup()}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
              >
                <Archive className="w-4 h-4" /> Archive
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteSetup()}
              className="inline-flex items-center gap-1.5 text-sm border border-red-200 text-red-600 rounded-lg px-3 py-2 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            {selected.status === 'active' && (
              <a
                href={`/admin/book-your-seat?edit=${encodeURIComponent(selected.event_id)}`}
                className="inline-flex items-center gap-1.5 text-sm border border-primary-200 text-primary-700 rounded-lg px-3 py-2 hover:bg-primary-50"
              >
                Edit in New Ticket Setup
              </a>
            )}
            {selected.status === 'active' && (
              <p className="text-xs text-gray-500 self-center ml-2">
                Opens the active setup in the New Ticket Setup tab.
              </p>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className={selected.status === 'archived' ? 'opacity-100' : ''}>
          <TicketSetupView setup={selected} />
        </div>
      )}
    </div>
  );
}
