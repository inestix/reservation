import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoClient } from './demo-db';

let client: SupabaseClient | null = null;

/** Mode démo : en développement, sans Supabase configuré → données factices en mémoire. */
export const isDemo = !process.env.SUPABASE_URL && process.env.NODE_ENV !== 'production';

/** Client Supabase côté serveur uniquement (clé service_role). */
export function db(): SupabaseClient {
  if (isDemo) return demoClient as unknown as SupabaseClient;
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis (voir .env.example).',
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
