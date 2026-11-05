// Utilitaires de dates sans dépendance, utilisables côté navigateur et serveur.
// Toutes les dates sont affichées à l'heure de Paris.

export const TZ = 'Europe/Paris';

/** Date du jour à Paris au format YYYY-MM-DD. */
export function todayParis(): string {
  return dayKey(new Date());
}

/** Jour (YYYY-MM-DD, heure de Paris) d'un instant. */
export function dayKey(d: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
}

/** Ajoute n jours à une date YYYY-MM-DD (sans souci de changement d'heure). */
export function addDaysStr(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine d'une date YYYY-MM-DD. */
export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  return addDaysStr(date, weekday === 0 ? -6 : 1 - weekday);
}

export function isDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isTimeStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

export function formatDayLong(d: Date | string): string {
  const s = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(d: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

/** Pour une date YYYY-MM-DD (pas un instant). */
export function formatDateStr(date: string): string {
  return formatDayLong(`${date}T12:00:00Z`);
}
