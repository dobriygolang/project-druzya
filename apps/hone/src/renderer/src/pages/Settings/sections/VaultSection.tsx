import { useCallback, useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

import { notesStoreReencryptAll } from '@features/notes/repository/notesStore';
import { pushAllNotesEncrypted } from '@shared/sync/domains/notesSync';
import { flushSync } from '@shared/sync/SyncEngine';
import { isSyncEnabled } from '@shared/sync/syncConfig';
import {
  fetchVaultSalt,
  initVault,
  isVaultUnlocked,
  lockVault,
  subscribeVault,
  unlockVault,
} from '@shared/crypto/vault';
import {
  generateRecoveryPhrase,
  hasRecoveryWrap,
  normalizeRecoveryPhrase,
  recoverPassphraseFromPhrase,
  saveRecoveryWrap,
  validateRecoveryPhrase,
} from '@shared/crypto/recoveryKey';
import {
  isVaultEnabledSync,
  loadVaultPrefs,
  setVaultEnabled,
} from '@shared/crypto/vaultPrefs';
import { useSessionStore } from '@shared/model/session';

import { SettingRow, SettingsGroup } from '../primitives/SettingRow';
import { Toggle } from '../primitives/Toggle';

type Modal =
  | { kind: 'setup' }
  | { kind: 'unlock' }
  | { kind: 'recovery' }
  | { kind: 'show-recovery'; phrase: string };

export function VaultSection() {
  const t = useT();
  const userId = useSessionStore((s) => s.userId);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(isVaultUnlocked());
  const [hasRecovery, setHasRecovery] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [enableAfterUnlock, setEnableAfterUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const en = await loadVaultPrefs(userId);
    setEnabled(en);
    setUnlocked(isVaultUnlocked());
    setHasRecovery(await hasRecoveryWrap(userId));
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = subscribeVault((u) => setUnlocked(u));
    return unsub;
  }, []);

  const finishEnable = useCallback(
    async (passphrase: string, recoveryPhrase: string) => {
      if (!userId) return;
      await saveRecoveryWrap(passphrase, recoveryPhrase);
      await setVaultEnabled(true, userId);
      await notesStoreReencryptAll(userId);
      if (isSyncEnabled()) {
        await pushAllNotesEncrypted();
        flushSync();
      }
      setEnabled(true);
      setHasRecovery(true);
      setModal(null);
      setPwd1('');
      setPwd2('');
      setRecoverySaved(false);
      setEnableAfterUnlock(false);
    },
    [userId],
  );

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      setError(null);
      if (next) {
        const salt = await fetchVaultSalt();
        setEnableAfterUnlock(true);
        setModal(salt ? { kind: 'unlock' } : { kind: 'setup' });
        return;
      }
      if (
        !window.confirm(t('hone.settings.vault.disable_confirm'))
      ) {
        return;
      }
      lockVault();
      await setVaultEnabled(false, userId);
      setEnabled(false);
    },
    [userId, t],
  );

  const handleSetup = async () => {
    setError(null);
    if (pwd1.length < 8) {
      setError(t('hone.vault.err.short_passphrase'));
      return;
    }
    if (pwd1 !== pwd2) {
      setError(t('hone.vault.err.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await initVault();
      await unlockVault(pwd1);
      const phrase = generateRecoveryPhrase();
      setModal({ kind: 'show-recovery', phrase });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    setError(null);
    if (!pwd1) {
      setError(t('hone.vault.err.empty'));
      return;
    }
    setBusy(true);
    try {
      await unlockVault(pwd1);
      if (!enableAfterUnlock) {
        setModal(null);
        setPwd1('');
        setUnlocked(true);
        return;
      }
      const wrap = await hasRecoveryWrap();
      if (wrap) {
        await setVaultEnabled(true, userId!);
        await notesStoreReencryptAll(userId!);
        if (isSyncEnabled()) flushSync();
        setEnabled(true);
        setModal(null);
        setPwd1('');
        setEnableAfterUnlock(false);
      } else {
        setModal({ kind: 'show-recovery', phrase: generateRecoveryPhrase() });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRecovery = async () => {
    setError(null);
    setBusy(true);
    try {
      const pass = await recoverPassphraseFromPhrase(normalizeRecoveryPhrase(recoveryInput));
      await unlockVault(pass);
      await setVaultEnabled(true, userId!);
      await notesStoreReencryptAll(userId!);
      if (isSyncEnabled()) flushSync();
      setEnabled(true);
      setUnlocked(true);
      setModal(null);
      setRecoveryInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = !enabled
    ? t('hone.settings.vault.status_off')
    : unlocked
      ? t('hone.settings.vault.status_unlocked')
      : t('hone.settings.vault.status_locked');

  return (
    <>
      <SettingsGroup title={t('hone.settings.section.vault')}>
        <SettingRow label={t('hone.settings.vault.label')} hint={t('hone.settings.vault.hint')}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <Toggle
              value={enabled}
              onChange={(v) => void handleToggle(v)}
              label={enabled ? t('hone.settings.vault.on') : t('hone.settings.vault.off')}
            />
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-40)' }}>
              {statusLabel}
            </span>
          </div>
        </SettingRow>

        {enabled && !unlocked && (
          <SettingRow label={t('hone.settings.vault.unlock_label')} hint={t('hone.settings.vault.unlock_hint')}>
            <button
              type="button"
              className="hone-settings-vault-btn"
              onClick={() => {
                setError(null);
                setPwd1('');
                setEnableAfterUnlock(false);
                setModal({ kind: 'unlock' });
              }}
            >
              {t('hone.vault.cta.unlock')}
            </button>
          </SettingRow>
        )}

        {enabled && unlocked && (
          <SettingRow label={t('hone.settings.vault.lock_label')} hint={t('hone.settings.vault.lock_hint')}>
            <button type="button" className="hone-settings-vault-btn" onClick={() => lockVault()}>
              {t('hone.settings.vault.lock_now')}
            </button>
          </SettingRow>
        )}

        {(enabled || hasRecovery) && (
          <SettingRow
            label={t('hone.settings.vault.recovery_label')}
            hint={t('hone.settings.vault.recovery_hint')}
          >
            <button
              type="button"
              className="hone-settings-vault-btn"
              onClick={() => {
                setError(null);
                setRecoveryInput('');
                setModal({ kind: 'recovery' });
              }}
            >
              {t('hone.settings.vault.recovery_cta')}
            </button>
          </SettingRow>
        )}
      </SettingsGroup>

      {modal && (
        <div className="hone-vault-modal-backdrop fadein" onClick={() => !busy && setModal(null)}>
          <div
            className="hone-vault-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {modal.kind === 'setup' && (
              <>
                <h2 className="hone-vault-modal__title">{t('hone.vault.setup.headline')}</h2>
                <p className="hone-vault-modal__body">{t('hone.settings.vault.setup_hint')}</p>
                <VaultPassForm
                  pwd1={pwd1}
                  pwd2={pwd2}
                  confirm
                  busy={busy}
                  error={error}
                  onPwd1={setPwd1}
                  onPwd2={setPwd2}
                  onSubmit={() => void handleSetup()}
                />
              </>
            )}

            {modal.kind === 'unlock' && (
              <>
                <h2 className="hone-vault-modal__title">{t('hone.vault.unlock.headline')}</h2>
                <p className="hone-vault-modal__body">{t('hone.vault.unlock.body')}</p>
                <VaultPassForm
                  pwd1={pwd1}
                  busy={busy}
                  error={error}
                  onPwd1={setPwd1}
                  onSubmit={() => void handleUnlock()}
                />
              </>
            )}

            {modal.kind === 'show-recovery' && (
              <>
                <h2 className="hone-vault-modal__title">{t('hone.settings.vault.recovery_save_title')}</h2>
                <p className="hone-vault-modal__body">{t('hone.settings.vault.recovery_save_body')}</p>
                <pre className="hone-vault-modal__phrase mono">{modal.phrase}</pre>
                <label className="hone-vault-modal__check">
                  <input
                    type="checkbox"
                    checked={recoverySaved}
                    onChange={(e) => setRecoverySaved(e.target.checked)}
                  />
                  {t('hone.settings.vault.recovery_saved_ack')}
                </label>
                {error && <p className="hone-vault-modal__error mono">{error}</p>}
                <button
                  type="button"
                  className="hone-vault-modal__primary"
                  disabled={!recoverySaved || busy}
                  onClick={() =>
                    void finishEnable(pwd1, modal.phrase).catch((e) =>
                      setError(e instanceof Error ? e.message : String(e)),
                    )
                  }
                >
                  {t('hone.settings.vault.recovery_done')}
                </button>
              </>
            )}

            {modal.kind === 'recovery' && (
              <>
                <h2 className="hone-vault-modal__title">{t('hone.settings.vault.recovery_title')}</h2>
                <p className="hone-vault-modal__body">{t('hone.settings.vault.recovery_body')}</p>
                <textarea
                  className="hone-vault-modal__textarea mono"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder={t('hone.settings.vault.recovery_placeholder')}
                  rows={4}
                />
                {error && <p className="hone-vault-modal__error mono">{error}</p>}
                <button
                  type="button"
                  className="hone-vault-modal__primary"
                  disabled={busy || !validateRecoveryPhrase(recoveryInput)}
                  onClick={() => void handleRecovery()}
                >
                  {busy ? t('hone.vault.cta.working') : t('hone.settings.vault.recovery_submit')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function VaultPassForm({
  pwd1,
  pwd2,
  confirm,
  busy,
  error,
  onPwd1,
  onPwd2,
  onSubmit,
}: {
  pwd1: string;
  pwd2?: string;
  confirm?: boolean;
  busy: boolean;
  error: string | null;
  onPwd1: (v: string) => void;
  onPwd2?: (v: string) => void;
  onSubmit: () => void;
}) {
  const t = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="hone-vault-modal__form"
    >
      <input
        type="password"
        className="hone-vault-pass-input"
        value={pwd1}
        onChange={(e) => onPwd1(e.target.value)}
        placeholder={t('hone.vault.input.passphrase')}
        disabled={busy}
        autoFocus
      />
      {confirm && onPwd2 && (
        <input
          type="password"
          className="hone-vault-pass-input"
          value={pwd2 ?? ''}
          onChange={(e) => onPwd2(e.target.value)}
          placeholder={t('hone.vault.input.confirm')}
          disabled={busy}
        />
      )}
      {error && <p className="hone-vault-modal__error mono">{error}</p>}
      <button type="submit" className="hone-vault-modal__primary" disabled={busy}>
        {busy ? t('hone.vault.cta.working') : t('hone.vault.cta.unlock')}
      </button>
    </form>
  );
}

/** Used by publish flow — vault enabled but locked blocks share. */
export function isVaultReadyForPublish(): boolean {
  return !isVaultEnabledSync() || isVaultUnlocked();
}
