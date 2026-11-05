export type LocationType = 'cabinet' | 'domicile' | 'club';

export const LOCATIONS: LocationType[] = ['cabinet', 'domicile', 'club'];

export const LOCATION_LABELS: Record<LocationType, string> = {
  cabinet: 'Au cabinet',
  domicile: 'À domicile',
  club: 'En club / événement',
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  active: boolean;
  sort: number;
};

export type Settings = {
  practitioner_name: string | null;
  practitioner_email: string | null;
  cabinet_address: string | null;
  slot_step_min: number;
  min_notice_hours: number;
  travel_buffer_min: number;
  cancel_notice_hours: number;
};

export type Booking = {
  id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  location_type: LocationType;
  address: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  notes: string | null;
  status: 'confirmed' | 'cancelled';
  cancel_token: string;
};

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
