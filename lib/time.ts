import { fromZonedTime } from 'date-fns-tz';
import { TZ } from './dates';

/** Convertit une date + heure saisies à Paris en instant UTC. */
export function parisToUtc(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}
