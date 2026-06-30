// Skeleton — loading placeholders в b/w aesthetic Hone'а.
//
// Использует `.shimmer` класс из globals.css (linear-gradient через
// rgba(255,255,255,0.04→0.08→0.04), animation 1.4s ease-in-out infinite).
// Reduced-motion media query в globals.css сам отключает animation для
// accessibility — тут ничего не делаем.
//
// Variants:
//   - <SkeletonLine width={...}/> — одна строка text-уровня
//   - <SkeletonCard/> — карточка с paddings
//   - <PageSkeleton/> — full-page placeholder для Suspense fallback
//     lazy-pages. Геометрия: top header bar + 3 ряда карточек.
import React, { memo } from 'react';

interface SkeletonLineProps {
  width?: number | string;
  height?: number;
  style?: React.CSSProperties;
}

const SkeletonLine = memo(function SkeletonLine({ width = '100%', height = 12, style }: SkeletonLineProps): React.ReactElement {
  const finalStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: 6,
    ...style,
  };
  return <div className="shimmer" style={finalStyle} aria-hidden />;
});

interface SkeletonCardProps {
  height?: number;
  style?: React.CSSProperties;
}

const SkeletonCard = memo(function SkeletonCard({ height = 96, style }: SkeletonCardProps): React.ReactElement {
  const finalStyle: React.CSSProperties = {
    width: '100%',
    height,
    borderRadius: 10,
    border: '1px solid var(--ink-tint-04)',
    ...style,
  };
  return <div className="shimmer" style={finalStyle} aria-hidden />;
});

const PAGE_SKELETON_ROOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  padding: '64px 32px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const PAGE_SKELETON_HEADER_STYLE: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center' };
const PAGE_SKELETON_ROW_STYLE: React.CSSProperties = { display: 'flex', gap: 16 };
const PAGE_SKELETON_CARD_FLEX_STYLE: React.CSSProperties = { flex: 1 };

// PageSkeleton — заполняет всю canvas-area пока lazy chunk грузится. Не
// imitate'ит конкретную page (TaskBoard vs Notes выглядят по-разному), а
// показывает generic «что-то грузится» placeholder в стиле Hone — без
// spinner'а или text «loading…».
export const PageSkeleton = memo(function PageSkeleton(): React.ReactElement {
  return (
    <div className="motion-page-in" style={PAGE_SKELETON_ROOT_STYLE} aria-busy="true" aria-live="polite">
      {/* Header strip */}
      <div style={PAGE_SKELETON_HEADER_STYLE}>
        <SkeletonLine width={120} height={14} />
        <div style={PAGE_SKELETON_CARD_FLEX_STYLE} />
        <SkeletonLine width={64} height={14} />
      </div>
      {/* Content rows */}
      <div style={PAGE_SKELETON_ROW_STYLE}>
        <SkeletonCard style={PAGE_SKELETON_CARD_FLEX_STYLE} height={120} />
        <SkeletonCard style={PAGE_SKELETON_CARD_FLEX_STYLE} height={120} />
        <SkeletonCard style={PAGE_SKELETON_CARD_FLEX_STYLE} height={120} />
      </div>
      <SkeletonCard height={200} />
      <SkeletonCard height={140} />
    </div>
  );
});
