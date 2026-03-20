/**
 * METRC REST API HTTP client.
 *
 * Wraps Node's built-in https module — no external HTTP dependencies.
 * Handles Basic auth, timeouts, rate limiting, and error classification.
 *
 * METRC API reference:
 *   Base URL: https://api-{state}.metrc.com  (state-specific)
 *   Auth:     Basic <Base64(softwareApiKey:userApiKey)>
 *   Pagination: skip / take query params; responses are plain JSON arrays.
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { PosAdapterError } from '../types/pos';
import { RateLimiter, withRetry } from '../pos/connection';
import { MetrcConfig } from './types';
import { getMetrcBaseUrl } from './config';

export interface MetrcRequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/**
 * Low-level METRC API client.
 *
 * Each public method maps to one METRC REST endpoint.
 * The licenseNumber is automatically appended to every request that requires it.
 */
export class MetrcClient {
  private readonly rateLimiter: RateLimiter;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseUrl: string;
  /** Pre-encoded Basic auth header value. */
  private readonly authHeader: string;
  private readonly licenseNumber: string;

  constructor(config: MetrcConfig) {
    this.rateLimiter = new RateLimiter(config.maxRequestsPerSecond ?? 5);
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseUrl = getMetrcBaseUrl(config.stateCode);
    this.licenseNumber = config.licenseNumber;

    // METRC uses HTTP Basic auth: Base64(softwareApiKey:userApiKey)
    const credentials = Buffer.from(
      `${config.softwareApiKey}:${config.userApiKey}`,
    ).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  // ---- Public endpoint methods ---------------------------------------------

  /**
   * GET /licenses
   * Returns all licenses visible to this user key (no licenseNumber needed).
   */
  async getLicenses(): Promise<unknown> {
    return this.get('/licenses');
  }

  /**
   * GET /packages/v2/active
   * Returns active (on-hand) packages for the configured license.
   */
  async getActivePackages(
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    return this.get('/packages/v2/active', {
      licenseNumber: this.licenseNumber,
      ...params,
    });
  }

  /**
   * GET /packages/v2/inactive
   * Returns inactive (sold, transferred, or adjusted) packages.
   */
  async getInactivePackages(
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    return this.get('/packages/v2/inactive', {
      licenseNumber: this.licenseNumber,
      ...params,
    });
  }

  /**
   * GET /packages/v2/{id}
   * Fetches a single package by METRC numeric ID.
   */
  async getPackageById(id: number): Promise<unknown> {
    return this.get(`/packages/v2/${id}`, { licenseNumber: this.licenseNumber });
  }

  /**
   * GET /transfers/v2/incoming
   * Returns incoming transfer manifests.
   */
  async getIncomingTransfers(
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    return this.get('/transfers/v2/incoming', {
      licenseNumber: this.licenseNumber,
      ...params,
    });
  }

  /**
   * GET /transfers/v2/outgoing
   * Returns outgoing transfer manifests.
   */
  async getOutgoingTransfers(
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    return this.get('/transfers/v2/outgoing', {
      licenseNumber: this.licenseNumber,
      ...params,
    });
  }

  /**
   * GET /harvests/v2/active
   * Returns active (unfinished) harvest batches.
   */
  async getActiveHarvests(
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    return this.get('/harvests/v2/active', {
      licenseNumber: this.licenseNumber,
      ...params,
    });
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

  // ---- HTTP internals -------------------------------------------------------

  private request(options: MetrcRequestOptions, path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const urlStr = this.buildUrl(path, options.query);
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlStr);
      } catch (e) {
        return reject(new PosAdapterError(`Invalid METRC URL: ${urlStr}`, 'UNKNOWN', false, e));
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
          'Authorization': this.authHeader,
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
              `METRC auth error: HTTP ${status}`,
              'AUTH',
              false,
            ));
          }

          if (status === 429) {
            return reject(new PosAdapterError(
              'METRC rate limit exceeded',
              'RATE_LIMIT',
              true,
            ));
          }

          if (status === 404) {
            return reject(new PosAdapterError(
              `METRC resource not found: ${path}`,
              'NOT_FOUND',
              false,
            ));
          }

          if (status >= 500) {
            return reject(new PosAdapterError(
              `METRC server error: HTTP ${status}`,
              'NETWORK',
              true,
            ));
          }

          if (status < 200 || status >= 300) {
            return reject(new PosAdapterError(
              `METRC unexpected status: HTTP ${status}`,
              'UNKNOWN',
              false,
            ));
          }

          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new PosAdapterError(
              'METRC response is not valid JSON',
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
          `METRC request timed out after ${this.timeoutMs}ms`,
          'NETWORK',
          true,
        ));
      });

      req.on('error', (err: Error) => {
        reject(new PosAdapterError(
          `METRC network error: ${err.message}`,
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
