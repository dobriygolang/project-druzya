import { memo, type ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export const SettingRow = memo(function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className="hone-setting-row">
      <div className="hone-setting-row__meta">
        <div className="hone-setting-row__label">{label}</div>
        {hint ? <div className="hone-setting-row__hint">{hint}</div> : null}
      </div>
      <div className="hone-setting-row__control">{children}</div>
    </div>
  );
});

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
}

export const SettingsGroup = memo(function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <section className="hone-settings-group">
      <h2 className="hone-settings-group__title">{title}</h2>
      <div className="hone-settings-group__body">{children}</div>
    </section>
  );
});
