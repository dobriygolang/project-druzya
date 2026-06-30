import { useState } from 'react';

import { useT } from '@d9-i18n';

import { useSessionStore } from '@shared/model/session';

export function SignOutSection() {
  const t = useT();
  const userId = useSessionStore((s) => s.userId);
  const status = useSessionStore((s) => s.status);
  const clear = useSessionStore((s) => s.clear);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clear();
    } finally {
      setBusy(false);
    }
  };

  if (status !== 'signed_in') {
    return <p className="hone-settings-signed-out">{t('hone.settings.signed_out')}</p>;
  }

  return (
    <div className="hone-settings-account">
      <p className="hone-settings-account__id mono">
        {t('hone.settings.signed_in', {
          id: userId ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : '—',
        })}
      </p>
      <button type="button" className="hone-settings-sign-out" onClick={() => void handleClick()} disabled={busy}>
        {busy ? t('hone.settings.sign_out.busy') : t('hone.settings.sign_out')}
      </button>
    </div>
  );
}
