import { useState } from 'react';

import { useSessionStore } from '@shared/model/session';

// SignOutSection — кнопка выхода. Wipe'ает access/refresh tokens из
// keychain'а и in-memory store'а. Local IndexedDB (notes, ydoc) НЕ
// трогаем — юзер может logout'ниться и снова login'ниться, его данные
// останутся доступны (и снова отсинкаются с server'ом). Это явный
// контракт: log out = forget who I am, не «wipe my data».
const signedOutStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-60)' };
const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
const userStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-40)',
  letterSpacing: '0.08em',
};

export function SignOutSection() {
  const userId = useSessionStore((s) => s.userId);
  const status = useSessionStore((s) => s.status);
  const clear = useSessionStore((s) => s.clear);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clear();
      // App.tsx subscribed на status; SignedOut → LoginScreen отрисуется
      // автоматом, manual reload не нужен.
    } finally {
      setBusy(false);
    }
  };

  const btnStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: '8px 18px',
    fontSize: 12.5,
    fontWeight: 500,
    color: '#fff',
    background: busy ? 'rgba(255,59,48,0.4)' : 'var(--red)',
    border: 'none',
    borderRadius: 8,
    cursor: busy ? 'default' : 'pointer',
    transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
  };

  if (status !== 'signed_in') {
    return (
      <div style={signedOutStyle}>You're signed out. Open the login screen to sign back in.</div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div className="mono" style={userStyle}>
        Signed in as {userId ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : 'unknown'}
      </div>
      <button onClick={handleClick} disabled={busy} style={btnStyle}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
