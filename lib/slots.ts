import { db } from './supabase';
import { addMinutes } from './time';
import type { LocationType, Service, Settings } from './types';

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from('settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as Settings;
}

export async function getActiveService(id: string): Promise<Service | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db()
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return (data as Service) ?? null;
}

/** Temps de trajet bloqué avant et après un rendez-vous hors cabinet. */
export function bufferFor(location: LocationType, settings: Settings): number {
  return location === 'cabinet' ? 0 : settings.travel_buffer_min;
}

/**
 * Calcule les heures de début possibles pour une prestation, entre `from` et `to`.
 * Un créneau est proposé s'il tient entièrement dans une plage de disponibilité
 * et ne chevauche aucune réservation confirmée (trajets compris).
 */
export async function computeSlots(opts: {
  service: Service;
  location: LocationType;
  from: Date;
  to: Date;
  settings: Settings;
}): Promise<string[]> {
  const { service, location, settings } = opts;
  const earliest = new Date(Date.now() + settings.min_notice_hours * 3_600_000);
  const from = opts.from < earliest ? earliest : opts.from;
  if (from >= opts.to) return [];

  const supa = db();
  const [windowsRes, busyRes] = await Promise.all([
    supa
      .from('availability')
      .select('start_at,end_at')
      .lt('start_at', opts.to.toISOString())
      .gt('end_at', from.toISOString())
      .order('start_at'),
    supa
      .from('bookings')
      .select('block_start,block_end')
      .eq('status', 'confirmed')
      .lt('block_start', addMinutes(opts.to, 24 * 60).toISOString())
      .gt('block_end', addMinutes(from, -24 * 60).toISOString()),
  ]);
  if (windowsRes.error) throw windowsRes.error;
  if (busyRes.error) throw busyRes.error;

  const buf = bufferFor(location, settings) * 60_000;
  const step = settings.slot_step_min * 60_000;
  const dur = service.duration_min * 60_000;
  const busy = (busyRes.data ?? []).map((b) => [Date.parse(b.block_start), Date.parse(b.block_end)]);

  const out = new Set<number>();
  for (const w of windowsRes.data ?? []) {
    const ws = Date.parse(w.start_at);
    const we = Date.parse(w.end_at);
    for (let t = ws; t + dur <= we; t += step) {
      if (t < from.getTime() || t >= opts.to.getTime()) continue;
      const bs = t - buf;
      const be = t + dur + buf;
      if (busy.some(([s, e]) => bs < e && be > s)) continue;
      out.add(t);
    }
  }
  return [...out].sort((a, b) => a - b).map((t) => new Date(t).toISOString());
}
