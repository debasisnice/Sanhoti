import type { ReactNode } from 'react';
import {
  TicketSetup,
  TicketSetupSnapshot,
  categoryAdultPrice,
  categoryChildPrice,
} from '../../services/api';

const usd = (n: number) => `$${Number(n).toFixed(2)}`;

interface TicketSetupViewProps {
  setup: TicketSetup;
}

export default function TicketSetupView({ setup }: TicketSetupViewProps) {
  const snap = setup.snapshot;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{setup.label}</h2>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            setup.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {setup.status === 'active' ? 'Active' : 'Archived'}
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Event: <span className="font-medium text-gray-900">{setup.event_name}</span>
        {' · '}
        Last updated {new Date(setup.updated_at).toLocaleString()}
        {setup.archived_at && (
          <> · Archived {new Date(setup.archived_at).toLocaleString()}</>
        )}
      </p>

      <SnapshotSection title="Entire-event categories">
        {snap.categories.filter(c => c.entire_event_enabled !== false).length === 0 ? (
          <p className="text-sm text-gray-500">None enabled for entire event.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {snap.categories
              .filter(c => c.entire_event_enabled !== false)
              .map(c => (
                <li key={c.category_id}>
                  <span className="font-medium">{c.name}</span> — adult {usd(categoryAdultPrice(c))}, child{' '}
                  {usd(categoryChildPrice(c))}
                </li>
              ))}
          </ul>
        )}
      </SnapshotSection>

      <SnapshotSection title="Child age range">
        <p className="text-sm text-gray-700">
          {snap.child_age_range.min_age}–{snap.child_age_range.max_age} years
        </p>
      </SnapshotSection>

      <SnapshotSection title="Daily lunch & dinner pricing">
        {snap.meal_days.length === 0 ? (
          <p className="text-sm text-gray-500">No meal days configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Day</th>
                  <th className="py-2 pr-4">Lunch (A/C)</th>
                  <th className="py-2">Dinner (A/C)</th>
                </tr>
              </thead>
              <tbody>
                {snap.meal_days.map(day => (
                  <tr key={day.day_id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium">{day.label}</td>
                    <td className="py-2 pr-4">
                      {usd(day.lunch_adult_price)} / {usd(day.lunch_child_price)}
                    </td>
                    <td className="py-2">
                      {usd(day.dinner_adult_price)} / {usd(day.dinner_child_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SnapshotSection>

      <SnapshotSection title="Sub-event ticketing">
        {snap.sub_event_configs.length === 0 ? (
          <p className="text-sm text-gray-500">No sub-event configs.</p>
        ) : (
          <div className="space-y-4">
            {snap.sub_event_configs.map(cfg => (
              <div key={cfg.sub_event_id} className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium text-gray-900 text-sm">
                  Sub-event {cfg.sub_event_id.slice(0, 8)}… · {cfg.ticketing_type}
                </p>
                {(cfg.category_prices ?? []).length > 0 && (
                  <ul className="mt-2 text-sm text-gray-700 space-y-0.5">
                    {cfg.category_prices.map(row => {
                      const cat = snap.categories.find(c => c.category_id === row.category_id);
                      return (
                        <li key={row.category_id}>
                          {cat?.name ?? row.category_id}: adult {usd(row.adult_price)}, child{' '}
                          {usd(row.child_price)}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(cfg.food_addons ?? []).length > 0 && (
                  <ul className="mt-2 text-sm text-gray-600 space-y-0.5">
                    {cfg.food_addons.map(addon => (
                      <li key={addon.addon_id}>
                        {addon.name}: adult {usd(addon.adult_price)}, child {usd(addon.child_price)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </SnapshotSection>

      <SnapshotSection title="Seat maps">
        {snap.seat_maps.length === 0 ? (
          <p className="text-sm text-gray-500">No seat maps.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {snap.seat_maps.map(map => (
              <li key={map.map_id}>
                <span className="font-medium">{map.name}</span>
                {' — '}
                {map.sections.filter(s => s.rows === 1 && s.seats_per_row === 1).length} seats
                {map.sub_event_id ? ' (sub-event)' : ' (whole event)'}
                {' · '}
                {map.is_open ? 'Open' : 'Closed'}
              </li>
            ))}
          </ul>
        )}
      </SnapshotSection>

      <SnapshotSection title="Discount codes">
        {snap.discounts.length === 0 ? (
          <p className="text-sm text-gray-500">No discounts in snapshot.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {snap.discounts.map(d => (
              <li key={d.discount_id}>
                <span className="font-mono font-medium">{d.code}</span>
                {' — '}
                {d.type === 'percent' ? `${d.value}%` : usd(d.value)}
                {!d.is_active && ' (inactive)'}
              </li>
            ))}
          </ul>
        )}
      </SnapshotSection>

      <SnapshotSection title="Checkout settings">
        <p className="text-sm text-gray-700">
          Hold {snap.hold_minutes} min · Payment window {snap.payment_window_hours} h
          {snap.booking_note && (
            <>
              <br />
              Note: {snap.booking_note}
            </>
          )}
        </p>
      </SnapshotSection>
    </div>
  );
}

function SnapshotSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function snapshotSummaryLine(snap: TicketSetupSnapshot): string {
  const mapCount = snap.seat_maps.length;
  const catCount = snap.categories.length;
  return `${catCount} categories · ${mapCount} seat map${mapCount === 1 ? '' : 's'} · ${snap.discounts.length} discount${snap.discounts.length === 1 ? '' : 's'}`;
}
