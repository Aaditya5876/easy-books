import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// No error boundary existed anywhere in the app — any uncaught render error
// (e.g. a page choking on data from a company that just lost access, since a
// deactivated/expired company's API calls now 403 mid-session) unmounted the
// whole tree and left a blank white page with no way to recover short of
// manually editing the URL. This is the safety net: catches the crash, shows
// a clear message and a reload button instead of nothing at all.
class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-6 z-50">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              This page couldn't load — often because the company you're viewing lost access (deactivated, or its subscription expired). Try reloading; if that doesn't help, contact GeoInfosys.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Remounts (discarding any caught error) whenever the route changes, so
// navigating elsewhere recovers instead of staying stuck on the crash screen.
export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundaryInner key={location.pathname}>{children}</ErrorBoundaryInner>;
}
