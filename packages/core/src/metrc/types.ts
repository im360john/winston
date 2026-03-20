/**
 * METRC compliance API types.
 *
 * These types represent entities returned by the METRC state-regulatory API.
 * Separate from the Winston POS schema — METRC data is compliance-specific.
 */

// ---- State config ----------------------------------------------------------

/** Two-letter state codes where METRC is the mandated track-and-trace system. */
export type MetrcStateCode =
  | 'AK' | 'AZ' | 'CA' | 'CO' | 'IL' | 'MA' | 'MD'
  | 'MI' | 'MO' | 'MT' | 'NJ' | 'NM' | 'NV' | 'OH'
  | 'OK' | 'OR' | 'PA' | 'WA';

/** Configuration for a single tenant's METRC connection. */
export interface MetrcConfig {
  /** Two-letter US state code (e.g. 'CA', 'CO'). Determines the API host. */
  stateCode: MetrcStateCode;
  /** METRC-issued Software API Key (vendor-level; shared across tenants). */
  softwareApiKey: string;
  /** User API Key (per-licensee; issued by the state regulator). */
  userApiKey: string;
  /** METRC license number for this facility (e.g. 'C11-0000001-LIC'). */
  licenseNumber: string;
  /** Request timeout in ms. Default: 15 000. */
  timeoutMs?: number;
  /**
   * Max requests per second. Default: 5.
   * METRC enforces conservative rate limits — stay well below their cap.
   */
  maxRequestsPerSecond?: number;
  /** Max retry attempts for transient failures. Default: 3. */
  maxRetries?: number;
}

// ---- Package ---------------------------------------------------------------

/** An active or inactive METRC package (track-and-trace unit). */
export interface MetrcPackage {
  /** METRC internal numeric ID. */
  Id: number;
  /** METRC tag UID (e.g. '1A4000000000000000000001'). Primary match key. */
  Label: string;
  PackageType: string;
  ProductName: string;
  ProductCategoryName: string;
  /** Remaining quantity in the package. */
  Quantity: number;
  UnitOfMeasureName: string;
  UnitOfMeasureAbbreviation: string;
  PatientLicenseNumber: string | null;
  ItemFromFacilityLicenseNumber: string | null;
  /** ISO 8601 date when the package was created. */
  PackagedDate: string;
  /** ISO 8601 date. Null if no expiration. */
  ExpirationDate: string | null;
  UseByDate: string | null;
  /** ISO 8601 datetime of last state change. Used for incremental sync. */
  LastModified: string;
  FinishedDate: string | null;
  IsProductionBatch: boolean;
  IsTestingSample: boolean;
  IsTradeSample: boolean;
  IsOnHold: boolean;
  ArchivedDate: string | null;
  /** Raw API payload preserved for debugging. */
  _raw?: unknown;
}

// ---- Transfer --------------------------------------------------------------

/** A METRC incoming or outgoing transfer manifest. */
export interface MetrcTransfer {
  Id: number;
  ManifestNumber: string;
  ShipperFacilityLicenseNumber: string;
  ShipperFacilityName: string;
  RecipientFacilityLicenseNumber: string;
  RecipientFacilityName: string;
  TransferType: string;
  TransporterFacilityLicenseNumber: string | null;
  DriverName: string | null;
  DriverOccupationalLicenseNumber: string | null;
  VehicleMake: string | null;
  VehicleModel: string | null;
  VehicleLicensePlateNumber: string | null;
  EstimatedDepartureDateTime: string | null;
  ActualDepartureDateTime: string | null;
  EstimatedArrivalDateTime: string | null;
  ActualArrivalDateTime: string | null;
  LastModified: string;
  PackageCount: number;
  _raw?: unknown;
}

// ---- Harvest ---------------------------------------------------------------

/** A METRC harvest batch. */
export interface MetrcHarvest {
  Id: number;
  Name: string;
  HarvestType: string;
  SourceStrainCount: number;
  SourceStrainNames: string;
  /** ISO 8601 date when harvesting began. */
  HarvestStartDate: string;
  /** ISO 8601 date when the batch was finished/closed. Null if still active. */
  FinishedDate: string | null;
  CurrentWeight: number;
  TotalWasteWeight: number;
  UnitOfWeightName: string;
  PackageCount: number;
  UnitOfWeightAbbreviation: string;
  LastModified: string;
  _raw?: unknown;
}

// ---- License ---------------------------------------------------------------

/** A METRC license record for a facility. */
export interface MetrcLicense {
  Number: string;
  Status: string;
  /** ISO 8601 date when this status was set. */
  StatusDate: string;
  /** ISO 8601 date when the license expires. */
  ExpirationDate: string;
  FacilityName: string;
  FacilityType: string;
  FacilityLicenseType: string;
  _raw?: unknown;
}

// ---- Reconciliation --------------------------------------------------------

/** A single discrepancy found between POS inventory and METRC active packages. */
export interface ReconciliationDiscrepancy {
  /** METRC tag / Label that was compared. */
  metrcTag: string;
  /**
   * Quantity (on-hand + reserved) reported by the POS.
   * Null when the tag has no matching POS record.
   */
  posQuantity: number | null;
  /**
   * Quantity reported by METRC.
   * Null when the POS tag has no matching METRC active package.
   */
  metrcQuantity: number | null;
  /**
   * posQuantity − metrcQuantity.
   * Positive → POS reports more than METRC.
   * Negative → METRC reports more than POS.
   */
  delta: number;
  type: 'quantity_mismatch' | 'missing_in_pos' | 'missing_in_metrc';
  /** Product name from METRC (when available). */
  metrcProductName?: string;
  /** Inventory record ID from the POS (when available). */
  posInventoryId?: string;
}

/** Summary result of a single reconciliation run. */
export interface ReconciliationResult {
  tenantId: string;
  licenseNumber: string;
  /** ISO 8601 datetime when this reconciliation was performed. */
  runAt: string;
  /** Total POS inventory records supplied (including those without a METRC tag). */
  totalPosRecords: number;
  /** Total active METRC packages compared against. */
  totalMetrcPackages: number;
  discrepancies: ReconciliationDiscrepancy[];
  discrepancyCount: number;
  /** True when no discrepancies were found. */
  isClean: boolean;
}
