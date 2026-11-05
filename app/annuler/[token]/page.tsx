import { notFound, redirect } from 'next/navigation';
import { formatDayLong, formatTime } from '@/lib/dates';
import { notifyCancellation } from '@/lib/email';
import { getSettings } from '@/lib/slots';
import { db } from '@/lib/supabase';
import { LOCATION_LABELS, type Booking, type Service } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Annuler ma réservation', robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(token: string) {
  if (!UUID_RE.test(token)) return null;
  const { data, error } = await db().from('bookings').select('*, services(*)').eq('cancel_token', token).maybeSingle();
  if (error) throw error;
  return data as (Booking & { services: Service }) | null;
}

async function cancel(fd: FormData) {
  'use server';
  const token = String(fd.get('token') ?? '');
  const b = await load(token);
  if (!b) notFound();
  const settings = await getSettings();
  const deadline = Date.parse(b.start_at) - settings.cancel_notice_hours * 3600_000;
  if (b.status === 'confirmed' && Date.now() <= deadline) {
    const { data } = await db()
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', b.id)
      .eq('status', 'confirmed')
      .select('id')
      .maybeSingle();
    if (data) {
      const { services, ...booking } = b;
      await notifyCancellation(booking, services, settings, 'client');
    }
  }
  redirect(`/annuler/${token}`);
}

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await load(token);
  if (!b) notFound();
  const settings = await getSettings();
  const tooLate = Date.now() > Date.parse(b.start_at) - settings.cancel_notice_hours * 3600_000;

  return (
    <main className="container narrow">
      <div className="card stack">
        <h1>Votre réservation</h1>
        <p>
          <strong>{b.services.name}</strong>
          <br />
          {formatDayLong(b.start_at)} à {formatTime(b.start_at)}
          <br />
          <span className="muted">
            {LOCATION_LABELS[b.location_type]}
            {b.address ? ` — ${b.address}` : settings.cabinet_address ? ` — ${settings.cabinet_address}` : ''}
          </span>
        </p>

        {b.status === 'cancelled' ? (
          <p className="notice">Cette réservation est annulée.</p>
        ) : tooLate ? (
          <p className="notice">
            L&apos;annulation en ligne n&apos;est plus possible moins de {settings.cancel_notice_hours} h avant
            la séance. Merci de contacter directement {settings.practitioner_name || 'votre masseur'}
            {settings.practitioner_email && (
              <>
                {' '}
                (<a href={`mailto:${settings.practitioner_email}`}>{settings.practitioner_email}</a>)
              </>
            )}
            .
          </p>
        ) : (
          <form action={cancel}>
            <input type="hidden" name="token" value={token} />
            <button className="btn danger">Annuler cette réservation</button>
          </form>
        )}
      </div>
    </main>
  );
}
