# Réservation — massage sportif

Plateforme de prise de rendez-vous en ligne pour un masseur sportif.

- **Page client** (`/`) : le client choisit une prestation, le lieu (cabinet, domicile, club),
  un créneau libre, puis laisse ses coordonnées. Il reçoit un email de confirmation avec un lien d'annulation.
- **Espace masseur** (`/admin`) : réservations à venir, saisie des disponibilités
  (ponctuelles ou répétées chaque semaine), gestion des prestations et réglages.

Technique : Next.js · Supabase (base de données) · Resend (emails) · hébergement Vercel.

---

## 1. Créer la base de données (Supabase)

1. Créez un compte gratuit sur [supabase.com](https://supabase.com) puis un **nouveau projet**
   (région : Europe, ex. Paris ou Francfort).
2. Menu **SQL Editor** → **New query** → collez tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Menu **Project Settings → API** : notez l'**URL du projet** et la clé **service_role** (secrète).

## 2. Les emails (Resend) — facultatif pour tester

1. Créez un compte sur [resend.com](https://resend.com), ajoutez et vérifiez votre nom de domaine.
2. Créez une clé API.

Sans Resend, le site fonctionne : les emails sont juste affichés dans la console.

## 3. Lancer le site sur votre ordinateur

Prérequis : [Node.js](https://nodejs.org) (version LTS).

```bash
cp .env.example .env.local   # puis remplissez les valeurs
npm install
npm run dev
```

- Page client : http://localhost:3000
- Espace masseur : http://localhost:3000/admin (mot de passe = `ADMIN_PASSWORD`)

Pour générer `SESSION_SECRET` : `openssl rand -hex 32`

## 4. Mettre en ligne (Vercel)

1. Connectez-vous sur [vercel.com](https://vercel.com) avec votre compte GitHub.
2. **Add New → Project** → importez le dépôt `reservation`.
3. Dans **Environment Variables**, ajoutez les mêmes variables que dans `.env.local`
   (avec `NEXT_PUBLIC_SITE_URL` = l'adresse finale du site, ex. `https://reservation-massage.fr`).
4. **Deploy**. Chaque modification envoyée sur GitHub remet le site à jour automatiquement.

Le lien à donner aux clients est simplement l'adresse du site.

---

## Fonctionnement

- **Créneaux** : le masseur saisit des *plages* (ex. mardi 14h–19h). Le site propose toutes les heures
  de début (toutes les 15 min par défaut) où la prestation choisie tient entièrement dans la plage.
- **Trajets** : pour une séance à domicile ou en club, un temps de trajet (30 min par défaut) est bloqué
  avant et après le rendez-vous.
- **Pas de double réservation** : vérifiée au moment de réserver, et garantie par une contrainte
  dans la base de données, même si deux clients cliquent au même instant.
- **Délais** : délai minimum avant une réservation (12 h) et limite d'annulation (24 h), réglables.
- **Sécurité** : la base n'est jamais accessible directement depuis le navigateur ; tout passe par le
  serveur. L'espace masseur est protégé par mot de passe (cookie signé, 7 jours).

## Structure

```
app/
  page.tsx, BookingFlow.tsx   parcours client
  api/slots                   calcul des créneaux libres
  api/bookings                création d'une réservation
  annuler/[token]             annulation par le client
  admin/                      espace masseur (+ login, actions)
lib/                          base de données, calcul des créneaux, emails, dates
supabase/schema.sql           structure de la base
```
