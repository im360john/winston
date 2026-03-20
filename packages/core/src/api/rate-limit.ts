/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed by an arbitrary string (e.g. tenantId). Tracks request timestamps
 * within a rolling window and enforces a max-per-window limit.
 * Not suitable for multi-process deployments — use Redis there.
 */

interface BucketEntry {
  timestamps: number[];
}

export class RateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Returns true if the key is within the rate limit.
   * Call before processing the request.
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.buckets.set(key, entry);
    }

    // Evict timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxRequests) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /** Seconds until the oldest request in the window expires. */
  retryAfterSeconds(key: string): number {
    const entry = this.buckets.get(key);
    if (!entry || entry.timestamps.length === 0) return 0;
    const oldest = entry.timestamps[0];
    return Math.ceil((oldest + this.windowMs - Date.now()) / 1000);
  }
}

/** Shared limiter: 30 requests per minute per tenant. */
export const tenantRateLimiter = new RateLimiter(30, 60_000);
