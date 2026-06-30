import { memo } from 'react';

const groupWrapStyle: React.CSSProperties = { margin: '0 0 56px' };
const groupTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
  margin: '0 0 4px',
};
const groupRuleStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--ink-tint-08)',
  margin: '0 0 28px',
};

const headStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'var(--ink-40)',
};

const sectionStyle: React.CSSProperties = { margin: '0 0 44px' };
const titleStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'var(--ink-60)',
};
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink-40)',
  margin: '6px 0 16px',
};
const bodyWithHintStyle: React.CSSProperties = { marginTop: 0 };
const bodyNoHintStyle: React.CSSProperties = { marginTop: 14 };

export const SectionGroup = memo(function SectionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={groupWrapStyle}>
      <h2 style={groupTitleStyle}>{title}</h2>
      <div aria-hidden style={groupRuleStyle} />
      {children}
    </div>
  );
});

export const SectionHead = memo(function SectionHead({ label }: { label: string }) {
  return (
    <div className="mono" style={headStyle}>
      {label}
    </div>
  );
});

export const Section = memo(function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div className="mono" style={titleStyle}>
        {title}
      </div>
      {hint && <div style={hintStyle}>{hint}</div>}
      <div style={hint ? bodyWithHintStyle : bodyNoHintStyle}>{children}</div>
    </section>
  );
});
