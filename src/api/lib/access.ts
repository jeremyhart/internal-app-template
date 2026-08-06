import type { MiddlewareHandler } from 'hono';
import type { AppContext, Env } from './env';
import { unauthorized } from './errors';

/**
 * Cloudflare Access identity contract (standards §2, ADR-002).
 *
 * Every route verifies `Cf-Access-Jwt-Assertion` against the team JWKS before
 * handling a request. No exceptions, including endpoints that "aren't
 * sensitive". There is no auth code beyond this file — no users, no sessions.
 */

const JWKS_CACHE_KEY = 'access:jwks';
const JWKS_TTL_SECONDS = 3600;

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

interface JwtHeader {
  alg: string;
  kid: string;
}

interface JwtPayload {
  aud: string | string[];
  iss: string;
  exp: number;
  nbf?: number;
  iat?: number;
  email?: string;
  sub?: string;
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

async function fetchJwks(env: Env): Promise<Jwk[]> {
  const cached = await env.CACHE.get<Jwk[]>(JWKS_CACHE_KEY, 'json');
  if (cached) return cached;

  const res = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw unauthorized('Could not fetch Access signing keys');

  const body = (await res.json()) as { keys: Jwk[] };
  const keys = body.keys ?? [];
  await env.CACHE.put(JWKS_CACHE_KEY, JSON.stringify(keys), {
    expirationTtl: JWKS_TTL_SECONDS,
  });
  return keys;
}

/** Verifies the assertion and returns the caller's email. Throws on any doubt. */
export async function verifyAccessJwt(token: string, env: Env): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 3) throw unauthorized('Malformed Access assertion');
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = decodeJson<JwtHeader>(headerB64);
    payload = decodeJson<JwtPayload>(payloadB64);
  } catch {
    throw unauthorized('Malformed Access assertion');
  }

  if (header.alg !== 'RS256') throw unauthorized('Unexpected assertion algorithm');

  let keys = await fetchJwks(env);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Key rotation: drop the cache once and refetch before giving up.
    await env.CACHE.delete(JWKS_CACHE_KEY);
    keys = await fetchJwks(env);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw unauthorized('Unknown Access signing key');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!verified) throw unauthorized('Invalid Access assertion signature');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw unauthorized('Access assertion has expired');
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) {
    throw unauthorized('Access assertion is not yet valid');
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(env.ACCESS_AUD)) {
    throw unauthorized('Access assertion audience mismatch');
  }
  if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) {
    throw unauthorized('Access assertion issuer mismatch');
  }

  return payload.email ?? payload.sub ?? 'unknown';
}

/** Applied to the whole `/api` tree. There is no unauthenticated route. */
export const requireAccess: MiddlewareHandler<AppContext> = async (c, next) => {
  const token =
    c.req.header('Cf-Access-Jwt-Assertion') ??
    // Access also sets the assertion as a cookie on the protected hostname.
    /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(c.req.header('Cookie') ?? '')?.[1];

  if (!token) throw unauthorized('Missing Access assertion');

  c.set('userEmail', await verifyAccessJwt(token, c.env));
  await next();
};
