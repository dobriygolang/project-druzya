import { memo, useCallback } from 'react';

import { useT } from '@d9-i18n';

import { VaultButton } from './VaultButton';

// VaultPasswordForm — inline replacement для window.prompt() который
// в Electron renderer не работает (Chromium блокирует JS-prompt). Mode:
// 'setup' рендерит два поля + warning, 'unlock' — одно поле.
const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 10,
  background: 'var(--ink-tint-02)',
  border: '1px solid var(--ink-10)',
};

const warningStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink-60)',
  lineHeight: 1.55,
  marginBottom: 4,
};

const recoveryStyle: React.CSSProperties = { color: 'var(--red)' };

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  borderRadius: 8,
  border: '1px solid var(--ink-10)',
  background: 'rgb(var(--ink-rgb) / 0.03)',
  color: 'var(--ink)',
  outline: 'none',
};

const ctaRowStyle: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 4 };

export const VaultPasswordForm = memo(function VaultPasswordForm({
  mode,
  pwd1,
  pwd2,
  onPwd1Change,
  onPwd2Change,
  onSubmit,
  onCancel,
  busy,
}: {
  mode: 'setup' | 'unlock';
  pwd1: string;
  pwd2: string;
  onPwd1Change: (v: string) => void;
  onPwd2Change: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const t = useT();
  const onPwd1 = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPwd1Change(e.target.value),
    [onPwd1Change],
  );
  const onPwd2 = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPwd2Change(e.target.value),
    [onPwd2Change],
  );
  const onFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSubmit();
    },
    [onSubmit],
  );
  return (
    <form onSubmit={onFormSubmit} style={formStyle}>
      {mode === 'setup' && (
        <div style={warningStyle}>
          {t('hone.settings.vault.form.warning_pre')}
          <strong style={recoveryStyle}>{t('hone.settings.vault.form.warning_recovery')}</strong>
          {t('hone.settings.vault.form.warning_post')}
        </div>
      )}
      <input
        type="password"
        value={pwd1}
        onChange={onPwd1}
        placeholder={mode === 'setup' ? t('hone.settings.vault.form.new_password_placeholder') : t('hone.settings.vault.form.vault_password_placeholder')}
        autoFocus
        autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
        style={inputStyle}
      />
      {mode === 'setup' && (
        <input
          type="password"
          value={pwd2}
          onChange={onPwd2}
          placeholder={t('hone.settings.vault.form.confirm_password_placeholder')}
          autoComplete="new-password"
          style={inputStyle}
        />
      )}
      <div style={ctaRowStyle}>
        <VaultButton onClick={onSubmit} disabled={busy} primary>
          {busy ? '…' : mode === 'setup' ? t('hone.settings.vault.form.cta.setup') : t('hone.settings.vault.form.cta.unlock')}
        </VaultButton>
        <VaultButton onClick={onCancel} disabled={busy}>
          {t('hone.settings.vault.form.cta.cancel')}
        </VaultButton>
      </div>
    </form>
  );
});
