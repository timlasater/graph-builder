import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Graph Builder could not display the current view:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="app-recovery" role="alert">
      <h1>Graph Builder hit a display problem</h1>
      <p>Your downloaded project files have not been changed. If a local recovery copy is available, the app will offer it when you reopen the page.</p>
      <p>Try reloading. If the problem returns, reopen your last downloaded <code>.graphbuilder.json</code> project file.</p>
      <button onClick={() => window.location.reload()}>Reload Graph Builder</button>
    </main>
  }
}
