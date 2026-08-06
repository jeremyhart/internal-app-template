import { useCallback, useEffect, useState } from 'react';
import { ApiFailure, api, type AppStatus } from './lib/api';
import { ListScreen } from './screens/ListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShareScreen } from './screens/ShareScreen';

/**
 * Two screens, plus the share landing page. A router library would be more
 * code than the app it routes.
 */
type Route = 'list' | 'settings' | 'share';

function routeFor(pathname: string): Route {
  if (pathname.startsWith('/share')) return 'share';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'list';
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFor(window.location.pathname));
  const [status, setStatus] = useState<AppStatus | null>(null);

  const refreshStatus = useCallback(() => {
    void api
      .status()
      .then(setStatus)
      .catch((cause: unknown) => {
        if (!(cause instanceof ApiFailure && cause.code === 'reauthenticating')) setStatus(null);
      });
  }, []);

  useEffect(refreshStatus, [refreshStatus]);

  useEffect(() => {
    const onPop = () => setRoute(routeFor(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: Route, path: string) => {
    window.history.pushState(null, '', path);
    setRoute(next);
  }, []);

  if (route === 'share') {
    return (
      <ShareScreen
        onDone={() => {
          // replaceState, not push: the share URL must not sit in history where
          // a back-navigation would save the link a second time.
          window.history.replaceState(null, '', '/');
          setRoute('list');
          refreshStatus();
        }}
      />
    );
  }

  if (route === 'settings') {
    return <SettingsScreen status={status} onBack={() => navigate('list', '/')} />;
  }

  return (
    <ListScreen
      status={status}
      onNavigateSettings={() => navigate('settings', '/settings')}
      onStatusChange={refreshStatus}
    />
  );
}
