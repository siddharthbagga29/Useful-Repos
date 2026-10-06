// Small, clock-injectable limiters. Shared by the browser concierge (how often Jarvis may speak up)
// and the executive agent (how often it may place a call or hit an API).

export class RateLimiter {
  private stamps: number[] = [];
  private readonly max: number;
  private readonly windowMs: number;
  private readonly gapMs: number;
  private readonly now: () => number;

  /**
   * @param max      events allowed per window
   * @param windowMs window length
   * @param gapMs    minimum spacing between consecutive events
   */
  constructor(max: number, windowMs: number, gapMs = 0, now: () => number = () => Date.now()) {
    this.max = max;
    this.windowMs = windowMs;
    this.gapMs = gapMs;
    this.now = now;
  }

  /** True if an event may happen now (does not record it). */
  check(): boolean {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => t - s < this.windowMs);
    const last = this.stamps.at(-1);
    if (last !== undefined && t - last < this.gapMs) return false;
    return this.stamps.length < this.max;
  }

  /** Records the event if allowed; returns whether it was. */
  take(): boolean {
    if (!this.check()) return false;
    this.stamps.push(this.now());
    return true;
  }
}

export interface RetryOptions {
  retries: number;
  baseMs: number;
  maxMs: number;
  sleep?: (ms: number) => Promise<void>;
  /** return false for errors that must not be retried (e.g. HTTP 4xx other than 429) */
  retryable?: (err: unknown) => boolean;
}

/** Exponential backoff with full jitter. Rethrows the last error. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions): Promise<T> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown;
  for (let attempt = 0; attempt <= o.retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      last = err;
      if (attempt === o.retries || (o.retryable && !o.retryable(err))) break;
      const cap = Math.min(o.maxMs, o.baseMs * 2 ** attempt);
      await sleep(Math.floor(Math.random() * cap));
    }
  }
  throw last;
}
