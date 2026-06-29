// Hone. Mirror'ит frontend/src/components/ErrorBoundary.tsx, но стилизован
// под Hone'овый B/W hairline язык: классы `.data-loader-error*` уже
// определены в styles/globals.css (см. CI1 stylesheet block 1265).
//
// Цель: единичный page-level crash не валит весь app. Pure React semantics
// (try/catch для render-time errors). Async fetch failures ловятся через
// <DataLoader> + useDataState — здесь они не нужны.
//
// Usage:
//   <ErrorBoundary section="Notes — AI links" onRetry={() => refetch()}>
//     <BacklinksPanel ... />
//   </ErrorBoundary>

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { translate } from '@d9-i18n';

interface Props {
  /** Human-readable section name (shown в fallback). */
  section?: string;
  /** Retry callback (e.g. refetch / reload state). Если предоставлен,
   * кнопка «retry» вызывает её + сбрасывает error state. Если нет —
   * кнопка просто сбрасывает state. */
  onRetry?: () => void;
  /** Custom fallback (overrides default). */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Dev: full stack в console; prod hook добавим вместе с sentry ship.
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', this.props.section, error, info.componentStack);
    }
  }

  retry = (): void => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }
      return (
        <div className="data-loader-error" role="alert" style={{ margin: '12px 0' }}>
          <div className="data-loader-error-stripe" />
          <div className="data-loader-error-body">
            <div className="data-loader-error-label">
              {translate('hone.error.fell', { section: this.props.section ?? translate('hone.error.unknown_section') })}
            </div>
            <div className="data-loader-error-detail">
              {this.state.error.message || translate('hone.error.unknown')}
            </div>
            <button
              type="button"
              className="data-loader-error-retry focus-ring motion-press"
              onClick={this.retry}
            >
              retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
