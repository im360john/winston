/**
 * METRC compliance adapter.
 *
 * Implements IMetrcAdapter using the METRC v2 REST API.
 * Authenticates via softwareApiKey + userApiKey stored in Winston's SecretsManager.
 *
 * Usage:
 *   const adapter = new MetrcAdapter({
 *     stateCode: 'CA',
 *     softwareApiKey: secretsManager.get(tenantId, 'metrc_software_key')!,
 *     userApiKey: secretsManager.get(tenantId, 'metrc_user_key')!,
 *     licenseNumber: 'C11-0000001-LIC',
 *   });
 *   await adapter.connect();
 *   const packages = await adapter.getActivePackages();
 */

import { MetrcClient } from './client';
import {
  MetrcConfig,
  MetrcPackage,
  MetrcTransfer,
  MetrcHarvest,
  MetrcLicense,
} from './types';
import { Page } from '../pos/adapter';
import { PosAdapterError } from '../types/pos';

// METRC v2 hard cap for skip/take pagination
const MAX_PAGE_SIZE = 500;

// ---- Filter types ----------------------------------------------------------

/** Filter params for METRC package queries. */
export interface MetrcPackageFilter {
  /**
   * ISO 8601 datetime — fetch only packages modified at or after this time.
   * Use for incremental sync (e.g. last sync timestamp).
   */
  lastModifiedStart?: string;
  /** ISO 8601 datetime — upper bound for LastModified. */
  lastModifiedEnd?: string;
  /** Records to skip (0-based offset). Default: 0. */
  skip?: number;
  /** Max records to return. Capped at 500 (METRC hard limit). Default: 500. */
  take?: number;
}

/** Filter params for METRC transfer queries. */
export interface MetrcTransferFilter {
  lastModifiedStart?: string;
  lastModifiedEnd?: string;
  skip?: number;
  take?: number;
}

/** Filter params for METRC harvest queries. */
export interface MetrcHarvestFilter {
  lastModifiedStart?: string;
  lastModifiedEnd?: string;
  skip?: number;
  take?: number;
}

// ---- Interface -------------------------------------------------------------

export interface IMetrcAdapter {
  /** True after a successful connect() call. */
  readonly isConnected: boolean;

  /**
   * Validate credentials and reachability by fetching license info.
   * Throws PosAdapterError on failure. Must be called before any data method.
   */
  connect(): Promise<void>;

  /** Release resources. No-op is acceptable; called on graceful shutdown. */
  disconnect(): Promise<void>;

  /** Fetch all licenses visible to this user key. */
  getLicenses(): Promise<MetrcLicense[]>;

  /** Fetch active (on-hand) packages for this license. */
  getActivePackages(filter?: MetrcPackageFilter): Promise<Page<MetrcPackage>>;

  /** Fetch inactive (sold/transferred/adjusted) packages. */
  getInactivePackages(filter?: MetrcPackageFilter): Promise<Page<MetrcPackage>>;

  /** Fetch incoming transfer manifests. */
  getIncomingTransfers(filter?: MetrcTransferFilter): Promise<Page<MetrcTransfer>>;

  /** Fetch outgoing transfer manifests. */
  getOutgoingTransfers(filter?: MetrcTransferFilter): Promise<Page<MetrcTransfer>>;

  /** Fetch active (unfinished) harvest batches. */
  getActiveHarvests(filter?: MetrcHarvestFilter): Promise<Page<MetrcHarvest>>;
}

// ---- Implementation --------------------------------------------------------

export class MetrcAdapter implements IMetrcAdapter {
  private readonly client: MetrcClient;
  private _connected = false;

  constructor(private readonly config: MetrcConfig) {
    this.client = new MetrcClient(config);
  }

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    try {
      await this.client.getLicenses();
      this._connected = true;
    } catch (err) {
      this._connected = false;
      if (err instanceof PosAdapterError) throw err;
      throw new PosAdapterError(
        `METRC connection failed: ${(err as Error).message}`,
        'NETWORK',
        true,
        err,
      );
    }
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async getLicenses(): Promise<MetrcLicense[]> {
    this.assertConnected();
    const raw = await this.client.getLicenses();
    return (raw as Record<string, unknown>[]).map(r => ({ ...r, _raw: r } as MetrcLicense));
  }

