import type { Metadata, Viewport } from 'next';
import { isDemo } from '@/lib/supabase';
import './globals.css';

export const metadata: Metadata = {
  title: 'Réserver une séance — Médecine chinoise & massage sportif',
  description: 'Choisissez votre prestation et votre créneau en ligne.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {isDemo && (
          <div className="demo-banner">
            Mode démo — données fictives, rien n&apos;est enregistré. Espace masseur : <a href="/admin">/admin</a>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
