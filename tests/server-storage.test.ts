import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAdminSession,
  createUserSession,
  passwordHash,
  passwordMatches,
  verifyAdminSession,
  verifyUserSession,
} from '@/lib/server-storage';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;
const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

beforeAll(() => {
  process.env.SESSION_SECRET = 'unit-test-session-secret-0123456789abcdef-0123456789abcdef';
  process.env.ADMIN_PASSWORD = 'supersecret_admin_password_123';
});

afterAll(() => {
  if (ORIGINAL_SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
  if (ORIGINAL_ADMIN_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = ORIGINAL_ADMIN_PASSWORD;
});

/** Rebuilds a user-session token by hand, matching the documented signing scheme. */
function handSignUserSession(
  userId: string,
  expiresAtSeconds: number,
  info = 'ala-qaddi-user-session-v1',
) {
  const secret = process.env.SESSION_SECRET!;
  const key = createHmac('sha256', secret).update(info).digest();
  const payload = Buffer.from(`${userId}.${expiresAtSeconds}`).toString('base64url');
  const signature = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Rebuilds an admin token by hand (expiresAt.nonce.signature over ADMIN_PASSWORD). */
function handSignAdminSession(expiresAtSeconds: number, nonce: string) {
  const payload = `${expiresAtSeconds}.${nonce}`;
  const signature = createHmac('sha256', process.env.ADMIN_PASSWORD!)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

describe('password hashing', () => {
  it('verifies the correct password and rejects wrong ones', () => {
    const stored = passwordHash('صفتي-السرية-123');
    expect(passwordMatches('صفتي-السرية-123', stored)).toBe(true);
    expect(passwordMatches('wrong-password', stored)).toBe(false);
  });

  it('salts every hash differently', () => {
    const first = passwordHash('same-password-123');
    const second = passwordHash('same-password-123');
    expect(first).not.toBe(second);
    expect(passwordMatches('same-password-123', first)).toBe(true);
    expect(passwordMatches('same-password-123', second)).toBe(true);
  });

  it('stores 64-byte scrypt output as hex after the salt', () => {
    const [, hash] = passwordHash('another-secret-456').split(':');
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it('rejects malformed stored hashes without throwing', () => {
    expect(passwordMatches('x', 'no-colon-here')).toBe(false);
    expect(passwordMatches('x', 'salt:zz-not-hex')).toBe(false);
    expect(passwordMatches('x', 'salt:')).toBe(false);
  });
});

describe('user session tokens', () => {
  it('round-trips a signed session to the user id', () => {
    const token = createUserSession(UUID);
    expect(verifyUserSession(token)).toBe(UUID);
  });

  it('rejects tampered payloads and truncated signatures', () => {
    const token = createUserSession(UUID);
    const [payload, signature] = token.split('.');
    const flipped = (payload[0] === 'M' ? 'N' : 'M') + payload.slice(1);
    expect(verifyUserSession(`${flipped}.${signature}`)).toBeUndefined();
    expect(
      verifyUserSession(`${payload.slice(0, payload.length - 4)}.${signature}`),
    ).toBeUndefined();
    expect(verifyUserSession(`${payload}.${signature}extra`)).toBeUndefined();
  });

  it('rejects expired tokens', () => {
    const expired = handSignUserSession(UUID, Math.floor(Date.now() / 1000) - 10);
    expect(verifyUserSession(expired)).toBeUndefined();
  });

  it('rejects payloads that are not a uuid-timestamp pair', () => {
    const secret = process.env.SESSION_SECRET!;
    const key = createHmac('sha256', secret).update('ala-qaddi-user-session-v1').digest();
    const payload = Buffer.from('not-a-uuid.9999999999').toString('base64url');
    const signature = createHmac('sha256', key).update(payload).digest('base64url');
    expect(verifyUserSession(`${payload}.${signature}`)).toBeUndefined();
  });

  it('rejects tokens signed with a different derivation context', () => {
    const mismatched = handSignUserSession(UUID, Math.floor(Date.now() / 1000) + 3600, 'other-v1');
    expect(verifyUserSession(mismatched)).toBeUndefined();
  });

  it('fails loudly when SESSION_SECRET is missing', () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(() => createUserSession(UUID)).toThrow(/SESSION_SECRET/);
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });
});

describe('admin session tokens', () => {
  it('issues unique nonce-based tokens that verify', () => {
    const first = createAdminSession();
    const second = createAdminSession();
    expect(first).not.toBe(second);

    const [expiresAt, nonce] = first.split('.');
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(verifyAdminSession(first)).toBe(true);
    expect(Number(expiresAt)).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tampered nonces, wrong signatures, and expired tokens', () => {
    const token = createAdminSession();
    const [expiresAt, nonce, signature] = token.split('.');

    const tamperedNonce = `${expiresAt}.${'f'.repeat(32)}.${signature}`;
    expect(verifyAdminSession(tamperedNonce)).toBe(false);

    const tamperedSignature = `${expiresAt}.${nonce}.${signature.slice(0, -2)}aa`;
    expect(verifyAdminSession(tamperedSignature)).toBe(false);

    const expired = handSignAdminSession(Math.floor(Date.now() / 1000) - 10, nonce);
    expect(verifyAdminSession(expired)).toBe(false);
  });

  it('rejects legacy two-part tokens and malformed nonces', () => {
    const [, nonce, signature] = createAdminSession().split('.');
    expect(verifyAdminSession(`${Date.now() + 3600}.legacy-only`)).toBe(false);
    expect(verifyAdminSession(`${Date.now() + 3600}.short.${signature}`)).toBe(false);
    void nonce;
  });
});
