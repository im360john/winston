/**
 * POS connection utilities: config schema, token bucket rate limiter, and retry.
 *
 * Used by all POS adapters — not Treez-specific.
 */

import { PosAdapterError } from '../types/pos';

// ---- Connection config -----------------------------------------------------

export interface PosConnectionConfig {
  /** Base URL of the POS API (e.g. "https://pos.treez.io/api/v2"). */
  baseUrl: string;
  /** API key / bearer token. Retrieved from SecretsManager at runtime. */
  apiKey: string;
  /** Per-tenant dispensary / location identifier required by some POS APIs. */
  dispensaryId?: string;
  /** Request timeout in ms (default: 15 000). */
  timeoutMs?: number;
  /** Maximum requests per second (default: 10). */
  maxRequestsPerSecond?: number;
  /** Maximum retry attempts for transient failures (default: 3). */
  maxRetries?: number;
}

// ---- Token-bucket rate limiter --------------------------------------------

/**
 * Simple token-bucket rate limiter.
 *
 * Tokens refill at `ratePerSecond` per second.
 * `acquire()` returns a Promise that resolves when a token is available.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly intervalMs: number;

  constructor(private readonly ratePerSecond: number = 10) {
    this.tokens = ratePerSecond;
    this.lastRefill = Date.now();
    this.intervalMs = 1000 / ratePerSecond;
  }

  acquire(): Promise<void> {
    return new Promise(resolve => {
      const tryAcquire = () => {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
          setTimeout(tryAcquire, this.intervalMs);
        }
      };
      tryAcquire();
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillAmount = (elapsed / 1000) * this.ratePerSecond;
    this.tokens = Math.min(this.ratePerSecond, this.tokens + refillAmount);
    this.lastRefill = now;
  }
}

// ---- Retry policy --------------------------------------------------------

export interface RetryOptions {
  maxAttempts: number;
  /** Initial backoff in ms. Doubles each attempt (exponential backoff). */
  baseDelayMs?: number;
  /** Max backoff in ms (default: 30 000). */
  maxDelayMs?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with exponential backoff.
 *
 * Only retries on PosAdapterError with retryable=true.
 * All other errors propagate immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isRetryable = err instanceof PosAdapterError && err.retryable;
      if (!isRetryable || attempt === opts.maxAttempts) {
        throw err;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
