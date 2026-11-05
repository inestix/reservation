import { NextResponse, type NextRequest } from 'next/server';
import { notifyNewBooking } from '@/lib/email';
import { bufferFor, computeSlots, getActiveService, getSettings } from '@/lib/slots';
import { db } from '@/lib/supabase';
import { addMinutes } from '@/lib/time';
import { LOCATIONS, type Booking, type LocationType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad('Requête invalide');
  }
  const s = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);

  const location = body.location as LocationType;
  const name = s('name', 100);
  const email = s('email', 200);
  const phone = s('phone', 30);
  const notes = s('notes', 1000);
  const address = s('address', 300);
  const start = new Date(String(body.start ?? ''));

  if (!LOCATIONS.includes(location)) return bad('Lieu invalide');
  if (name.length < 2) return bad('Merci d’indiquer votre nom');
  if (!EMAIL_RE.test(email)) return bad('Adresse email invalide');
  if (phone.replace(/\D/g, '').length < 6) return bad('Numéro de téléphone invalide');
  if (location !== 'cabinet' && address.length < 5) return bad('Merci d’indiquer l’adresse du rendez-vous');
  if (Number.isNaN(start.getTime())) return bad('Créneau invalide');

  const service = await getActiveService(String(body.serviceId ?? ''));
  if (!service) return bad('Prestation introuvable', 404);
  const settings = await getSettings();

  // On revérifie côté serveur que le créneau est bien libre.
  const available = await computeSlots({
    service,
    location,
    from: addMinutes(start, -1),
    to: addMinutes(start, 1),
    settings,
  });
  if (!available.includes(start.toISOString())) {
    return bad('Ce créneau n’est plus disponible. Merci d’en choisir un autre.', 409);
  }

  const end = addMinutes(start, service.duration_min);
  const buf = bufferFor(location, settings);
  const { data, error } = await db()
    .from('bookings')
    .insert({
      service_id: service.id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      block_start: addMinutes(start, -buf).toISOString(),
      block_end: addMinutes(end, buf).toISOString(),
      location_type: location,
      address: location === 'cabinet' ? null : address,
      client_name: name,
      client_email: email,
      client_phone: phone,
      notes: notes || null,
    })
    .select('*')
    .single();

  if (error) {
    // 23P01 = la contrainte anti-chevauchement a bloqué une réservation simultanée
    if (error.code === '23P01') {
      return bad('Ce créneau vient d’être réservé. Merci d’en choisir un autre.', 409);
    }
    console.error(error);
    return bad('Erreur lors de l’enregistrement', 500);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || req.nextUrl.origin;
  await notifyNewBooking(data as Booking, service, settings, baseUrl);

  return NextResponse.json({ ok: true });
}
