import { formatDayLong, formatTime } from './dates';
import { LOCATION_LABELS, formatPrice, type Booking, type Service, type Settings } from './types';

export function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string | null) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.log(`[email non envoyé — RESEND_API_KEY/EMAIL_FROM manquants] à ${to} : ${subject}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) console.error('Erreur Resend', res.status, await res.text());
  } catch (e) {
    console.error("Échec de l'envoi d'email", e);
  }
}

function details(b: Booking, service: Service, settings: Settings): string {
  const where =
    b.location_type === 'cabinet'
      ? `${LOCATION_LABELS.cabinet}${settings.cabinet_address ? ` — ${esc(settings.cabinet_address)}` : ''}`
      : `${LOCATION_LABELS[b.location_type]} — ${esc(b.address)}`;
  return `
    <table style="border-collapse:collapse;font-size:15px">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Prestation</td><td><strong>${esc(service.name)}</strong> (${service.duration_min} min, ${formatPrice(service.price_cents)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>${formatDayLong(b.start_at)} à ${formatTime(b.start_at)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Lieu</td><td>${where}</td></tr>
    </table>`;
}

function wrap(body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:auto;color:#1f2937;line-height:1.5">${body}</div>`;
}

export async function notifyNewBooking(b: Booking, service: Service, settings: Settings, baseUrl: string) {
  const cancelUrl = `${baseUrl}/annuler/${b.cancel_token}`;
  const name = esc(settings.practitioner_name || 'Votre masseur');

  await sendEmail(
    b.client_email,
    `Réservation confirmée — ${formatDayLong(b.start_at)} à ${formatTime(b.start_at)}`,
    wrap(`
      <p>Bonjour ${esc(b.client_name)},</p>
      <p>Votre séance est confirmée :</p>
      ${details(b, service, settings)}
      <p>Le règlement se fait sur place.</p>
      <p>Besoin d'annuler ? <a href="${cancelUrl}">Cliquez ici</a>
      (au plus tard ${settings.cancel_notice_hours} h avant la séance).</p>
      <p>À bientôt,<br>${name}</p>`),
    settings.practitioner_email,
  );

  if (settings.practitioner_email) {
    await sendEmail(
      settings.practitioner_email,
      `Nouvelle réservation : ${b.client_name} — ${formatDayLong(b.start_at)} ${formatTime(b.start_at)}`,
      wrap(`
        <p>Nouvelle réservation :</p>
        ${details(b, service, settings)}
        <p><strong>${esc(b.client_name)}</strong><br>
        ${esc(b.client_phone)} — <a href="mailto:${esc(b.client_email)}">${esc(b.client_email)}</a></p>
        ${b.notes ? `<p><em>Note du client :</em><br>${esc(b.notes).replace(/\n/g, '<br>')}</p>` : ''}`),
      b.client_email,
    );
  }
}

export async function notifyCancellation(
  b: Booking,
  service: Service,
  settings: Settings,
  by: 'client' | 'masseur',
) {
  const subject = `Séance annulée — ${formatDayLong(b.start_at)} à ${formatTime(b.start_at)}`;
  await sendEmail(
    b.client_email,
    subject,
    wrap(`
      <p>Bonjour ${esc(b.client_name)},</p>
      <p>${by === 'client' ? 'Votre annulation a bien été prise en compte' : 'Votre séance a dû être annulée'} :</p>
      ${details(b, service, settings)}
      <p>${esc(settings.practitioner_name || '')}</p>`),
    settings.practitioner_email,
  );
  if (by === 'client' && settings.practitioner_email) {
    await sendEmail(
      settings.practitioner_email,
      `Annulation : ${b.client_name} — ${formatDayLong(b.start_at)} ${formatTime(b.start_at)}`,
      wrap(`<p>${esc(b.client_name)} a annulé sa séance :</p>${details(b, service, settings)}`),
    );
  }
}
