import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-destructive/10 border border-destructive rounded-lg p-6">
            <h2 className="text-xl font-emphasis text-destructive mb-4">Something went wrong</h2>
            <p className="text-sm mb-4">The application encountered an error:</p>
            <div className="text-xs bg-black/20 p-3 rounded mb-4 font-mono overflow-auto max-h-96">
              <div className="mb-2 text-destructive font-bold">
                {this.state.error && this.state.error.toString()}
              </div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
