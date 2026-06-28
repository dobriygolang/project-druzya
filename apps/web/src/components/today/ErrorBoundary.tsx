import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; section: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <p className="text-sm text-text-muted">
            {this.props.section} failed to load.
          </p>
        </section>
      )
    }
    return this.props.children
  }
}
