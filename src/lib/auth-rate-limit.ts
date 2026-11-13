import { createHmac } from 'crypto';

type RateLimitOptions = {
  bucket: 'login' | 'register' | 'admin-login';
  windowSeconds: number;
  perIp: number;
  identity?: string;
  perIdentity?: number;
};

type LocalBucket = { count: number; resetsAt: number };
const localBuckets = new Map<string, LocalBucket>();
let warnedAboutLocalFallback = false;

export class AuthRateLimitUnavailableError extends Error {
  constructor() {
    super('تعذر التحقق من محاولات الدخول حاليًا. حاول مرة أخرى بعد قليل.');
    this.name = 'AuthRateLimitUnavailableError';
  }
}

function digest(value: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'ala-qaddi-local-only';
  return createHmac('sha256', key).update(value).digest('hex');
}

function consumeLocally(
  entries: Array<{ keyHash: string; maxAttempts: number }>,
  windowSeconds: number,
) {
  const now = Date.now();
  let allowed = true;

  for (const entry of entries) {
    const current = localBuckets.get(entry.keyHash);
    const bucket =
      !current || current.resetsAt <= now
        ? { count: 1, resetsAt: now + windowSeconds * 1000 }
        : { ...current, count: current.count + 1 };
    localBuckets.set(entry.keyHash, bucket);
    if (bucket.count > entry.maxAttempts) allowed = false;
  }

  if (localBuckets.size > 5000) {
    for (const [key, bucket] of localBuckets) {
      if (bucket.resetsAt <= now) localBuckets.delete(key);
    }
  }

  return allowed;
}

/** Uses the atomic Supabase RPC when installed, with a per-instance fallback during migration rollout. */
export async function isAuthRateLimited(request: Request, options: RateLimitOptions) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown';
  const entries = [
    { keyHash: digest(`${options.bucket}:ip:${ip}`), maxAttempts: options.perIp },
    ...(options.identity
      ? [
          {
            keyHash: digest(`${options.bucket}:identity:${options.identity.trim().toLowerCase()}`),
            maxAttempts: options.perIdentity ?? options.perIp,
          },
        ]
      : []),
  ];
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    if (!warnedAboutLocalFallback) {
      console.warn(
        'Shared auth rate limits are unavailable; using a per-instance fallback until Supabase is configured.',
      );
      warnedAboutLocalFallback = true;
    }
    return !consumeLocally(entries, options.windowSeconds);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_auth_rate_limits`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_key_hashes: entries.map((entry) => entry.keyHash),
      p_max_attempts: entries.map((entry) => entry.maxAttempts),
      p_window_seconds: options.windowSeconds,
    }),
  });

  if (response.status === 404) {
    if (!warnedAboutLocalFallback) {
      console.error(
        'Shared auth rate limit RPC is missing; apply the Supabase auth rate limit migration.',
      );
      warnedAboutLocalFallback = true;
    }
    return !consumeLocally(entries, options.windowSeconds);
  }

  if (!response.ok) {
    console.error(`Shared auth rate limit failed (${response.status}).`);
    throw new AuthRateLimitUnavailableError();
  }

  const allowed = await response.json();
  if (typeof allowed !== 'boolean') {
    console.error('Shared auth rate limit returned an invalid response.');
    throw new AuthRateLimitUnavailableError();
  }
  return !allowed;
}
