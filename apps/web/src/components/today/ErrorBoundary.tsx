import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  message: string
}

type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <p className="text-sm text-text-muted">{this.props.message}</p>
        </section>
      )
    }
    return this.props.children
  }
}
