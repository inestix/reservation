import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { dayKey, formatDayLong, formatTime, todayParis } from '@/lib/dates';
import { getSettings } from '@/lib/slots';
import { db } from '@/lib/supabase';
import { LOCATION_LABELS, formatPrice, type Booking, type Service } from '@/lib/types';
import {
  addAvailability,
  cancelBookingByAdmin,
  deleteAvailability,
  logout,
  saveService,
  saveSettings,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Espace masseur' };

const TABS = [
  ['reservations', 'Réservations'],
  ['dispos', 'Disponibilités'],
  ['prestations', 'Prestations'],
  ['reglages', 'Réglages'],
] as const;

type Tab = (typeof TABS)[number][0];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; msg?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : 'reservations';

  return (
    <main className="container">
      <header className="admin-header">
        <h1>Espace masseur</h1>
        <div className="row">
          <Link href="/" className="btn" target="_blank">
            Voir la page client ↗
          </Link>
          <form action={logout}>
            <button className="btn">Déconnexion</button>
          </form>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin?tab=${k}`} className={k === tab ? 'tab active' : 'tab'}>
            {label}
          </Link>
        ))}
      </nav>

      {sp.msg && <p className="notice">{sp.msg}</p>}

      {tab === 'reservations' && <Reservations />}
      {tab === 'dispos' && <Dispos />}
      {tab === 'prestations' && <Prestations />}
      {tab === 'reglages' && <Reglages />}
    </main>
  );
}

/* ---------------- Réservations ---------------- */

async function Reservations() {
  const since = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data, error } = await db()
    .from('bookings')
    .select('*, services(name, duration_min, price_cents)')
    .eq('status', 'confirmed')
    .gte('start_at', since)
    .order('start_at');
  if (error) throw error;
  const bookings = (data ?? []) as (Booking & { services: Pick<Service, 'name' | 'duration_min' | 'price_cents'> })[];

  if (bookings.length === 0) {
    return <p className="muted">Aucune réservation à venir.</p>;
  }

  const byDay = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const k = dayKey(b.start_at);
    byDay.set(k, [...(byDay.get(k) ?? []), b]);
  }

  return (
    <section className="stack">
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day}>
          <h3>{formatDayLong(list[0].start_at)}</h3>
          <div className="stack-sm">
            {list.map((b) => (
              <div key={b.id} className="card booking">
                <div className="booking-time">
                  {formatTime(b.start_at)}
                  <span>{formatTime(b.end_at)}</span>
                </div>
                <div className="booking-body">
                  <strong>{b.client_name}</strong> — {b.services.name} ({formatPrice(b.services.price_cents)})
                  <div className="muted">
                    <a href={`tel:${b.client_phone}`}>{b.client_phone}</a> ·{' '}
                    <a href={`mailto:${b.client_email}`}>{b.client_email}</a>
                  </div>
                  <div>
                    <span className={`badge ${b.location_type}`}>{LOCATION_LABELS[b.location_type]}</span>
                    {b.address && <> {b.address}</>}
                  </div>
                  {b.notes && <p className="note">{b.notes}</p>}
                </div>
                <details className="booking-actions">
                  <summary>Annuler…</summary>
                  <form action={cancelBookingByAdmin} className="stack-sm">
                    <input type="hidden" name="id" value={b.id} />
                    <label className="check">
                      <input type="checkbox" name="notify" defaultChecked /> Prévenir le client par email
                    </label>
                    <button className="btn danger">Confirmer l&apos;annulation</button>
                  </form>
                </details>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------------- Disponibilités ---------------- */

async function Dispos() {
  const { data, error } = await db()
    .from('availability')
    .select('*')
    .gte('end_at', new Date().toISOString())
    .order('start_at')
    .limit(300);
  if (error) throw error;

  return (
    <section className="grid-2">
      <div className="card">
        <h2>Ajouter une plage</h2>
        <p className="muted">
          Les clients pourront réserver n&apos;importe quel créneau qui tient entièrement dans cette plage.
        </p>
        <form action={addAvailability} className="stack">
          <label>
            Jour
            <input type="date" name="date" required min={todayParis()} defaultValue={todayParis()} />
          </label>
          <div className="row">
            <label>
              De
              <input type="time" name="start" required defaultValue="09:00" step={300} />
            </label>
            <label>
              À
              <input type="time" name="end" required defaultValue="12:00" step={300} />
            </label>
          </div>
          <label>
            Répéter chaque semaine
            <select name="weeks" defaultValue="1">
              <option value="1">Non, seulement ce jour</option>
              {[2, 4, 8, 12, 26].map((n) => (
                <option key={n} value={n}>
                  Pendant {n} semaines
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary">Ajouter</button>
        </form>
      </div>

      <div>
        <h2>Plages à venir</h2>
        {(data ?? []).length === 0 ? (
          <p className="muted">Aucune disponibilité. Ajoutez-en pour ouvrir les réservations.</p>
        ) : (
          <ul className="list">
            {data!.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{formatDayLong(a.start_at)}</strong> · {formatTime(a.start_at)} – {formatTime(a.end_at)}
                </span>
                <form action={deleteAvailability}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn small" title="Supprimer cette plage">
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          Supprimer une plage n&apos;annule pas les réservations déjà prises dessus.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Prestations ---------------- */

function ServiceForm({ s }: { s?: Service }) {
  return (
    <form action={saveService} className="card stack">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="row">
        <label className="grow">
          Nom
          <input name="name" required defaultValue={s?.name} placeholder="Massage récupération" />
        </label>
        <label>
          Durée (min)
          <input name="duration_min" type="number" min={10} max={480} step={5} required defaultValue={s?.duration_min ?? 45} />
        </label>
        <label>
          Prix (€)
          <input name="price" inputMode="decimal" required defaultValue={s ? (s.price_cents / 100).toString() : ''} />
        </label>
      </div>
      <label>
        Description
        <input name="description" defaultValue={s?.description ?? ''} placeholder="Facultatif" />
      </label>
      <div className="row between">
        <div className="row">
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> Proposée aux clients
          </label>
          <label className="inline">
            Ordre
            <input name="sort" type="number" min={0} max={999} defaultValue={s?.sort ?? 0} className="tiny" />
          </label>
        </div>
        <button className="btn primary">{s ? 'Enregistrer' : 'Ajouter la prestation'}</button>
      </div>
    </form>
  );
}

async function Prestations() {
  const { data, error } = await db().from('services').select('*').order('sort').order('name');
  if (error) throw error;
  return (
    <section className="stack">
      {(data as Service[]).map((s) => (
        <ServiceForm key={s.id} s={s} />
      ))}
      <h2>Nouvelle prestation</h2>
      <ServiceForm />
    </section>
  );
}

/* ---------------- Réglages ---------------- */

async function Reglages() {
  const s = await getSettings();
  return (
    <form action={saveSettings} className="card stack narrow-form">
      <label>
        Votre nom (affiché aux clients)
        <input name="practitioner_name" defaultValue={s.practitioner_name ?? ''} />
      </label>
      <label>
        Email où recevoir les réservations
        <input name="practitioner_email" type="email" defaultValue={s.practitioner_email ?? ''} />
      </label>
      <label>
        Adresse du cabinet
        <input name="cabinet_address" defaultValue={s.cabinet_address ?? ''} />
      </label>
      <label>
        Intervalle entre deux heures de début proposées (min)
        <input name="slot_step_min" type="number" min={5} max={120} defaultValue={s.slot_step_min} />
      </label>
      <label>
        Délai minimum avant une réservation (heures)
        <input name="min_notice_hours" type="number" min={0} max={720} defaultValue={s.min_notice_hours} />
      </label>
      <label>
        Temps de trajet bloqué avant et après une séance à domicile / en club (min)
        <input name="travel_buffer_min" type="number" min={0} max={240} defaultValue={s.travel_buffer_min} />
      </label>
      <label>
        Annulation possible par le client jusqu&apos;à (heures avant)
        <input name="cancel_notice_hours" type="number" min={0} max={720} defaultValue={s.cancel_notice_hours} />
      </label>
      <button className="btn primary">Enregistrer</button>
    </form>
  );
}
