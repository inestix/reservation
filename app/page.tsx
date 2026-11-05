import { getSettings } from '@/lib/slots';
import { db } from '@/lib/supabase';
import type { Service, Settings } from '@/lib/types';
import BookingFlow from './BookingFlow';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let services: Service[] = [];
  let settings: Settings | null = null;
  try {
    const [{ data, error }, s] = await Promise.all([
      db().from('services').select('*').eq('active', true).order('sort').order('name'),
      getSettings(),
    ]);
    if (error) throw error;
    services = data as Service[];
    settings = s;
  } catch (e) {
    console.error(e);
    return (
      <main className="container narrow">
        <div className="card">
          <h1>Réservation momentanément indisponible</h1>
          <p className="muted">Merci de réessayer un peu plus tard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container narrow">
      <header className="hero">
        <p className="eyebrow">Médecine chinoise &amp; massage sportif</p>
        <h1>Réserver une séance</h1>
        {settings.practitioner_name && <p className="muted">avec {settings.practitioner_name}</p>}
      </header>
      <BookingFlow services={services} cabinetAddress={settings.cabinet_address} />
    </main>
  );
}
