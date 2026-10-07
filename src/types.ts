export type AttributeCategory = 'GENERAL' | 'FINANCIAL' | 'DATES & RATES' | 'LEGAL & GOVERNANCE' | 'FACILITY';

// ─── Raw API response types (shape returned by /workflow/:uuid/extracted) ────

export interface RawApiField<T = string> {
  value: T | null;
  pageNumber: number | null;
  confidence: number;
  sourceText: string;
}

export interface RawApiFacility {
  facilityRid: null;
  facilityInternalId: null;
  facilityName: RawApiField;
  facilityType: RawApiField;
  proposedCommitmentAmount: RawApiField<string | number>;
  closingCommitment: RawApiField<string | number>;
  agreementDate: RawApiField;
  effectiveDate: RawApiField;
  expiryDate: RawApiField;
  finalMaturityDate: RawApiField;
  globalNewAmount: null;
  risk: { riskTypeCode: RawApiField };
  loanPurpose: { loanPurposeCode: RawApiField };
  facilityInterestPricingList: unknown[];
  facilitySubLimit: unknown[];
}

export interface RawApiDeal {
  dealName: RawApiField;
  currency: RawApiField;
  department: RawApiField;
  branch: RawApiField;
  processingAreaCode: RawApiField;
  classification: RawApiField;
  agreementDate: RawApiField;
  globalDealProposedCommitmentAmount: RawApiField<string | number>;
  expenseCode: RawApiField;
  dealInternalId: null;
  dealTrackingNumber: string;
  administrativeAgent: {
    customerExternalId: RawApiField;
    dealAdminServicingGroup: {
      profileType: RawApiField;
    };
  };
  dealBorrower: {
    customerExternalId: RawApiField;
  };
  borrowerIndicator: string;
  isDistressed: string;
  interestPricing: unknown[];
  circleFinalStatusCode: string;
  price: number;
  facilities: RawApiFacility[];
  tradeList: unknown[];
  version: string;
}
export type AttributeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DealAttribute {
  id: string;
  label: string;
  value: string;
  originalValue: string;
  confidence: number;
  page: number;
  excerpt: string;
  category: AttributeCategory;
  status: AttributeStatus;
  isFacilityItem?: boolean;
  facilityName?: string;
  highlightCoordinates?: {
    topPercent: number;
    leftPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
}

export interface FacilityGroup {
  facilityName: string;
  facilityType: string;
  amount: string;
  interestMargin: string;
  maturityDate: string;
  attributes: DealAttribute[];
}

export interface ExtractionData {
  uuid: string;
  fileName: string;
  fileSize: string;
  pageCount: number;
  documentType: string;
  borrowerName: string;
  kycApproved: boolean;
  extractedAt: string;
  attributes: DealAttribute[];
  facilities?: FacilityGroup[];
}

export interface WorkflowStatusResponse {
  uuid: string;
  status: string;
  nextAgent?: string | null;
  username?: string;
  updatedAt?: string;
  completedAt?: string | null;
  failureReason?: string | null;
  eventStatus?: string | null;
  currentAgent?: string | null;
  failedAgent?: string | null;
  eventFailureReason?: string | null;
}

export interface CreateDealResponse {
  dealId: string;
  status: string;
  message: string;
  timestamp: string;
  deal: CreatedDealRecord;
}

export interface CreatedDealRecord {
  dealId: string;
  uuid: string;
  borrowerName: string;
  dealName: string;
  fileName: string;
  effectiveDate: string;
  totalAmount: string;
  createdAt: string;
  totalFields: number;
  approvedFields: number;
  rejectedFields: number;
  pendingFields: number;
  status: 'SIGNED_OFF' | 'ACTIVE' | 'UNDER_REVIEW';
  attributes: Record<string, string>;
  facilityList?: Array<Record<string, unknown>>;
}

export interface UploadResponse {
  uuid: string;
  status: string;
  message: string;
  fileName: string;
  fileSize: string;
  userName: string;
}
