/**
 * METRC reconciliation logic.
 *
 * Compares POS inventory records against METRC active packages to surface
 * discrepancies that require operator review or regulatory correction.
 *
 * Match key: InventoryRecord.metrcTag === MetrcPackage.Label
 *
 * POS inventory records without a metrcTag are excluded from reconciliation —
 * they are non-cannabis or non-tracked items (accessories, etc.).
 */

import { InventoryRecord } from '../types/pos';
import { MetrcPackage, ReconciliationDiscrepancy, ReconciliationResult } from './types';

/**
 * Compare POS inventory records against METRC active packages.
 *
 * Discrepancy types produced:
 * - `quantity_mismatch`  — both sides have the tag but quantities differ
 * - `missing_in_pos`     — METRC has an active package with no POS match
 * - `missing_in_metrc`   — POS record has a METRC tag not found in active packages
 *
 * @param tenantId      - Tenant identifier (included in the result for tracing).
 * @param licenseNumber - METRC license number that was queried.
 * @param posInventory  - All inventory records from the POS for this location.
 * @param metrcPackages - Active packages from METRC for this license.
 */
export function reconcileInventory(
  tenantId: string,
  licenseNumber: string,
  posInventory: InventoryRecord[],
  metrcPackages: MetrcPackage[],
): ReconciliationResult {
  const discrepancies: ReconciliationDiscrepancy[] = [];

  // Index POS records by METRC tag. Only tagged records are eligible.
  const posByTag = new Map<string, InventoryRecord>();
  for (const rec of posInventory) {
    if (rec.metrcTag) {
      posByTag.set(rec.metrcTag, rec);
    }
  }

  // Index METRC packages by Label (the canonical tag UID).
  const metrcByLabel = new Map<string, MetrcPackage>();
  for (const pkg of metrcPackages) {
    metrcByLabel.set(pkg.Label, pkg);
  }

  // Pass 1: check each METRC package against POS.
  for (const [label, pkg] of metrcByLabel) {
    const posRecord = posByTag.get(label);

    if (!posRecord) {
      discrepancies.push({
        metrcTag: label,
        posQuantity: null,
        metrcQuantity: pkg.Quantity,
        // Negative delta: METRC shows stock the POS doesn't know about
        delta: -pkg.Quantity,
        type: 'missing_in_pos',
        metrcProductName: pkg.ProductName,
      });
    } else {
      // POS effective quantity = on-hand + reserved (reserved qty is still physically present)
      const posQty = posRecord.quantityOnHand + posRecord.quantityReserved;
      const metrcQty = pkg.Quantity;

      if (posQty !== metrcQty) {
        discrepancies.push({
          metrcTag: label,
          posQuantity: posQty,
          metrcQuantity: metrcQty,
          delta: posQty - metrcQty,
          type: 'quantity_mismatch',
          metrcProductName: pkg.ProductName,
          posInventoryId: posRecord.id,
        });
      }
    }
  }

  // Pass 2: check each tagged POS record for packages absent from METRC.
  for (const [tag, posRecord] of posByTag) {
    if (!metrcByLabel.has(tag)) {
      const posQty = posRecord.quantityOnHand + posRecord.quantityReserved;
      discrepancies.push({
        metrcTag: tag,
        posQuantity: posQty,
        metrcQuantity: null,
        // Positive delta: POS shows stock METRC doesn't track
        delta: posQty,
        type: 'missing_in_metrc',
        posInventoryId: posRecord.id,
      });
    }
  }

  return {
    tenantId,
    licenseNumber,
    runAt: new Date().toISOString(),
    totalPosRecords: posInventory.length,
    totalMetrcPackages: metrcPackages.length,
    discrepancies,
    discrepancyCount: discrepancies.length,
    isClean: discrepancies.length === 0,
  };
}

/**
 * Determine whether a METRC license is expired, expiring soon, or valid.
 *
 * @param expirationDate - ISO 8601 date string from METRC (e.g. '2025-06-30').
 * @param warningDays    - Days before expiration to start warning. Default: 90.
 */
export function checkLicenseStatus(
  expirationDate: string,
  warningDays = 90,
): 'expired' | 'expiring_soon' | 'valid' {
  const now = new Date();
  const expiry = new Date(expirationDate);
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'expired';
  if (diffDays <= warningDays) return 'expiring_soon';
  return 'valid';
}
