import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Parallel Life] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg px-6">
          <div className="w-full max-w-md rounded-lg border border-line bg-white p-10 shadow-card">
            <p className="pl-label">System Fault</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">时间线发生了坍缩</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              应用遇到了未预期的错误。你的宇宙数据仍安全保存在本地数据库中。
            </p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-bg p-3 font-mono text-xs text-muted">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="mt-6 w-full rounded-md bg-dark px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-85"
            >
              返回首页
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}