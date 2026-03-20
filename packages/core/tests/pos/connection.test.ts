/**
 * Connection utility tests: RateLimiter and withRetry.
 */

import { RateLimiter, withRetry } from '../../src/pos/connection';
import { PosAdapterError } from '../../src/types/pos';

// ---- RateLimiter -----------------------------------------------------------

describe('RateLimiter', () => {
  test('resolves immediately when tokens are available', async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  test('allows multiple fast acquires up to the bucket capacity', async () => {
    const limiter = new RateLimiter(10);
    const promises = Array.from({ length: 5 }, () => limiter.acquire());
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});

// ---- withRetry -------------------------------------------------------------

describe('withRetry', () => {
  test('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on retryable PosAdapterError', async () => {
    const err = new PosAdapterError('rate limit', 'RATE_LIMIT', true);
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('does not retry non-retryable PosAdapterError', async () => {
    const err = new PosAdapterError('auth failed', 'AUTH', false);
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('does not retry generic errors', async () => {
    const err = new Error('unexpected');
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('exhausts retries and throws last error', async () => {
    const err = new PosAdapterError('network', 'NETWORK', true);
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
