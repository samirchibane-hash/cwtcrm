import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence for a render-time crash. Without this, one bad record
 * takes the whole app to a white screen with no way back — the reporter can't
 * even tell us what broke. Show the record's failure, keep the app navigable,
 * and surface the message so it can be pasted into a bug report.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full content-card p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">This page failed to load</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Something in this record broke the view. Try again, or head back and let us know what
            you were opening.
          </p>
          <p className="mt-3 text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 break-words text-left">
            {error.message || 'Unknown error'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button size="sm" onClick={this.reset} className="gap-1.5">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try again
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                this.reset();
                window.location.assign('/');
              }}
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
