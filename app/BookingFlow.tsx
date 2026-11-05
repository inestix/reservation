'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDaysStr, dayKey, formatDateStr, formatDayLong, formatTime, todayParis } from '@/lib/dates';
import { LOCATIONS, LOCATION_LABELS, formatPrice, type LocationType, type Service } from '@/lib/types';

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS = ['Prestation', 'Lieu', 'Créneau', 'Coordonnées'];

export default function BookingFlow({
  services,
  cabinetAddress,
}: {
  services: Service[];
  cabinetAddress: string | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const [service, setService] = useState<Service | null>(null);
  const [location, setLocation] = useState<LocationType>('cabinet');
  const [address, setAddress] = useState('');
  const [weekStart, setWeekStart] = useState(todayParis());
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotError, setSlotError] = useState('');
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (step !== 3 || !service) return;
    let cancelled = false;
    setSlots(null);
    setSlotError('');
    const qs = new URLSearchParams({ service: service.id, location, from: weekStart, days: '7' });
    fetch(`/api/slots?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setSlots(d.slots))
      .catch(() => !cancelled && setSlotError('Impossible de charger les créneaux. Réessayez.'));
    return () => {
      cancelled = true;
    };
  }, [step, service, location, weekStart, reload]);

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (let i = 0; i < 7; i++) map.set(addDaysStr(weekStart, i), []);
    for (const s of slots ?? []) map.get(dayKey(s))?.push(s);
    return [...map.entries()];
  }, [slots, weekStart]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !slot) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: service.id, location, address, start: slot, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStep(5);
      } else if (res.status === 409) {
        setSlot(null);
        setReload((n) => n + 1);
        setStep(3);
        setSlotError(data.error ?? 'Ce créneau n’est plus disponible.');
      } else {
        setError(data.error ?? 'Une erreur est survenue.');
      }
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  if (services.length === 0) {
    return <p className="card muted">Aucune prestation n’est proposée pour le moment.</p>;
  }

  if (step === 5 && service && slot) {
    return (
      <div className="card success">
        <h2>✓ Réservation confirmée</h2>
        <p>
          <strong>{service.name}</strong> le <strong>{formatDayLong(slot)}</strong> à{' '}
          <strong>{formatTime(slot)}</strong>.
        </p>
        <p className="muted">
          Un email de confirmation a été envoyé à {form.email}. Il contient un lien pour annuler si besoin.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <ol className="stepper">
        {STEP_LABELS.map((l, i) => (
          <li key={l} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}>
            <span>{i + 1}</span> {l}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="stack-sm">
          <h2>Quelle prestation ?</h2>
          {services.map((s) => (
            <button
              key={s.id}
              className={`option ${service?.id === s.id ? 'selected' : ''}`}
              onClick={() => {
                setService(s);
                setSlot(null);
                setStep(2);
              }}
            >
              <div>
                <strong>{s.name}</strong>
                {s.description && <div className="muted small">{s.description}</div>}
              </div>
              <div className="option-meta">
                <span>{s.duration_min} min</span>
                <strong>{formatPrice(s.price_cents)}</strong>
              </div>
            </button>
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="stack-sm">
          <h2>Où se déroule la séance ?</h2>
          {LOCATIONS.map((l) => (
            <label key={l} className={`option ${location === l ? 'selected' : ''}`}>
              <input
                type="radio"
                name="location"
                checked={location === l}
                onChange={() => {
                  setLocation(l);
                  setSlot(null);
                }}
              />
              <div className="grow">
                <strong>{LOCATION_LABELS[l]}</strong>
                {l === 'cabinet' && cabinetAddress && <div className="muted small">{cabinetAddress}</div>}
              </div>
            </label>
          ))}
          {location !== 'cabinet' && (
            <label>
              {location === 'domicile' ? 'Votre adresse' : 'Nom et adresse du club / lieu'}
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue …, 63000 Clermont-Ferrand" />
            </label>
          )}
          <div className="row between">
            <button className="btn" onClick={() => setStep(1)}>
              ← Retour
            </button>
            <button
              className="btn primary"
              disabled={location !== 'cabinet' && address.trim().length < 5}
              onClick={() => setStep(3)}
            >
              Voir les créneaux →
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="stack-sm">
          <h2>Choisissez un créneau</h2>
          <div className="row between week-nav">
            <button
              className="btn small"
              disabled={weekStart <= todayParis()}
              onClick={() => setWeekStart(addDaysStr(weekStart, -7) < todayParis() ? todayParis() : addDaysStr(weekStart, -7))}
            >
              ← Précédent
            </button>
            <span className="muted small">
              {formatDateStr(weekStart)} – {formatDateStr(addDaysStr(weekStart, 6))}
            </span>
            <button className="btn small" onClick={() => setWeekStart(addDaysStr(weekStart, 7))}>
              Suivant →
            </button>
          </div>
          {slotError && <p className="error">{slotError}</p>}
          {slots === null && !slotError && <p className="muted">Chargement des créneaux…</p>}
          {slots !== null && (
            <div className="days">
              {slots.length === 0 && (
                <p className="muted">
                  Aucun créneau libre cette semaine.{' '}
                  <button className="link" onClick={() => setWeekStart(addDaysStr(weekStart, 7))}>
                    Voir la semaine suivante
                  </button>
                </p>
              )}
              {days
                .filter(([, list]) => list.length > 0)
                .map(([day, list]) => (
                  <div key={day} className="day">
                    <h4>{formatDateStr(day)}</h4>
                    <div className="slots">
                      {list.map((s) => (
                        <button
                          key={s}
                          className={`slot ${slot === s ? 'selected' : ''}`}
                          onClick={() => {
                            setSlot(s);
                            setStep(4);
                          }}
                        >
                          {formatTime(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div>
            <button className="btn" onClick={() => setStep(2)}>
              ← Retour
            </button>
          </div>
        </section>
      )}

      {step === 4 && service && slot && (
        <form className="stack-sm" onSubmit={submit}>
          <h2>Vos coordonnées</h2>
          <div className="card recap">
            <strong>{service.name}</strong> · {service.duration_min} min · {formatPrice(service.price_cents)}
            <div>
              {formatDayLong(slot)} à {formatTime(slot)}
            </div>
            <div className="muted small">
              {LOCATION_LABELS[location]}
              {location === 'cabinet' ? (cabinetAddress ? ` — ${cabinetAddress}` : '') : ` — ${address}`}
            </div>
          </div>
          <label>
            Nom et prénom
            <input required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="row">
            <label className="grow">
              Email
              <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="grow">
              Téléphone
              <input type="tel" required autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          <label>
            Sport pratiqué, douleurs, objectifs… <span className="muted">(facultatif)</span>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <p className="muted small">Règlement sur place.</p>
          {error && <p className="error">{error}</p>}
          <div className="row between">
            <button type="button" className="btn" onClick={() => setStep(3)}>
              ← Changer de créneau
            </button>
            <button className="btn primary" disabled={submitting}>
              {submitting ? 'Réservation…' : 'Confirmer la réservation'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
