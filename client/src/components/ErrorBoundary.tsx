import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Component, ReactNode, ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { nanoid } from "nanoid";

interface ErrorBoundaryProps {
  children: ReactNode;
  // Fallback component to render on error
  fallback?: ReactNode;
  // Custom error handler
  onError?: (error: Error, errorInfo: ErrorInfo, correlationId: string) => void;
  // Level of the boundary (app, page, component)
  level?: "app" | "page" | "component";
  // Custom recovery action
  onRecover?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  correlationId: string;
  showDetails: boolean;
  copiedId: boolean;
}

/**
 * ErrorBoundary - Catches JavaScript errors in child components
 * 
 * Usage:
 * - App level: Wrap entire app in App.tsx
 * - Page level: Wrap individual pages
 * - Component level: Wrap critical components
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: "",
      showDetails: false,
      copiedId: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      correlationId: `err_${nanoid(12)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error to console with correlation ID
    console.error(`[ErrorBoundary] Correlation ID: ${this.state.correlationId}`);
    console.error("[ErrorBoundary] Error:", error);
    console.error("[ErrorBoundary] Component Stack:", errorInfo.componentStack);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo, this.state.correlationId);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: "",
      showDetails: false,
    });
    this.props.onRecover?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  handleCopyId = async (): Promise<void> => {
    await navigator.clipboard.writeText(this.state.correlationId);
    this.setState({ copiedId: true });
    setTimeout(() => this.setState({ copiedId: false }), 2000);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = "app" } = this.props;
      const { error, errorInfo, correlationId, showDetails, copiedId } = this.state;

      // App-level error: full page takeover
      if (level === "app") {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="max-w-lg w-full">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <CardTitle>Something went wrong</CardTitle>
                <CardDescription>
                  We're sorry, but something unexpected happened. Please try again or return to the home page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reference ID */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Reference ID:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">{correlationId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={this.handleCopyId}
                  >
                    {copiedId ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                {/* Error details (collapsible) */}
                <Collapsible open={showDetails} onOpenChange={(open) => this.setState({ showDetails: open })}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="text-xs">View error details</span>
                      {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-md bg-muted p-3 mt-2 max-h-48 overflow-auto">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                        {error?.message || "Unknown error"}
                      </p>
                      {errorInfo?.componentStack && (
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={this.handleRetry} className="flex-1">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={this.handleReload} className="flex-1">
                    Reload Page
                  </Button>
                  <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  If this problem persists, please contact support with the reference ID above.
                </p>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Page-level error: card within layout
      if (level === "page") {
        return (
          <div className="flex items-center justify-center p-8">
            <Card className="max-w-md w-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-lg">Page Error</CardTitle>
                </div>
                <CardDescription>
                  This page encountered an error. You can try again or navigate elsewhere.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Reference:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded">{correlationId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={this.handleCopyId}
                  >
                    {copiedId ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>

                <Collapsible open={showDetails} onOpenChange={(open) => this.setState({ showDetails: open })}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                      Error details
                      {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-md bg-muted p-2 mt-2 max-h-32 overflow-auto">
                      <p className="text-xs text-red-600 dark:text-red-400">{error?.message}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex gap-2">
                  <Button size="sm" onClick={this.handleRetry} className="flex-1">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={this.handleReload} className="flex-1">
                    Reload
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Component-level error: minimal inline display
      return (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Component Error
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1 truncate">
                {error?.message || "An error occurred"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={this.handleRetry} className="h-7 text-xs">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
                <span className="text-xs text-muted-foreground">
                  ID: {correlationId}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * withErrorBoundary - HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  
  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  
  return WithErrorBoundary;
}

/**
 * PageErrorBoundary - Pre-configured boundary for pages
 */
export function PageErrorBoundary({ children }: { children: ReactNode }): ReactNode {
  return (
    <ErrorBoundary level="page">
      {children}
    </ErrorBoundary>
  );
}

/**
 * ComponentErrorBoundary - Pre-configured boundary for components
 */
export function ComponentErrorBoundary({ children }: { children: ReactNode }): ReactNode {
  return (
    <ErrorBoundary level="component">
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
