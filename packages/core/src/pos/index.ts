/**
 * POS adapter module — public API.
 *
 * Exports:
 *   - Common types (IPosAdapter, Page, filter params)
 *   - Connection utilities (config, rate limiter, retry)
 *   - TreezAdapter
 *   - DutchieAdapter
 *   - BlazeAdapter
 *   - AdapterRegistry for runtime lookup by POS type
 */

// ---- Types / interfaces ---------------------------------------------------
export type { IPosAdapter, Page, PageParams, ProductFilter, InventoryFilter, SaleFilter, CustomerFilter } from './adapter';
export { BasePosAdapter } from './adapter';
export type { PosConnectionConfig, RetryOptions } from './connection';
export { RateLimiter, withRetry } from './connection';

// ---- Adapters ------------------------------------------------------------
export { TreezAdapter } from './treez/adapter';
export type { TreezClientConfig } from './treez/client';
export { DutchieAdapter } from './dutchie/adapter';
export type { DutchieClientConfig } from './dutchie/client';
export { BlazeAdapter } from './blaze/adapter';
export type { BlazeClientConfig } from './blaze/client';

// ---- Registry ------------------------------------------------------------

import { IPosAdapter } from './adapter';

type AdapterConstructor = new (...args: unknown[]) => IPosAdapter;

/**
 * Registry maps POS type strings to adapter constructors.
 * Register new adapters here as they are implemented.
 *
 * Example:
 *   adapterRegistry.register('dutchie', DutchieAdapter);
 *   const adapter = adapterRegistry.create('dutchie', config);
 */
class AdapterRegistry {
  private readonly registry = new Map<string, AdapterConstructor>();

  register(posType: string, ctor: AdapterConstructor): void {
    this.registry.set(posType.toLowerCase(), ctor);
  }

  /** Return the constructor for a POS type, or undefined if not registered. */
  get(posType: string): AdapterConstructor | undefined {
    return this.registry.get(posType.toLowerCase());
  }

  /** List all registered POS type keys. */
  list(): string[] {
    return Array.from(this.registry.keys());
  }
}

export const adapterRegistry = new AdapterRegistry();

// Register built-in adapters
import { TreezAdapter } from './treez/adapter';
import { DutchieAdapter } from './dutchie/adapter';
import { BlazeAdapter } from './blaze/adapter';
adapterRegistry.register('treez', TreezAdapter as unknown as AdapterConstructor);
adapterRegistry.register('dutchie', DutchieAdapter as unknown as AdapterConstructor);
adapterRegistry.register('blaze', BlazeAdapter as unknown as AdapterConstructor);
