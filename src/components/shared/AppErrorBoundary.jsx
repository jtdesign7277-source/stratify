import { Component } from 'react';

const formatErrorMessage = (error) => {
  if (!error) return 'A runtime error occurred while rendering this page.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || 'A runtime error occurred while rendering this page.';
  return 'A runtime error occurred while rendering this page.';
};

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
    this.handleGoBack = this.handleGoBack.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[app/error-boundary] Unhandled render error:', error, errorInfo);
  }

  handleGoBack() {
    if (typeof window === 'undefined') return;

    if (window.history.length > 1) {
      window.history.back();
      window.setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 200);
      return;
    }

    window.location.assign('/');
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#060d18] px-4 py-8 text-white sm:px-6">
          <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center">
            <div className="w-full rounded-2xl border border-red-500/30 bg-[#0a1628] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-red-300">Application Error</p>
              <h1 className="mt-2 text-xl font-semibold text-[#e5e7eb]">This page crashed unexpectedly.</h1>
              <p className="mt-3 text-sm text-[#9ca3af]">{formatErrorMessage(this.state.error)}</p>
              <button
                type="button"
                onClick={this.handleGoBack}
                className="mt-6 inline-flex items-center rounded-lg border border-white/15 bg-[#060d18] px-4 py-2 text-sm font-medium text-[#e5e7eb] transition hover:border-white/30 hover:bg-[#0f172a]"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
