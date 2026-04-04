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
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
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
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-card min-h-screen flex flex-col items-center justify-center">
          <div className="max-w-xl w-full rounded-lg border border-border p-6 bg-background">
            <h2 className="text-lg font-bold mb-2">Une erreur est survenue</h2>
            <p className="text-sm text-muted-foreground mb-4">L'application a rencontré un problème. Vous pouvez recharger la page ou copier l'erreur pour la transmettre.</p>
            <div className="mb-4">
              <pre className="whitespace-pre-wrap text-xs bg-card p-3 rounded border border-border max-h-48 overflow-auto">{this.state.error}\n{this.state.info}</pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 rounded bg-primary/10 text-primary font-semibold"
              >
                Recharger
              </button>
              <button
                onClick={() => {
                  try {
                    const payload = JSON.stringify({ error: this.state.error, info: this.state.info });
                    navigator.clipboard.writeText(payload);
                  } catch (e) {}
                }}
                className="px-3 py-2 rounded border bg-card"
              >
                Copier l'erreur
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
