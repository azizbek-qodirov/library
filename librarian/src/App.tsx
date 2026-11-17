import type { Message } from '../../shared/i18n';
import { useI18n } from '../../shared/i18n';
import { LanguageSelect } from '../../shared/LanguageSelect';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import LibrarianDashboard from './components/Dashboard';
import { signIn, signOut, StaffSignInError } from './components/api';

function App() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = t('Staff page title');
  }, [t]);
  const [signedIn, setSignedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Message | null>(null);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await signIn(String(form.get('username')), String(form.get('password')));
      setSignedIn(true);
    } catch (err) {
      setError(err instanceof StaffSignInError ? err.key : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (signedIn) {
    return <LibrarianDashboard onSignOut={() => { signOut(); setSignedIn(false); }} />;
  }

  return (
    <>
      <div className="staff-sign-in-tools"><LanguageSelect /></div>
      <main className="container py-5" style={{ maxWidth: 420 }}>
        <h1 className="h3 mb-4">{t("Librarian sign-in")}</h1>
        <form onSubmit={handleSignIn}>
          <label className="form-label" htmlFor="staff-username">{t("Username")}</label>
          <input className="form-control mb-3" id="staff-username" name="username" autoComplete="username" required maxLength={128} />
          <label className="form-label" htmlFor="staff-password">{t("Password")}</label>
          <input className="form-control mb-3" id="staff-password" name="password" type="password" autoComplete="current-password" required maxLength={512} />
          {error && <p className="text-danger" role="alert">{t(error)}</p>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? t("Signing in…") : t("Sign in")}
          </button>
        </form>
      </main>
    </>
  );
}

export default App;
