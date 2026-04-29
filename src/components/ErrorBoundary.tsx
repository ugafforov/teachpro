import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/errorUtils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError('ErrorBoundary', { error: error.message, stack: errorInfo.componentStack });
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Xatolik yuz berdi
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Ilovada kutilmagan xatolik yuz berdi. Iltimos, sahifani yangilab ko'ring.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-muted rounded-lg text-left overflow-auto max-h-48">
                <p className="text-sm font-mono text-destructive">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs text-muted-foreground mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleReload}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sahifani yangilash
              </Button>
              
              {!import.meta.env.DEV && (
                <Button
                  variant="outline"
                  onClick={this.handleReset}
                >
                  Qayta urinish
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
