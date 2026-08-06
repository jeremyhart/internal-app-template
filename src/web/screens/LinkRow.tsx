import type { Link } from '../../shared/types';
import { hostnameOf } from '../../shared/url';
import { relativeTime } from '../../shared/time';
import { Badge, Button } from '../ui';

export function LinkRow({
  link,
  duplicateCount,
  summarisationEnabled,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  link: Link;
  duplicateCount: number;
  summarisationEnabled: boolean;
  onOpen: (link: Link) => void;
  onToggleRead: (link: Link) => void;
  onDelete: (link: Link) => void;
}) {
  const host = hostnameOf(link.url);
  const title = link.title?.trim() || host;

  return (
    <article className={`link-row${link.status === 'read' ? ' link-row--read' : ''}`}>
      <div className="link-row__body">
        <a
          className="link-row__title"
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => onOpen(link)}
        >
          {title}
        </a>

        {link.summary ? (
          <p className="link-row__summary">{link.summary}</p>
        ) : (
          /* Not an error — a row waiting on the retry cron, or a feature that
             is simply switched off. Either way it should read as intentional. */
          <p className="link-row__summary--pending">
            {summarisationEnabled ? 'Summary on its way' : 'No summary'}
          </p>
        )}

        <div className="link-row__meta">
          <span>{host}</span>
          <span className="link-row__meta-sep" aria-hidden="true" />
          <span>{relativeTime(link.created_at)}</span>
          {link.status === 'read' ? (
            <>
              <span className="link-row__meta-sep" aria-hidden="true" />
              <span>read</span>
            </>
          ) : null}
          {duplicateCount > 1 ? <Badge>saved {duplicateCount}×</Badge> : null}
        </div>
      </div>

      <div className="link-row__actions">
        <Button
          variant="quiet"
          onClick={() => onToggleRead(link)}
          title={link.status === 'read' ? 'Mark unread' : 'Mark read'}
        >
          {link.status === 'read' ? '↺' : '✓'}
          <span className="visually-hidden">
            {link.status === 'read' ? 'Mark unread' : 'Mark read'}
          </span>
        </Button>
        <Button variant="quiet" className="button--danger" onClick={() => onDelete(link)} title="Delete">
          ✕<span className="visually-hidden">Delete</span>
        </Button>
      </div>
    </article>
  );
}
