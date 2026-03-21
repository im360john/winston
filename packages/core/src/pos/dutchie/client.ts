import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { PosAdapterError } from '../../types/pos';
import { PosConnectionConfig, RateLimiter, withRetry } from '../connection';

export interface DutchieRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface DutchieClientConfig extends PosConnectionConfig {
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scope?: string;
  oauthToken?: string;
  authMode?: 'auto' | 'oauth2' | 'api_key';
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

export class DutchieClient {
  private readonly rateLimiter: RateLimiter;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseUrl: string;
  private readonly authMode: 'auto' | 'oauth2' | 'api_key';
  private token?: string;
  private tokenExpiresAt?: number;

  constructor(private readonly config: DutchieClientConfig) {
    this.rateLimiter = new RateLimiter(config.maxRequestsPerSecond ?? 10);
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.authMode = config.authMode ?? 'auto';
    if (config.oauthToken) {
      this.token = config.oauthToken;
    }
  }

  async getProducts(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/products', params);
  }

  async getInventory(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/inventory', params);
  }

  async getSales(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/sales', params);
  }

  async getCustomers(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return this.get('/customers', params);
  }

  async get(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<unknown> {
    return withRetry(
      () => this.rateLimiter.acquire().then(() => this.request({ method: 'GET', query }, path)),
      { maxAttempts: this.maxRetries },
    );
  }

  private async resolveAccessToken(): Promise<string> {
    if (this.authMode === 'api_key') {
      return this.config.apiKey;
    }

    if (this.token && (!this.tokenExpiresAt || this.tokenExpiresAt > Date.now() + 30_000)) {
      return this.token;
    }

    if (!this.config.tokenUrl || !this.config.clientId || !this.config.clientSecret) {
      if (this.authMode === 'oauth2') {
        throw new PosAdapterError('Dutchie OAuth2 config is incomplete', 'AUTH', false);
      }
      return this.config.apiKey;
    }

    try {
      const raw = await this.request(
        {
          method: 'POST',
          body: {
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            ...(this.config.scope ? { scope: this.config.scope } : {}),
          },
        },
        this.config.tokenUrl,
        true,
        false,
      ) as TokenResponse;

      if (!raw.access_token) {
        throw new PosAdapterError('Dutchie token response missing access_token', 'AUTH', false);
      }

      this.token = raw.access_token;
      this.tokenExpiresAt = raw.expires_in
        ? Date.now() + raw.expires_in * 1000
        : Date.now() + 5 * 60 * 1000;
      return this.token;
    } catch (err) {
      if (this.authMode === 'oauth2') {
        if (err instanceof PosAdapterError) throw err;
        throw new PosAdapterError(
          `Dutchie OAuth2 token exchange failed: ${(err as Error).message}`,
          'AUTH',
          false,
          err,
        );
      }

      // auto mode fallback
      return this.config.apiKey;
    }
  }

  private async request(
    options: DutchieRequestOptions,
    pathOrUrl: string,
    isAbsoluteUrl = false,
    withAuth = true,
  ): Promise<unknown> {
    const urlStr = isAbsoluteUrl ? pathOrUrl : this.buildUrl(pathOrUrl, options.query);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch (e) {
      throw new PosAdapterError(`Invalid URL: ${urlStr}`, 'UNKNOWN', false, e);
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const port = parsedUrl.port
      ? parseInt(parsedUrl.port, 10)
      : isHttps ? 443 : 80;

    const bodyStr = options.body ? JSON.stringify(options.body) : undefined;
    const authToken = withAuth ? await this.resolveAccessToken() : undefined;

    return new Promise((resolve, reject) => {
      const reqOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method ?? 'GET',
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
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
            return reject(new PosAdapterError(`Dutchie auth error: HTTP ${status}`, 'AUTH', false));
          }

          if (status === 429) {
            return reject(new PosAdapterError('Dutchie rate limit exceeded', 'RATE_LIMIT', true));
          }

          if (status === 404) {
            return reject(new PosAdapterError(`Dutchie resource not found: ${pathOrUrl}`, 'NOT_FOUND', false));
          }

          if (status >= 500) {
            return reject(new PosAdapterError(`Dutchie server error: HTTP ${status}`, 'NETWORK', true));
          }

          if (status < 200 || status >= 300) {
            return reject(new PosAdapterError(`Dutchie unexpected status: HTTP ${status}`, 'UNKNOWN', false));
          }

          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(new PosAdapterError('Dutchie response is not valid JSON', 'PARSE', false, e));
          }
        });
      });

      req.setTimeout(this.timeoutMs, () => {
        req.destroy();
        reject(new PosAdapterError(
          `Dutchie request timed out after ${this.timeoutMs}ms`,
          'NETWORK',
          true,
        ));
      });

      req.on('error', (err: Error) => {
        reject(new PosAdapterError(`Dutchie network error: ${err.message}`, 'NETWORK', true, err));
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
