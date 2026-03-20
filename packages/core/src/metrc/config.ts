/**
 * METRC state-specific configuration.
 *
 * Each state's METRC environment is hosted at a distinct subdomain.
 * Pattern: api-{state-code}.metrc.com  (all lowercase, e.g. api-ca.metrc.com)
 *
 * Adding a new state:
 *   1. Add the state code to MetrcStateCode in types.ts.
 *   2. Add a host entry to STATE_HOSTS below.
 *   No other code changes required.
 */

import { MetrcStateCode } from './types';

/**
 * METRC API hostnames keyed by two-letter state code.
 * Source: https://www.metrc.com/states/
 */
const STATE_HOSTS: Record<MetrcStateCode, string> = {
  AK: 'api-ak.metrc.com',
  AZ: 'api-az.metrc.com',
  CA: 'api-ca.metrc.com',
  CO: 'api-co.metrc.com',
  IL: 'api-il.metrc.com',
  MA: 'api-ma.metrc.com',
  MD: 'api-md.metrc.com',
  MI: 'api-mi.metrc.com',
  MO: 'api-mo.metrc.com',
  MT: 'api-mt.metrc.com',
  NJ: 'api-nj.metrc.com',
  NM: 'api-nm.metrc.com',
  NV: 'api-nv.metrc.com',
  OH: 'api-oh.metrc.com',
  OK: 'api-ok.metrc.com',
  OR: 'api-or.metrc.com',
  PA: 'api-pa.metrc.com',
  WA: 'api-wa.metrc.com',
};

/**
 * Return the METRC HTTPS base URL for a given state.
 *
 * @example
 *   getMetrcBaseUrl('CA') // → 'https://api-ca.metrc.com'
 *
 * @throws {Error} If the state code is not in the supported list.
 */
export function getMetrcBaseUrl(stateCode: MetrcStateCode): string {
  const host = STATE_HOSTS[stateCode];
  if (!host) {
    throw new Error(
      `METRC is not configured for state: ${stateCode}. ` +
      `Supported states: ${SUPPORTED_STATES.join(', ')}`,
    );
  }
  return `https://${host}`;
}

/** All state codes where METRC is currently supported by Winston. */
export const SUPPORTED_STATES: MetrcStateCode[] = Object.keys(STATE_HOSTS) as MetrcStateCode[];
