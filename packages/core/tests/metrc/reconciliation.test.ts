/**
 * Reconciliation logic unit tests.
 *
 * reconcileInventory and checkLicenseStatus are pure functions —
 * no mocking needed. We cover all discrepancy types and edge cases.
 */

import { reconcileInventory, checkLicenseStatus } from '../../src/metrc/reconciliation';
import { InventoryRecord } from '../../src/types/pos';
import { MetrcPackage } from '../../src/metrc/types';

// ---- Fixtures --------------------------------------------------------------

function makeInventoryRecord(overrides: Partial<InventoryRecord> = {}): InventoryRecord {
  return {
    id: 'inv-1',
    tenantId: 'tenant-1',
    productId: 'prod-1',
    locationId: 'loc-1',
    locationName: 'Main Floor',
    quantityOnHand: 10,
    quantityReserved: 0,
    metrcTag: undefined,
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMetrcPackage(overrides: Partial<MetrcPackage> = {}): MetrcPackage {
  return {
    Id: 1,
    Label: '1A4000000000000000000001',
    PackageType: 'Product',
    ProductName: 'Blue Dream 3.5g',
    ProductCategoryName: 'Flower',
    Quantity: 10,
    UnitOfMeasureName: 'Grams',
    UnitOfMeasureAbbreviation: 'g',
    PatientLicenseNumber: null,
    ItemFromFacilityLicenseNumber: null,
    PackagedDate: '2024-01-01',
    ExpirationDate: null,
    UseByDate: null,
    LastModified: '2024-01-01T00:00:00Z',
    FinishedDate: null,
    IsProductionBatch: false,
    IsTestingSample: false,
    IsTradeSample: false,
    IsOnHold: false,
    ArchivedDate: null,
    ...overrides,
  };
}

const TENANT_ID = 'tenant-1';
const LICENSE = 'C11-0000001-LIC';

// ---- reconcileInventory ----------------------------------------------------

describe('reconcileInventory', () => {
  test('returns clean result when POS and METRC quantities match', () => {
    const posInventory = [
      makeInventoryRecord({
        metrcTag: '1A4000000000000000000001',
        quantityOnHand: 10,
        quantityReserved: 0,
      }),
    ];
    const metrcPackages = [
      makeMetrcPackage({ Label: '1A4000000000000000000001', Quantity: 10 }),
    ];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);

    expect(result.isClean).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
    expect(result.discrepancyCount).toBe(0);
    expect(result.totalPosRecords).toBe(1);
    expect(result.totalMetrcPackages).toBe(1);
    expect(result.tenantId).toBe(TENANT_ID);
    expect(result.licenseNumber).toBe(LICENSE);
  });

  test('adds quantityOnHand + quantityReserved for POS effective quantity', () => {
    // 8 on-hand + 4 reserved = 12 effective; METRC says 12 → clean
    const posInventory = [
      makeInventoryRecord({
        metrcTag: 'TAG-001',
        quantityOnHand: 8,
        quantityReserved: 4,
      }),
    ];
    const metrcPackages = [makeMetrcPackage({ Label: 'TAG-001', Quantity: 12 })];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);
    expect(result.isClean).toBe(true);
  });

  test('detects quantity_mismatch when quantities differ', () => {
    const posInventory = [
      makeInventoryRecord({
        id: 'inv-A',
        metrcTag: 'TAG-MISMATCH',
        quantityOnHand: 8,
        quantityReserved: 2,
      }),
    ];
    const metrcPackages = [
      makeMetrcPackage({
        Label: 'TAG-MISMATCH',
        Quantity: 15,
        ProductName: 'OG Kush 1g',
      }),
    ];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);

    expect(result.isClean).toBe(false);
    expect(result.discrepancies).toHaveLength(1);

    const d = result.discrepancies[0];
    expect(d.type).toBe('quantity_mismatch');
    expect(d.metrcTag).toBe('TAG-MISMATCH');
    expect(d.posQuantity).toBe(10);   // 8 + 2
    expect(d.metrcQuantity).toBe(15);
    expect(d.delta).toBe(-5);          // pos - metrc
    expect(d.metrcProductName).toBe('OG Kush 1g');
    expect(d.posInventoryId).toBe('inv-A');
  });

  test('detects missing_in_pos when METRC has package with no POS record', () => {
    const posInventory: InventoryRecord[] = [];
    const metrcPackages = [
      makeMetrcPackage({
        Label: 'TAG-METRC-ONLY',
        Quantity: 7,
        ProductName: 'Wedding Cake',
      }),
    ];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);

    expect(result.isClean).toBe(false);
    expect(result.discrepancies).toHaveLength(1);

    const d = result.discrepancies[0];
    expect(d.type).toBe('missing_in_pos');
    expect(d.metrcTag).toBe('TAG-METRC-ONLY');
    expect(d.posQuantity).toBeNull();
    expect(d.metrcQuantity).toBe(7);
    expect(d.delta).toBe(-7);
    expect(d.metrcProductName).toBe('Wedding Cake');
    expect(d.posInventoryId).toBeUndefined();
  });

  test('detects missing_in_metrc when POS has tagged record absent from METRC', () => {
    const posInventory = [
      makeInventoryRecord({
        id: 'inv-POS-ONLY',
        metrcTag: 'TAG-POS-ONLY',
        quantityOnHand: 3,
        quantityReserved: 0,
      }),
    ];
    const metrcPackages: MetrcPackage[] = [];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);

    expect(result.isClean).toBe(false);
    expect(result.discrepancies).toHaveLength(1);

    const d = result.discrepancies[0];
    expect(d.type).toBe('missing_in_metrc');
    expect(d.metrcTag).toBe('TAG-POS-ONLY');
    expect(d.posQuantity).toBe(3);
    expect(d.metrcQuantity).toBeNull();
    expect(d.delta).toBe(3);
    expect(d.posInventoryId).toBe('inv-POS-ONLY');
  });

  test('ignores POS records without a metrcTag', () => {
    // Accessories, non-cannabis items, etc. have no metrcTag
    const posInventory = [
      makeInventoryRecord({ metrcTag: undefined }),
      makeInventoryRecord({ id: 'inv-2', metrcTag: '' as unknown as undefined }),
    ];
    const metrcPackages: MetrcPackage[] = [];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);

    expect(result.isClean).toBe(true);
    expect(result.totalPosRecords).toBe(2);
  });

  test('handles multiple simultaneous discrepancy types', () => {
    const posInventory = [
      makeInventoryRecord({ id: 'inv-A', metrcTag: 'TAG-MATCH', quantityOnHand: 5 }),
      makeInventoryRecord({ id: 'inv-B', metrcTag: 'TAG-MISMATCH', quantityOnHand: 7, quantityReserved: 1 }),
      makeInventoryRecord({ id: 'inv-C', metrcTag: 'TAG-POS-ONLY', quantityOnHand: 2 }),
    ];
    const metrcPackages = [
      makeMetrcPackage({ Label: 'TAG-MATCH', Quantity: 5 }),
      makeMetrcPackage({ Label: 'TAG-MISMATCH', Quantity: 10 }),
      makeMetrcPackage({ Label: 'TAG-METRC-ONLY', Quantity: 4 }),
    ];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);

    expect(result.isClean).toBe(false);
    expect(result.discrepancies).toHaveLength(3);

    const types = result.discrepancies.map(d => d.type).sort();
    expect(types).toEqual(['missing_in_metrc', 'missing_in_pos', 'quantity_mismatch']);
  });

  test('returns runAt as a valid ISO 8601 datetime', () => {
    const result = reconcileInventory(TENANT_ID, LICENSE, [], []);
    expect(() => new Date(result.runAt)).not.toThrow();
    expect(new Date(result.runAt).toISOString()).toBe(result.runAt);
  });

  test('handles empty inputs cleanly', () => {
    const result = reconcileInventory(TENANT_ID, LICENSE, [], []);
    expect(result.isClean).toBe(true);
    expect(result.totalPosRecords).toBe(0);
    expect(result.totalMetrcPackages).toBe(0);
  });

  test('delta sign: positive when POS has more than METRC', () => {
    const posInventory = [
      makeInventoryRecord({ metrcTag: 'TAG-X', quantityOnHand: 20, quantityReserved: 0 }),
    ];
    const metrcPackages = [makeMetrcPackage({ Label: 'TAG-X', Quantity: 5 })];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);
    expect(result.discrepancies[0].delta).toBe(15);
  });

  test('delta sign: negative when METRC has more than POS', () => {
    const posInventory = [
      makeInventoryRecord({ metrcTag: 'TAG-Y', quantityOnHand: 5, quantityReserved: 0 }),
    ];
    const metrcPackages = [makeMetrcPackage({ Label: 'TAG-Y', Quantity: 20 })];

    const result = reconcileInventory(TENANT_ID, LICENSE, posInventory, metrcPackages);
    expect(result.discrepancies[0].delta).toBe(-15);
  });
});

// ---- checkLicenseStatus ----------------------------------------------------

describe('checkLicenseStatus', () => {
  test('returns expired for a date in the past', () => {
    expect(checkLicenseStatus('2020-01-01')).toBe('expired');
  });

  test('returns expiring_soon within the default 90-day window', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const dateStr = soon.toISOString().split('T')[0];
    expect(checkLicenseStatus(dateStr)).toBe('expiring_soon');
  });

  test('returns valid for a date well in the future', () => {
    expect(checkLicenseStatus('2099-12-31')).toBe('valid');
  });

  test('respects a custom warningDays value', () => {
    const in45Days = new Date();
    in45Days.setDate(in45Days.getDate() + 45);
    const dateStr = in45Days.toISOString().split('T')[0];

    expect(checkLicenseStatus(dateStr, 30)).toBe('valid');
    expect(checkLicenseStatus(dateStr, 60)).toBe('expiring_soon');
  });

  test('treats a date exactly at expiry boundary as expired', () => {
    // Past midnight — should be expired
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    expect(checkLicenseStatus(dateStr)).toBe('expired');
  });
});
