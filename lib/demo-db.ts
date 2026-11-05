// Base de données factice, en mémoire, pour essayer le site sans Supabase.
// Utilisée uniquement en développement quand SUPABASE_URL n'est pas défini.
// Les données sont perdues à chaque redémarrage du serveur.

import { randomUUID } from 'crypto';
import { addDaysStr, todayParis } from './dates';
import { parisToUtc } from './time';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Store = Record<string, Row[]>;
type Result = { data: any; error: any };

function seed(): Store {
  const now = new Date().toISOString();
  const services: Row[] = [
    { id: randomUUID(), name: 'Massage Tuina', description: 'Massage traditionnel chinois qui dénoue les tensions et rééquilibre l’énergie du corps.', duration_min: 60, price_cents: 7000, active: true, sort: 1, created_at: now },
    { id: randomUUID(), name: 'Acupuncture', description: 'Stimulation de points précis par de fines aiguilles pour soulager douleurs et blocages.', duration_min: 60, price_cents: 7500, active: true, sort: 2, created_at: now },
    { id: randomUUID(), name: 'Ventouses', description: 'Les ventouses activent la circulation et relâchent les muscles contractés.', duration_min: 30, price_cents: 4000, active: true, sort: 3, created_at: now },
    { id: randomUUID(), name: 'Massage sportif profond', description: 'Travail en profondeur sur les tensions et contractures musculaires.', duration_min: 45, price_cents: 5000, active: true, sort: 4, created_at: now },
  ];

  const availability: Row[] = [];
  const today = todayParis();
  for (let i = 0; i < 21; i++) {
    const d = addDaysStr(today, i);
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 = dimanche
    const ranges = weekday === 0 ? [] : weekday === 6 ? [['09:00', '13:00']] : [['09:00', '12:00'], ['14:00', '19:00']];
    for (const [s, e] of ranges) {
      availability.push({ id: randomUUID(), start_at: parisToUtc(d, s).toISOString(), end_at: parisToUtc(d, e).toISOString(), created_at: now });
    }
  }

  const booking = (day: number, time: string, svc: Row, location: string, buffer: number, client: Row): Row => {
    const start = parisToUtc(addDaysStr(today, day), time);
    const end = new Date(start.getTime() + svc.duration_min * 60_000);
    return {
      id: randomUUID(), service_id: svc.id, start_at: start.toISOString(), end_at: end.toISOString(),
      block_start: new Date(start.getTime() - buffer * 60_000).toISOString(),
      block_end: new Date(end.getTime() + buffer * 60_000).toISOString(),
      location_type: location, address: null, notes: null, status: 'confirmed',
      cancel_token: randomUUID(), created_at: now, ...client,
    };
  };
  // Jours ouvrés (lundi–vendredi) à venir, hors aujourd'hui
  const weekdays = Array.from({ length: 10 }, (_, i) => i + 1).filter((i) => {
    const wd = new Date(`${addDaysStr(today, i)}T12:00:00Z`).getUTCDay();
    return wd >= 1 && wd <= 5;
  });
  const bookings = [
    booking(weekdays[1], '10:00', services[0], 'cabinet', 0, { client_name: 'Léa Martin', client_email: 'lea@example.com', client_phone: '06 12 34 56 78', notes: 'Trail de 40 km dimanche dernier, mollets très tendus.' }),
    booking(weekdays[2], '15:00', services[2], 'domicile', 30, { client_name: 'Thomas Bernard', client_email: 'thomas@example.com', client_phone: '07 98 76 54 32', address: '8 avenue des Sports, 63000 Clermont-Ferrand' }),
  ];

  const settings = [{
    id: 1, practitioner_name: 'Alex (démo)', practitioner_email: 'masseur@example.com',
    cabinet_address: '12 rue du Stade, 63000 Clermont-Ferrand', slot_step_min: 15,
    min_notice_hours: 12, travel_buffer_min: 30, cancel_notice_hours: 24,
  }];

  return { services, availability, bookings, settings };
}

const g = globalThis as unknown as { __demoStore?: Store };
function store(): Store {
  return (g.__demoStore ??= seed());
}

const DEFAULTS: Record<string, () => Row> = {
  services: () => ({ description: null, price_cents: 0, active: true, sort: 0 }),
  availability: () => ({}),
  bookings: () => ({ status: 'confirmed', cancel_token: randomUUID(), address: null, notes: null }),
  settings: () => ({}),
};

function compare(a: any, b: any): number {
  if (typeof a === 'string' && typeof b === 'string') {
    const da = Date.parse(a), db = Date.parse(b);
    if (!Number.isNaN(da) && !Number.isNaN(db) && /^\d{4}-/.test(a)) return da - db;
    return a.localeCompare(b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: ((r: Row) => boolean)[] = [];
  private orders: [string, boolean][] = [];
  private lim?: number;
  private payload: any;
  private cols = '*';
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private returning = false;

  constructor(private table: string) {}

  select(cols = '*') { this.cols = cols; if (this.op !== 'select') this.returning = true; return this; }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => compare(r[c], v) < 0); return this; }
  gt(c: string, v: any) { this.filters.push((r) => compare(r[c], v) > 0); return this; }
  gte(c: string, v: any) { this.filters.push((r) => compare(r[c], v) >= 0); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push([c, o?.ascending !== false]); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, ko?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.exec()).then(ok, ko);
  }

  private project(r: Row): Row {
    const out = structuredClone(r);
    if (this.cols.includes('services(')) out.services = structuredClone(store().services.find((s) => s.id === r.service_id) ?? null);
    return out;
  }

  private finish(rows: Row[]): Result {
    const data = rows.map((r) => this.project(r));
    if (this.mode === 'many') return { data, error: null };
    if (this.mode === 'maybe') return { data: data[0] ?? null, error: null };
    return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'Aucune ligne (démo)' } };
  }

  private exec(): Result {
    const s = store();
    const table = (s[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));

    if (this.op === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row): Row => ({
        id: randomUUID(), created_at: new Date().toISOString(), ...DEFAULTS[this.table]?.(), ...p,
      }));
      if (this.table === 'bookings') {
        for (const r of rows) {
          const clash = table.some((b) => b.status === 'confirmed' && compare(r.block_start, b.block_end) < 0 && compare(r.block_end, b.block_start) > 0);
          if (clash) return { data: null, error: { code: '23P01', message: 'Chevauchement (démo)' } };
        }
      }
      table.push(...rows);
      return this.returning ? this.finish(rows) : { data: null, error: null };
    }

    if (this.op === 'update') {
      const rows = table.filter(match);
      rows.forEach((r) => Object.assign(r, this.payload));
      return this.returning ? this.finish(rows) : { data: null, error: null };
    }

    if (this.op === 'delete') {
      s[this.table] = table.filter((r) => !match(r));
      return { data: null, error: null };
    }

    let rows = table.filter(match);
    rows = [...rows].sort((a, b) => {
      for (const [c, asc] of this.orders) {
        const d = compare(a[c], b[c]);
        if (d !== 0) return asc ? d : -d;
      }
      return 0;
    });
    if (this.lim !== undefined) rows = rows.slice(0, this.lim);
    return this.finish(rows);
  }
}

export const demoClient = { from: (table: string) => new Query(table) };
