import { useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import LibrarianDashboard from './components/Dashboard';
import { signIn, signOut } from './components/api';

function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError('');
    try {
      await signIn(String(form.get('username')), String(form.get('password')));
      setSignedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  if (signedIn) {
    return <LibrarianDashboard onSignOut={() => { signOut(); setSignedIn(false); }} />;
  }

  return (
    <main className="container py-5" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-4">Librarian sign-in</h1>
      <form onSubmit={handleSignIn}>
        <label className="form-label" htmlFor="staff-username">Username</label>
        <input className="form-control mb-3" id="staff-username" name="username" autoComplete="username" required maxLength={128} />
        <label className="form-label" htmlFor="staff-password">Password</label>
        <input className="form-control mb-3" id="staff-password" name="password" type="password" autoComplete="current-password" required maxLength={512} />
        {error && <p className="text-danger" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

export default App;