  async getActivePackages(filter: MetrcPackageFilter = {}): Promise<Page<MetrcPackage>> {
    this.assertConnected();
    const params = buildPackageParams(filter);
    const raw = await this.client.getActivePackages(params) as MetrcPackage[];
    return buildMetrcPage(raw, filter);
  }

  async getInactivePackages(filter: MetrcPackageFilter = {}): Promise<Page<MetrcPackage>> {
    this.assertConnected();
    const params = buildPackageParams(filter);
    const raw = await this.client.getInactivePackages(params) as MetrcPackage[];
    return buildMetrcPage(raw, filter);
  }

  async getIncomingTransfers(filter: MetrcTransferFilter = {}): Promise<Page<MetrcTransfer>> {
    this.assertConnected();
    const params = buildTransferParams(filter);
    const raw = await this.client.getIncomingTransfers(params) as MetrcTransfer[];
    return buildMetrcPage(raw, filter);
  }

  async getOutgoingTransfers(filter: MetrcTransferFilter = {}): Promise<Page<MetrcTransfer>> {
    this.assertConnected();
    const params = buildTransferParams(filter);
    const raw = await this.client.getOutgoingTransfers(params) as MetrcTransfer[];
    return buildMetrcPage(raw, filter);
  }

  async getActiveHarvests(filter: MetrcHarvestFilter = {}): Promise<Page<MetrcHarvest>> {
    this.assertConnected();
    const params = buildHarvestParams(filter);
    const raw = await this.client.getActiveHarvests(params) as MetrcHarvest[];
    return buildMetrcPage(raw, filter);
  }

  private assertConnected(): void {
    if (!this._connected) {
      throw new PosAdapterError(
        'MetrcAdapter.connect() must be called before querying data',
        'UNKNOWN',
        false,
      );
    }
  }
}

// ---- Param builders --------------------------------------------------------

function buildPackageParams(
  f: MetrcPackageFilter,
): Record<string, string | number | undefined> {
  return {
    ...(f.lastModifiedStart ? { lastModifiedStart: f.lastModifiedStart } : {}),
    ...(f.lastModifiedEnd ? { lastModifiedEnd: f.lastModifiedEnd } : {}),
    skip: f.skip ?? 0,
    take: Math.min(f.take ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

function buildTransferParams(
  f: MetrcTransferFilter,
): Record<string, string | number | undefined> {
  return {
    ...(f.lastModifiedStart ? { lastModifiedStart: f.lastModifiedStart } : {}),
    ...(f.lastModifiedEnd ? { lastModifiedEnd: f.lastModifiedEnd } : {}),
    skip: f.skip ?? 0,
    take: Math.min(f.take ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

function buildHarvestParams(
  f: MetrcHarvestFilter,
): Record<string, string | number | undefined> {
  return {
    ...(f.lastModifiedStart ? { lastModifiedStart: f.lastModifiedStart } : {}),
    ...(f.lastModifiedEnd ? { lastModifiedEnd: f.lastModifiedEnd } : {}),
    skip: f.skip ?? 0,
    take: Math.min(f.take ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

// ---- Response helpers -------------------------------------------------------

/**
 * METRC v2 returns plain JSON arrays (no total-count envelope).
 * We infer hasMore: if the response is a full page, there may be more records.
 */
function buildMetrcPage<T>(
  items: T[],
  filter: { skip?: number; take?: number },
): Page<T> {
  const skip = filter.skip ?? 0;
  const take = Math.min(filter.take ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const hasMore = items.length === take;
  return {
    items,
    // Lower-bound estimate — METRC doesn't expose total count in v2 list endpoints
    total: skip + items.length + (hasMore ? 1 : 0),
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    hasMore,
  };
}
