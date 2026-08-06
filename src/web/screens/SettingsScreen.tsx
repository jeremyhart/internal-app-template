import type { AppStatus } from '../lib/api';
import { AppBar, Button, Card, DefinitionList, Notice } from '../ui';

export function SettingsScreen({
  status,
  onBack,
}: {
  status: AppStatus | null;
  onBack: () => void;
}) {
  return (
    <div className="app">
      <AppBar
        title="Settings"
        actions={<Button variant="quiet" onClick={onBack}>Back</Button>}
      />

      <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
        <Card>
          <DefinitionList
            items={[
              ['Signed in as', status?.user ?? '—'],
              ['App', status?.app ?? '—'],
              [
                'Summaries',
                status
                  ? status.summarisation_enabled
                    ? 'On'
                    : 'Off'
                  : '—',
              ],
              ['Waiting for a summary', status ? String(status.pending_summaries) : '—'],
            ]}
          />
        </Card>

        <Card>
          <p style={{ marginTop: 0 }}>
            Summaries are generated after a link is saved, never while you wait. If one fails it
            is retried on a schedule, so a link with no summary is not a link that has gone wrong.
          </p>
          <p style={{ marginBottom: 0 }}>
            The feature sits behind a flag and can be switched off without a deploy:
            <code> wrangler kv key put flag:link-stash.summarisation false</code>
          </p>
        </Card>

        <Notice>
          Sign-in is handled by Cloudflare Access. There is no account to manage here, and no
          password to change — this app has never seen one.
        </Notice>
      </div>
    </div>
  );
}
