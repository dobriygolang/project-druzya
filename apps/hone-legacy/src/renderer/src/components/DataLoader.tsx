// DataLoader — uniform status-aware wrapper для Hone'овых async surfaces.
//
// Заменяет повсеместный pattern «{loading ? 'loading…' : data ? <Body/> :
// '— нет данных —'}» который не различает error и empty, тихо проглатывает
// English / DailyBrief, чтобы skeleton + error + retry были консистентны.
//
// B/W rule: error stripe — `#FF3B30` 1.5px top-border + plain text label,
// никакого fill/background. Никаких иконок-эмодзи — только текстовые

import type { ReactNode } from 'react';

import { translate } from '@d9-i18n';

import type { DataState } from '../hooks/useDataState';

interface DataLoaderProps<T> {
  state: DataState<T>;
  /** Rendered during loading / idle. Use skeleton geometry matching the
   * ready-state layout to avoid CLS. */
  skeleton: ReactNode;
  /** Override the «не удалось загрузить» fallback label. */
  errorLabel?: string;
  /** Optional empty-state override when data === null after ready. By
   * default falls through to skeleton (rare; most surfaces have a
   * specific empty UI inside children). */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function DataLoader<T>({
  state,
  skeleton,
  errorLabel,
  empty,
  children,
}: DataLoaderProps<T>): JSX.Element {
  if (state.status === 'idle' || state.status === 'loading') {
    return <>{skeleton}</>;
  }
  if (state.status === 'error') {
    return <ErrorPanel error={state.error} label={errorLabel} onRetry={state.refetch} />;
  }
  if (state.data === null) {
    return <>{empty ?? skeleton}</>;
  }
  return <>{children(state.data)}</>;
}

interface ErrorPanelProps {
  error: Error | null;
  label?: string;
  onRetry: () => void;
}

function ErrorPanel({ error, label, onRetry }: ErrorPanelProps): JSX.Element {
  return (
    <div className="data-loader-error">
      <div className="data-loader-error-stripe" />
      <div className="data-loader-error-body">
        <div className="data-loader-error-label">{label ?? translate('hone.data.err.load_failed')}</div>
        {error?.message && (
          <div className="data-loader-error-detail">{error.message}</div>
        )}
        <button type="button" className="data-loader-error-retry" onClick={onRetry}>
          retry
        </button>
      </div>
    </div>
  );
}
