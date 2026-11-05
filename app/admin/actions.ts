'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPassword, createSession, destroySession, requireAdmin } from '@/lib/auth';
import { addDaysStr, isDateStr, isTimeStr } from '@/lib/dates';
import { notifyCancellation } from '@/lib/email';
import { getSettings } from '@/lib/slots';
import { db } from '@/lib/supabase';
import { parisToUtc } from '@/lib/time';
import type { Booking, Service } from '@/lib/types';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const int = (fd: FormData, k: string, min: number, max: number) => {
  const n = Math.round(Number(str(fd, k).replace(',', '.')));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Valeur invalide pour ${k}`);
  return n;
};

function done(tab: string, msg?: string): never {
  revalidatePath('/admin');
  redirect(`/admin?tab=${tab}${msg ? `&msg=${encodeURIComponent(msg)}` : ''}`);
}

/* ---------- Connexion ---------- */

export async function login(fd: FormData) {
  if (checkPassword(str(fd, 'password'))) {
    await createSession();
    redirect('/admin');
  }
  await new Promise((r) => setTimeout(r, 800)); // ralentit les essais en série
  redirect('/admin/login?e=1');
}

export async function logout() {
  await destroySession();
  redirect('/admin/login');
}

/* ---------- Disponibilités ---------- */

export async function addAvailability(fd: FormData) {
  await requireAdmin();
  const date = str(fd, 'date');
  const start = str(fd, 'start');
  const end = str(fd, 'end');
  const weeks = int(fd, 'weeks', 1, 26);
  if (!isDateStr(date) || !isTimeStr(start) || !isTimeStr(end) || end <= start) {
    done('dispos', "Plage invalide : vérifiez la date et que l'heure de fin est après le début.");
  }
  const rows = Array.from({ length: weeks }, (_, i) => {
    const d = addDaysStr(date, i * 7);
    return { start_at: parisToUtc(d, start).toISOString(), end_at: parisToUtc(d, end).toISOString() };
  });
  const { error } = await db().from('availability').insert(rows);
  if (error) throw error;
  done('dispos', weeks > 1 ? `${weeks} plages ajoutées.` : 'Plage ajoutée.');
}

export async function deleteAvailability(fd: FormData) {
  await requireAdmin();
  const { error } = await db().from('availability').delete().eq('id', str(fd, 'id'));
  if (error) throw error;
  done('dispos');
}

/* ---------- Prestations ---------- */

export async function saveService(fd: FormData) {
  await requireAdmin();
  const id = str(fd, 'id');
  const name = str(fd, 'name');
  if (!name) done('prestations', 'Le nom est obligatoire.');
  const row = {
    name: name.slice(0, 120),
    description: str(fd, 'description').slice(0, 500) || null,
    duration_min: int(fd, 'duration_min', 10, 480),
    price_cents: Math.round(Number(str(fd, 'price').replace(',', '.') || 0) * 100),
    sort: int(fd, 'sort', 0, 999),
    active: fd.get('active') === 'on',
  };
  if (!Number.isFinite(row.price_cents) || row.price_cents < 0) done('prestations', 'Prix invalide.');
  const q = id ? db().from('services').update(row).eq('id', id) : db().from('services').insert(row);
  const { error } = await q;
  if (error) throw error;
  done('prestations', 'Prestation enregistrée.');
}

/* ---------- Réservations ---------- */

export async function cancelBookingByAdmin(fd: FormData) {
  await requireAdmin();
  const { data, error } = await db()
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', str(fd, 'id'))
    .eq('status', 'confirmed')
    .select('*, services(*)')
    .maybeSingle();
  if (error) throw error;
  if (data && fd.get('notify') === 'on') {
    const { services, ...b } = data as Booking & { services: Service };
    await notifyCancellation(b, services, await getSettings(), 'masseur');
  }
  done('reservations', 'Réservation annulée.');
}

/* ---------- Réglages ---------- */

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const { error } = await db()
    .from('settings')
    .update({
      practitioner_name: str(fd, 'practitioner_name').slice(0, 120) || null,
      practitioner_email: str(fd, 'practitioner_email').slice(0, 200) || null,
      cabinet_address: str(fd, 'cabinet_address').slice(0, 300) || null,
      slot_step_min: int(fd, 'slot_step_min', 5, 120),
      min_notice_hours: int(fd, 'min_notice_hours', 0, 720),
      travel_buffer_min: int(fd, 'travel_buffer_min', 0, 240),
      cancel_notice_hours: int(fd, 'cancel_notice_hours', 0, 720),
    })
    .eq('id', 1);
  if (error) throw error;
  done('reglages', 'Réglages enregistrés.');
}
