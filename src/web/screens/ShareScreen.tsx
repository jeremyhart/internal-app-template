import { useEffect, useRef, useState } from 'react';
import { cleanTitle, extractUrl } from '../../shared/url';
import { ApiFailure, api } from '../lib/api';
import { Button, Notice } from '../ui';

/**
 * Landing page for the manifest share target.
 *
 * The share target is GET, deliberately. A POST target is handled inside the
 * service worker, and a service worker POST against an expired Access session
 * receives an HTML login redirect instead of a response — which the worker
 * cannot do anything useful with. A GET lands here as a normal navigation,
 * Access re-authenticates the way it does for any page, and only then does the
 * page call the API same-origin with the session cookie attached.
 *
 * This must not block on anything slow: write the row, go to the list. The
 * summary catches up by itself.
 */
export function ShareScreen({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    // Android is inconsistent about which param carries the URL: Chrome often
    // uses `text`, some apps append it to `title`. Search all three.
    const url = extractUrl(params.get('url'), params.get('text'), params.get('title'));

    if (!url) {
      setError('That share did not contain a link.');
      return;
    }

    void (async () => {
      try {
        await api.createLink({ url, title: cleanTitle(params.get('title'), url), source: 'share' });
        onDone();
      } catch (cause) {
        if (cause instanceof ApiFailure && cause.code === 'reauthenticating') return;
        setError(cause instanceof Error ? cause.message : 'Could not save that link.');
      }
    })();
  }, [onDone]);

  return (
    <div className="app">
      <div style={{ marginTop: 'var(--space-8)' }} className="stack">
        {error ? (
          <>
            <Notice tone="danger">{error}</Notice>
            <div>
              <Button variant="primary" onClick={onDone}>
                Go to your links
              </Button>
            </div>
          </>
        ) : (
          <Notice>Saving…</Notice>
        )}
      </div>
    </div>
  );
}
