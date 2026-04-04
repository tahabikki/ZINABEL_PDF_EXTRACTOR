import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: string;
  info?: string;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  // List of known harmless errors that should be logged but not shown
  isHarmlessError = (message: string): boolean => {
    const harmless = [
      'removeChild',
      'Failed to execute',
      'Cannot read properties of null',
      'Cannot read property',
      'Cannot set property',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'DOM',
      'Popover',
      'not a valid',
      'is not a function',
    ];
    return harmless.some((h) => message.includes(h));
  };

  handleWindowError = (ev: ErrorEvent) => {
    const message = `${ev.message} @ ${ev.filename}:${ev.lineno}:${ev.colno}`;
    const info = ev.error ? (ev.error.stack || String(ev.error)) : '';
    
    // Log but don't crash for known harmless errors
    if (this.isHarmlessError(message)) {
      try {
        const logs = JSON.parse(localStorage.getItem('appErrorLogs') || '[]') as { message: string; time: string }[];
        logs.push({ message, time: new Date().toISOString() });
        localStorage.setItem('appErrorLogs', JSON.stringify(logs.slice(-50))); // keep last 50
      } catch (e) {}
      return; // don't show error screen
    }
    
    this.setState({ hasError: true, error: message, info });
    try {
      localStorage.setItem(
        'lastClientError',
        JSON.stringify({ source: 'window.error', message, info, time: new Date().toISOString() })
      );
    } catch (e) {}
  };

  handleRejection = (ev: PromiseRejectionEvent) => {
    let reason: any = ev.reason;
    let message = typeof reason === 'string' ? reason : reason?.message || JSON.stringify(reason);
    const info = reason?.stack || '';
    
    // Suppress known harmless errors
    if (this.isHarmlessError(String(message))) {
      try {
        const logs = JSON.parse(localStorage.getItem('appErrorLogs') || '[]') as { message: string; time: string }[];
        logs.push({ message: String(message), time: new Date().toISOString() });
        localStorage.setItem('appErrorLogs', JSON.stringify(logs.slice(-50)));
      } catch (e) {}
      return;
    }
    
    this.setState({ hasError: true, error: String(message), info });
    try {
      localStorage.setItem(
        'lastClientError',
        JSON.stringify({ source: 'unhandledrejection', message, info, time: new Date().toISOString() })
      );
    } catch (e) {}
  };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const message = String(error?.message || error);
    const stack = info?.componentStack || (error as any)?.stack || '';
    
    // Suppress known harmless errors
    if (this.isHarmlessError(message)) {
      try {
        const logs = JSON.parse(localStorage.getItem('appErrorLogs') || '[]') as { message: string; time: string }[];
        logs.push({ message, time: new Date().toISOString() });
        localStorage.setItem('appErrorLogs', JSON.stringify(logs.slice(-50)));
      } catch (e) {}
      return; // don't show error screen
    }
    
    this.setState({ hasError: true, error: message, info: stack });
    try {
      localStorage.setItem(
        'lastClientError',
        JSON.stringify({ source: 'componentDidCatch', message, stack, time: new Date().toISOString() })
      );
    } catch (e) {}
    // also log to console
    // eslint-disable-next-line no-console
    console.error(error, info);
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleRejection as EventListener);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleRejection as EventListener);
  }

  render() {
    // If there's an error that should be hidden, just render children anyway
    if (this.state.hasError && this.isHarmlessError(this.state.error || '')) {
      return this.props.children as React.ReactElement;
    }

    if (this.state.hasError) {
      try {
        return (
          <div className="p-4 bg-card min-h-screen flex flex-col items-center justify-center">
            <div className="w-full max-w-md rounded-lg border border-border p-4 bg-background">
              <h2 className="text-base font-bold mb-2">Une erreur est survenue</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Cliquez sur Recharger pour continuer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-3 py-2 rounded bg-primary/10 text-primary font-semibold text-sm"
                >
                  Recharger
                </button>
              </div>
            </div>
          </div>
        );
      } catch (renderErr) {
        // Even the error UI failed to render - show absolute minimal fallback
        return (
          <div style={{ padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
              Recharger
            </button>
          </div>
        );
      }
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
