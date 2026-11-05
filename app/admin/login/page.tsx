import { login } from '../actions';

export const metadata = { title: 'Connexion — Espace masseur' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="container narrow">
      <div className="card">
        <h1>Espace masseur</h1>
        <form action={login} className="stack">
          <label>
            Mot de passe
            <input type="password" name="password" required autoFocus autoComplete="current-password" />
          </label>
          {e && <p className="error">Mot de passe incorrect.</p>}
          <button className="btn primary">Se connecter</button>
        </form>
      </div>
    </main>
  );
}
