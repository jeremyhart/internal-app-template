import { beforeAll, describe, expect, it } from 'vitest';
import { verifyAccessJwt } from '../src/api/lib/access';
import type { Env } from '../src/api/lib/env';

/**
 * The identity contract is the one thing in this app that must not be wrong,
 * and it is the one thing an integration test cannot cover (there is no Access
 * in CI). So: a real RSA keypair, a real signature, and the JWKS primed into a
 * fake KV so nothing goes over the network.
 */

const TEAM_DOMAIN = 'example.cloudflareaccess.com';
const AUD = 'aud-value-for-this-app';
const KID = 'test-key-1';

let signingKey: CryptoKey;
let otherSigningKey: CryptoKey;
let env: Env;

function b64url(input: string | Uint8Array): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return Buffer.from(bytes).toString('base64url');
}

async function mint(
  payload: Record<string, unknown>,
  opts: { kid?: string; alg?: string; key?: CryptoKey } = {},
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? KID }));
  const body = b64url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    opts.key ?? signingKey,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${b64url(new Uint8Array(signature))}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: AUD,
    iss: `https://${TEAM_DOMAIN}`,
    exp: now + 600,
    iat: now,
    email: 'jeremy@example.com',
    ...overrides,
  };
}

beforeAll(async () => {
  const params = {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  } as const;

  const pair = await crypto.subtle.generateKey(params, true, ['sign', 'verify']);
  const impostor = await crypto.subtle.generateKey(params, true, ['sign', 'verify']);
  signingKey = pair.privateKey;
  otherSigningKey = impostor.privateKey;

  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwks = [{ kid: KID, kty: jwk.kty!, n: jwk.n!, e: jwk.e!, alg: 'RS256' }];

  const store = new Map<string, string>([['access:jwks', JSON.stringify(jwks)]]);
  env = {
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    ACCESS_AUD: AUD,
    APP_NAME: 'link-stash',
    CACHE: {
      get: async (key: string, type?: string) => {
        const value = store.get(key) ?? null;
        return value !== null && type === 'json' ? JSON.parse(value) : value;
      },
      put: async (key: string, value: string) => void store.set(key, value),
      delete: async (key: string) => void store.delete(key),
    },
  } as unknown as Env;
});

describe('verifyAccessJwt', () => {
  it('accepts a correctly signed, current assertion and returns the email', async () => {
    await expect(verifyAccessJwt(await mint(validPayload()), env)).resolves.toBe(
      'jeremy@example.com',
    );
  });

  it('accepts an aud array that contains this app', async () => {
    const token = await mint(validPayload({ aud: ['other-app', AUD] }));
    await expect(verifyAccessJwt(token, env)).resolves.toBe('jeremy@example.com');
  });

  it('rejects an expired assertion — this is the expired-session path', async () => {
    const token = await mint(validPayload({ exp: Math.floor(Date.now() / 1000) - 1 }));
    await expect(verifyAccessJwt(token, env)).rejects.toThrow(/expired/i);
  });

  it('rejects an assertion for a different Access application', async () => {
    const token = await mint(validPayload({ aud: 'some-other-app' }));
    await expect(verifyAccessJwt(token, env)).rejects.toThrow(/audience/i);
  });

  it('rejects an assertion from a different team', async () => {
    const token = await mint(validPayload({ iss: 'https://evil.cloudflareaccess.com' }));
    await expect(verifyAccessJwt(token, env)).rejects.toThrow(/issuer/i);
  });

  it('rejects a signature from a key that is not in the JWKS', async () => {
    const token = await mint(validPayload(), { key: otherSigningKey });
    await expect(verifyAccessJwt(token, env)).rejects.toThrow(/signature/i);
  });

  it('rejects a tampered payload', async () => {
    const token = await mint(validPayload());
    const [header, , signature] = token.split('.');
    const forged = b64url(JSON.stringify(validPayload({ email: 'someone@else.com' })));
    await expect(verifyAccessJwt(`${header}.${forged}.${signature}`, env)).rejects.toThrow(
      /signature/i,
    );
  });

  it('rejects alg=none rather than trusting the header', async () => {
    const header = b64url(JSON.stringify({ alg: 'none', kid: KID }));
    const body = b64url(JSON.stringify(validPayload()));
    await expect(verifyAccessJwt(`${header}.${body}.`, env)).rejects.toThrow(/algorithm/i);
  });

  it('rejects a malformed assertion', async () => {
    await expect(verifyAccessJwt('not-a-jwt', env)).rejects.toThrow(/malformed/i);
  });
});
