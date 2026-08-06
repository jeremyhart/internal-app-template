/*
 * Minimal service worker.
 *
 * Its only job is to make the app installable, which is what registers the
 * share target with Android. It intentionally has no fetch handler:
 *
 *  - Caching anything behind Cloudflare Access risks serving a cached login
 *    page, or a cached page to a session that has since expired.
 *  - Offline reading is out of scope.
 *
 * The share target is GET precisely so that no request ever has to be handled
 * here — the browser navigates to /share and the page does the work.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
