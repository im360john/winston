/**
 * Treez REST API HTTP client.
 *
 * Wraps Node's built-in https module to avoid adding dependencies.
 * Handles auth headers, timeouts, rate limiting, and error classification.
 *
 * Treez API reference:
 *   Base URL: https://pos.treez.io/api/v2/{dispensaryId}
 *   Auth:     Authorization: Bearer <apiKey>
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { PosAdapterError } from '../../types/pos';
import { PosConnectionConfig, RateLimiter, withRetry } from '../connection';

export interface TreezRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface TreezClientConfig extends PosConnectionConfig {
  dispensaryId: string;
}

/**
 * Low-level Treez API client.
 * Each public method maps to one Treez REST endpoint.
 */
export class TreezClient {
  private readonly rateLimiter: RateLimiter;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseUrl: string;

  constructor(private readonly config: TreezClientConfig) {
    this.rateLimiter = new RateLimiter(config.maxRequestsPerSecond ?? 10);
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.maxRetries = config.maxRetries ?? 3;
    // Normalise base URL: strip trailing slash then add dispensary segment.
    const base = config.baseUrl.replace(/\/$/, '');
    this.baseUrl = `${base}/${config.dispensaryId}`;
  }

  // ---- Public endpoint methods -------------------------------------------

  /** GET /inventory/get-products */
  async getProducts(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/inventory/get-products', params);
  }

  /** GET /inventory/get-inventory */
  async getInventory(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/inventory/get-inventory', params);
  }

  /** GET /order/get-orders */
  async getOrders(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/order/get-orders', params);
  }

  /** GET /loyalty/get-customers */
  async getCustomers(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/loyalty/get-customers', params);
  }

  /** Low-level GET with rate limiting and retry. */
  async get(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<unknown> {
    return withRetry(
      () => this.rateLimiter.acquire().then(() => this.request({ method: 'GET', query }, path)),
      { maxAttempts: this.maxRetries },
    );
  }

  // ---- HTTP internals -----------------------------------------------------

  private request(options: TreezRequestOptions, path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const urlStr = this.buildUrl(path, options.query);
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlStr);
      } catch (e) {
        return reject(new PosAdapterError(`Invalid URL: ${urlStr}`, 'UNKNOWN', false, e));
      }

      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;
      const port = parsedUrl.port
        ? parseInt(parsedUrl.port, 10)
        : isHttps ? 443 : 80;

      const bodyStr = options.body ? JSON.stringify(options.body) : undefined;

      const reqOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method ?? 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
      };

      const req = transport.request(reqOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          const status = res.statusCode ?? 0;

          if (status === 401 || status === 403) {
            return reject(new PosAdapterError(
              `Treez auth error: HTTP ${status}`,
              'AUTH',
              false,
            ));
          }

          if (status === 429) {
            return reject(new PosAdapterError(
              'Treez rate limit exceeded',
              'RATE_LIMIT',
              true,
            ));
          }

          if (status === 404) {
            return reject(new PosAdapterError(
              `Treez resource not found: ${path}`,
              'NOT_FOUND',
              false,
            ));
          }

          if (status >= 500) {
            return reject(new PosAdapterError(
              `Treez server error: HTTP ${status}`,
              'NETWORK',
              true,
            ));
          }

          if (status < 200 || status >= 300) {
            return reject(new PosAdapterError(
              `Treez unexpected status: HTTP ${status}`,
              'UNKNOWN',
              false,
            ));
          }

          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new PosAdapterError(
              'Treez response is not valid JSON',
              'PARSE',
              false,
              e,
            ));
          }
        });
      });

      req.setTimeout(this.timeoutMs, () => {
        req.destroy();
        reject(new PosAdapterError(
          `Treez request timed out after ${this.timeoutMs}ms`,
          'NETWORK',
          true,
        ));
      });

      req.on('error', (err: Error) => {
        reject(new PosAdapterError(
          `Treez network error: ${err.message}`,
          'NETWORK',
          true,
          err,
        ));
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): string {
    const base = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return params ? `${base}?${params}` : base;
  }
}
