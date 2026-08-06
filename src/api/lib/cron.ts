import type { Env } from './env';
import { FLAG_SUMMARISATION, isEnabled } from './flags';
import { findUnsummarised } from './links.repo';
import { summariseLink } from './summarise';

/**
 * Retry sweep (ADR-006).
 *
 * Cron Triggers do not retry and do not alert, so two things matter here:
 * the batch is small enough to finish well inside one invocation, and every
 * run — including the ones that fail — writes a row to `cron_runs`. That table
 * is the only way a silent failure becomes visible.
 */

// Old enough that the waitUntil() attempt from capture has certainly finished.
const MIN_AGE_MS = 5 * 60 * 1000;
// Small: each item is a subrequest plus an AI call, and the Neuron pool is
// account-wide. Better to drain slowly than to starve the rest of the fleet.
const BATCH_SIZE = 5;

export async function runRetrySweep(env: Env): Promise<void> {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();

  await env.DB.prepare('INSERT INTO cron_runs (id, started_at, count) VALUES (?1, ?2, 0)')
    .bind(runId, startedAt)
    .run();

  let count = 0;
  let error: string | null = null;

  try {
    if (await isEnabled(env, FLAG_SUMMARISATION)) {
      const pending = await findUnsummarised(env, MIN_AGE_MS, BATCH_SIZE);
      for (const link of pending) {
        // Sequential on purpose: it keeps the AI calls inside the Neuron budget
        // and well under the free-plan subrequest cap.
        if (await summariseLink(env, link)) count += 1;
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  }

  await env.DB.prepare('UPDATE cron_runs SET ended_at = ?1, count = ?2, error = ?3 WHERE id = ?4')
    .bind(Date.now(), count, error, runId)
    .run();
}
