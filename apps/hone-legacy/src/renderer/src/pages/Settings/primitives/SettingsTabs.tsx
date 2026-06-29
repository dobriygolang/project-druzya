// SettingsTabs — minimal B/W horizontal tab strip for Settings page.
// Inline-стилизация чтобы не тянуть лишний CSS-модуль; design язык
// повторяет TutorTabsChrome, но без position:absolute — это inline-стрип
// внутри основной страницы.
import { memo, useCallback, type ReactNode } from 'react';

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  tabs: ReadonlyArray<TabDef<T>>;
  current: T;
  onChange: (id: T) => void;
}

// Голый flex-row: без bg/border/blur/padding-окантовки — иначе
// получается «коробка вокруг коробки». Активный таб сам несёт визуальный
// вес через свой pill-background.
const listStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  flexWrap: 'wrap',
  rowGap: 4,
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 14px',
  borderRadius: 8,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  transition:
    'background-color var(--motion-dur-small) var(--motion-ease-standard),' +
    'color var(--motion-dur-small) var(--motion-ease-standard)',
};

const btnActiveStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--ink-tint-08)',
  color: 'var(--ink)',
  fontWeight: 500,
};

const btnIdleStyle: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--ink-60)',
  fontWeight: 400,
};

export function SettingsTabs<T extends string>({ tabs, current, onChange }: Props<T>) {
  return (
    <div role="tablist" aria-label="Settings sections" style={listStyle}>
      {tabs.map((t) => (
        <TabBtn key={t.id} active={current === t.id} id={t.id} onClick={onChange}>
          {t.label}
        </TabBtn>
      ))}
    </div>
  );
}

interface TabBtnProps<T extends string> {
  active: boolean;
  id: T;
  onClick: (id: T) => void;
  children: ReactNode;
}

function TabBtnInner<T extends string>({ active, id, onClick, children }: TabBtnProps<T>) {
  const handleClick = useCallback(() => onClick(id), [onClick, id]);
  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) e.currentTarget.style.color = 'var(--ink-90)';
    },
    [active],
  );
  const handleLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) e.currentTarget.style.color = 'var(--ink-60)';
    },
    [active],
  );
  return (
    <button
      onClick={handleClick}
      role="tab"
      aria-selected={active}
      aria-pressed={active}
      className="focus-ring"
      style={active ? btnActiveStyle : btnIdleStyle}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}

const TabBtn = memo(TabBtnInner) as typeof TabBtnInner;
