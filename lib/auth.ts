import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDemo } from './supabase';

const COOKIE = 'admin_session';
const MAX_AGE_S = 7 * 24 * 3600;

/** En mode démo (développement sans configuration), le mot de passe est « demo ». */
export const DEMO_PASSWORD = 'demo';

function secret(): string {
  const s = process.env.SESSION_SECRET || (isDemo ? 'secret-de-demo-uniquement-pour-le-developpement' : '');
  if (!s || s.length < 32) throw new Error('SESSION_SECRET doit faire au moins 32 caractères.');
  return s;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || (isDemo ? DEMO_PASSWORD : '');
  if (!expected) return false;
  // Comparaison des empreintes : même longueur, temps constant.
  return safeEqual(sign(`pw:${password}`), sign(`pw:${expected}`));
}

export async function createSession(): Promise<void> {
  const exp = String(Date.now() + MAX_AGE_S * 1000);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}
