import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Link, LinkStatus } from '../../shared/types';
import { isHttpUrl } from '../../shared/url';
import { ApiFailure, api, type AppStatus } from '../lib/api';
import { AppBar, Button, EmptyState, Field, Notice, Stack } from '../ui';
import { LinkRow } from './LinkRow';

type Filter = LinkStatus | 'all';

// A summary is written after the response, so the list has to catch up on its
// own — the acceptance criterion is that no manual refresh is ever required.
// Polling only runs while something is actually pending, and stops when the
// tab is hidden.
const POLL_INTERVAL_MS = 6000;

export function ListScreen({
  status,
  onNavigateSettings,
  onStatusChange,
}: {
  status: AppStatus | null;
  onNavigateSettings: () => void;
  onStatusChange: () => void;
}) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [filter, setFilter] = useState<Filter>('unread');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLinks(await api.listLinks());
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiFailure && cause.code === 'reauthenticating') return;
      setError(cause instanceof Error ? cause.message : 'Could not load your links.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = (links ?? []).some((link) => link.summary === null);

  useEffect(() => {
    if (!pending || !status?.summarisation_enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    pollTimer.current = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [pending, status?.summarisation_enabled, load]);

  // url is not unique by design; count repeats so a re-save is visible in the
  // row rather than rejected at the API.
  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links ?? []) counts.set(link.url, (counts.get(link.url) ?? 0) + 1);
    return counts;
  }, [links]);

  const visible = useMemo(
    () => (links ?? []).filter((link) => filter === 'all' || link.status === filter),
    [links, filter],
  );

  async function addLink(event: React.FormEvent) {
    event.preventDefault();
    const url = draft.trim();
    if (!isHttpUrl(url)) {
      setError('That does not look like a link.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.createLink({ url, source: 'manual' });
      setLinks((current) => [created, ...(current ?? [])]);
      setDraft('');
      setError(null);
      onStatusChange();
    } catch (cause) {
      if (!(cause instanceof ApiFailure && cause.code === 'reauthenticating')) {
        setError(cause instanceof Error ? cause.message : 'Could not save that link.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function apply(link: Link, next: LinkStatus) {
    setLinks((current) =>
      (current ?? []).map((item) =>
        item.id === link.id
          ? { ...item, status: next, read_at: next === 'read' ? Date.now() : null }
          : item,
      ),
    );
    try {
      await api.setStatus(link.id, next);
    } catch {
      void load();
    }
  }

  async function remove(link: Link) {
    const previous = links;
    setLinks((current) => (current ?? []).filter((item) => item.id !== link.id));
    try {
      await api.deleteLink(link.id);
      onStatusChange();
    } catch {
      setLinks(previous);
      setError('Could not delete that link.');
    }
  }

  return (
    <div className="app">
      <AppBar
        title="Link Stash"
        actions={
          <>
            {(['unread', 'read', 'all'] as Filter[]).map((option) => (
              <Button
                key={option}
                variant={filter === option ? 'primary' : 'quiet'}
                onClick={() => setFilter(option)}
              >
                {option}
              </Button>
            ))}
            <Button variant="quiet" onClick={onNavigateSettings} title="Settings">
              ⚙<span className="visually-hidden">Settings</span>
            </Button>
          </>
        }
      />

      <form onSubmit={addLink} style={{ margin: 'var(--space-4) 0' }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Field
              label="Add a link"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button variant="primary" type="submit" disabled={saving || !draft.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {links === null ? (
        <Notice>Loading…</Notice>
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            links.length === 0
              ? 'Nothing stashed yet'
              : filter === 'unread'
                ? 'All caught up'
                : 'Nothing here'
          }
          hint={
            links.length === 0
              ? 'Install this app on your phone to get "Link Stash" in the Android share sheet.'
              : undefined
          }
        >
          {links.length === 0 ? (
            <>
              Share a link from your phone, or paste one above. Each one gets a one-sentence
              summary so you can skim the list without opening anything.
            </>
          ) : filter === 'unread' ? (
            <>Every saved link has been read. Nice.</>
          ) : (
            <>No links match this filter.</>
          )}
        </EmptyState>
      ) : (
        <Stack>
          {visible.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              duplicateCount={duplicateCounts.get(link.url) ?? 1}
              summarisationEnabled={status?.summarisation_enabled ?? false}
              onOpen={(item) => {
                if (item.status === 'unread') void apply(item, 'read');
              }}
              onToggleRead={(item) => apply(item, item.status === 'read' ? 'unread' : 'read')}
              onDelete={remove}
            />
          ))}
        </Stack>
      )}
    </div>
  );
}
