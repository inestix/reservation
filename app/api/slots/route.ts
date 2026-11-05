import { NextResponse, type NextRequest } from 'next/server';
import { addDaysStr, isDateStr } from '@/lib/dates';
import { computeSlots, getActiveService, getSettings } from '@/lib/slots';
import { parisToUtc } from '@/lib/time';
import { LOCATIONS, type LocationType } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/slots?service=<id>&location=cabinet&from=2026-11-10&days=7
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const location = sp.get('location') as LocationType;
  const from = sp.get('from');
  const days = Math.min(Math.max(Number(sp.get('days') ?? 7) || 7, 1), 31);

  if (!LOCATIONS.includes(location) || !isDateStr(from)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  const service = await getActiveService(sp.get('service') ?? '');
  if (!service) return NextResponse.json({ error: 'Prestation introuvable' }, { status: 404 });

  const slots = await computeSlots({
    service,
    location,
    from: parisToUtc(from, '00:00'),
    to: parisToUtc(addDaysStr(from, days), '00:00'),
    settings: await getSettings(),
  });
  return NextResponse.json({ slots });
}
