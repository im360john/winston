/**
 * MetrcAdapter unit tests (no real network).
 *
 * MetrcClient is mocked so we can test the full adapter pipeline:
 * connect → data fetch → pagination envelope.
 */

import { MetrcAdapter } from '../../src/metrc/adapter';
import { MetrcClient } from '../../src/metrc/client';
import { PosAdapterError } from '../../src/types/pos';

jest.mock('../../src/metrc/client');

const MockedClient = MetrcClient as jest.MockedClass<typeof MetrcClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

const BASE_CONFIG = {
  stateCode: 'CA' as const,
  softwareApiKey: 'software-key-abc',
  userApiKey: 'user-key-xyz',
  licenseNumber: 'C11-0000001-LIC',
};

function makeAdapter() {
  MockedClient.mockClear();
  return new MetrcAdapter(BASE_CONFIG);
}

// Minimal valid MetrcPackage fixture
const PACKAGE_FIXTURE = {
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
  LastModified: '2024-01-15T10:00:00Z',
  FinishedDate: null,
  IsProductionBatch: false,
  IsTestingSample: false,
  IsTradeSample: false,
  IsOnHold: false,
  ArchivedDate: null,
};

const LICENSE_FIXTURE = {
  Number: 'C11-0000001-LIC',
  Status: 'Active',
  StatusDate: '2024-01-01',
  ExpirationDate: '2026-12-31',
  FacilityName: 'Test Dispensary',
  FacilityType: 'Retailer',
  FacilityLicenseType: 'Adult-Use Retailer',
};

// ---- connect ---------------------------------------------------------------

describe('MetrcAdapter.connect()', () => {
  test('marks adapter as connected on success', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);

    await adapter.connect();
    expect(adapter.isConnected).toBe(true);
  });

  test('marks adapter as disconnected and rethrows PosAdapterError on auth failure', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockRejectedValueOnce(
      new PosAdapterError('METRC auth error: HTTP 401', 'AUTH', false),
    );

    await expect(adapter.connect()).rejects.toThrow(PosAdapterError);
    expect(adapter.isConnected).toBe(false);
  });

  test('wraps non-PosAdapterError in PosAdapterError on connect failure', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockRejectedValueOnce(new Error('network down'));

    await expect(adapter.connect()).rejects.toThrow(PosAdapterError);
    expect(adapter.isConnected).toBe(false);
  });
});

// ---- getActivePackages -----------------------------------------------------

describe('MetrcAdapter.getActivePackages()', () => {
  test('throws if not connected', async () => {
    const adapter = makeAdapter();
    await expect(adapter.getActivePackages()).rejects.toThrow(PosAdapterError);
  });

  test('returns page of packages with correct structure', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);
    MockedClient.prototype.getActivePackages.mockResolvedValueOnce([PACKAGE_FIXTURE]);

    await adapter.connect();
    const page = await adapter.getActivePackages();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].Label).toBe('1A4000000000000000000001');
    expect(page.items[0].Quantity).toBe(10);
    expect(page.hasMore).toBe(false);
  });

  test('passes filter params to client', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);
    MockedClient.prototype.getActivePackages.mockResolvedValueOnce([]);

    await adapter.connect();
    await adapter.getActivePackages({
      lastModifiedStart: '2024-01-01T00:00:00Z',
      skip: 100,
      take: 200,
    });

    const callArgs = MockedClient.prototype.getActivePackages.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).toMatchObject({
      lastModifiedStart: '2024-01-01T00:00:00Z',
      skip: 100,
      take: 200,
    });
  });

  test('caps take at 500 (METRC hard limit)', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);
    MockedClient.prototype.getActivePackages.mockResolvedValueOnce([]);

    await adapter.connect();
    await adapter.getActivePackages({ take: 9999 });

    const callArgs = MockedClient.prototype.getActivePackages.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.take).toBe(500);
  });

  test('hasMore is true when full page returned', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);
    // Return exactly `take` items → signals there may be more
    const fullPage = Array.from({ length: 10 }, (_, i) => ({ ...PACKAGE_FIXTURE, Id: i }));
    MockedClient.prototype.getActivePackages.mockResolvedValueOnce(fullPage);

    await adapter.connect();
    const page = await adapter.getActivePackages({ take: 10 });

    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(10);
  });
});

// ---- getInactivePackages ---------------------------------------------------

describe('MetrcAdapter.getInactivePackages()', () => {
  test('returns page of inactive packages', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);
    MockedClient.prototype.getInactivePackages.mockResolvedValueOnce([PACKAGE_FIXTURE]);

    await adapter.connect();
    const page = await adapter.getInactivePackages();

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });
});

// ---- getIncomingTransfers --------------------------------------------------

describe('MetrcAdapter.getIncomingTransfers()', () => {
  test('returns page of transfers', async () => {
    const transfer = {
      Id: 100,
      ManifestNumber: 'MFST-0001',
      ShipperFacilityLicenseNumber: 'C11-9999999-LIC',
      ShipperFacilityName: 'Supplier Co',
      RecipientFacilityLicenseNumber: 'C11-0000001-LIC',
      RecipientFacilityName: 'Test Dispensary',
      TransferType: 'Licensed',
      TransporterFacilityLicenseNumber: null,
      DriverName: null,
      DriverOccupationalLicenseNumber: null,
      VehicleMake: null,
      VehicleModel: null,
      VehicleLicensePlateNumber: null,
      EstimatedDepartureDateTime: null,
      ActualDepartureDateTime: null,
      EstimatedArrivalDateTime: null,
      ActualArrivalDateTime: null,
      LastModified: '2024-03-01T08:00:00Z',
      PackageCount: 3,
    };

    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);
    MockedClient.prototype.getIncomingTransfers.mockResolvedValueOnce([transfer]);

    await adapter.connect();
    const page = await adapter.getIncomingTransfers();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].ManifestNumber).toBe('MFST-0001');
  });
});

// ---- getLicenses -----------------------------------------------------------

describe('MetrcAdapter.getLicenses()', () => {
  test('returns license array', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses
      .mockResolvedValueOnce([LICENSE_FIXTURE])  // connect
      .mockResolvedValueOnce([LICENSE_FIXTURE]); // explicit call

    await adapter.connect();
    const licenses = await adapter.getLicenses();

    expect(licenses).toHaveLength(1);
    expect(licenses[0].Number).toBe('C11-0000001-LIC');
    expect(licenses[0].Status).toBe('Active');
  });

  test('throws if not connected', async () => {
    const adapter = makeAdapter();
    await expect(adapter.getLicenses()).rejects.toThrow(PosAdapterError);
  });
});

// ---- disconnect ------------------------------------------------------------

describe('MetrcAdapter.disconnect()', () => {
  test('marks adapter as disconnected', async () => {
    const adapter = makeAdapter();
    MockedClient.prototype.getLicenses.mockResolvedValueOnce([LICENSE_FIXTURE]);

    await adapter.connect();
    expect(adapter.isConnected).toBe(true);

    await adapter.disconnect();
    expect(adapter.isConnected).toBe(false);
  });
});
