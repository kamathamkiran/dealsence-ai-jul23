import { RawApiDeal, RawApiFacility, RawApiField, ExtractionData, DealAttribute, AttributeCategory, FacilityGroup } from '../types';

type FieldMeta = {
  value: unknown;
  pageNumber: number;
  confidence: number;
  sourceText: string;
};

function pickPrimitiveFromObject(obj: Record<string, unknown>): string | number | null {
  const preferredKeys = ['text', 'name', 'label', 'code', 'id', 'currency'];
  for (const key of preferredKeys) {
    const v = obj[key];
    if (typeof v === 'string' || typeof v === 'number') return v;
  }
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' || typeof v === 'number') return v;
  }
  return null;
}

function unwrapField(input: unknown, fallbackSourceText = ''): FieldMeta {
  let current = input;
  let pageNumber = 1;
  let confidence = 1;
  let sourceText = fallbackSourceText;

  // Some API variants nest field payloads inside repeated `value` wrappers.
  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== 'object') break;
    const obj = current as Record<string, unknown>;

    if (typeof obj.pageNumber === 'number') pageNumber = obj.pageNumber;
    if (typeof obj.confidence === 'number') confidence = obj.confidence;
    if (typeof obj.sourceText === 'string' && obj.sourceText.trim()) sourceText = obj.sourceText;

    if (!('value' in obj)) break;
    current = obj.value;
  }

  return { value: current, pageNumber, confidence, sourceText };
}

function asAmountField(value: unknown, fallbackSourceText = ''): RawApiField<string | number> {
  const field = unwrapField(value, fallbackSourceText);
  const normalizedValue =
    field.value && typeof field.value === 'object'
      ? pickPrimitiveFromObject(field.value as Record<string, unknown>)
      : field.value;
  return {
    value: normalizedValue === undefined ? null : (normalizedValue as string | number | null),
    pageNumber: field.pageNumber,
    confidence: field.confidence,
    sourceText: field.sourceText,
  };
}

function asStringField(value: unknown, fallbackSourceText = ''): RawApiField {
  const field = unwrapField(value, fallbackSourceText);
  const primitiveValue =
    field.value && typeof field.value === 'object'
      ? pickPrimitiveFromObject(field.value as Record<string, unknown>)
      : field.value;
  return {
    value:
      primitiveValue === null || primitiveValue === undefined
        ? null
        : typeof primitiveValue === 'string' || typeof primitiveValue === 'number'
        ? String(primitiveValue)
        : null,
    pageNumber: field.pageNumber,
    confidence: field.confidence,
    sourceText: field.sourceText,
  };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const trimmed = dateStr.trim();
  if (!trimmed) return 'N/A';

  const normalizedInput = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const d = new Date(normalizedInput);
  if (Number.isNaN(d.getTime())) return trimmed;

  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatAmount(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!trimmed) return 'N/A';
    // Keep API-provided currency strings as-is (e.g. "USD 5,000,000.00").
    if (/^[A-Za-z]{3}\s/.test(trimmed) || trimmed.includes('$')) return trimmed;
    const parsed = Number(trimmed.replace(/[^\d.-]/g, ''));
    if (Number.isNaN(parsed)) return trimmed;
    return `$${parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD`;
}

function toPercent(confidence: number): number {
  // API uses 0.0–1.0; UI expects 0–100
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

function makeAttr(
  field: RawApiField<string | number>,
  id: string,
  label: string,
  category: AttributeCategory,
  displayValue?: string,
  facilityName?: string
): DealAttribute | null {
  if (field.value === null || field.value === undefined || field.value === '') return null;
  const val = displayValue ?? String(field.value);
  return {
    id,
    label,
    value: val,
    originalValue: val,
    confidence: toPercent(field.confidence),
    page: field.pageNumber ?? 1,
    excerpt: field.sourceText ? `"${field.sourceText}"` : '',
    category,
    status: 'PENDING',
    ...(facilityName ? { isFacilityItem: true, facilityName } : {}),
  };
}

function mapFacility(fac: RawApiFacility, idx: number): FacilityGroup {
  const facilityName = fac.facilityName?.value || `Facility ${idx + 1}`;
  const attrs: DealAttribute[] = [];

  const add = (field: RawApiField<string | number> | undefined, id: string, label: string, display?: string) => {
    if (!field) return;
    const a = makeAttr(field as RawApiField<string | number>, `fac_${idx}_${id}`, label, 'FACILITY', display, facilityName);
    if (a) attrs.push(a);
  };

  add(fac.facilityName, 'name', 'Facility Name');
  add(fac.facilityType, 'type', 'Facility Type');
  add(fac.proposedCommitmentAmount as unknown as RawApiField<string>, 'proposed_amount', 'Proposed Commitment Amount', formatAmount(fac.proposedCommitmentAmount?.value));
  add(fac.closingCommitment as unknown as RawApiField<string>, 'closing_commitment', 'Closing Commitment', formatAmount(fac.closingCommitment?.value));
  add(fac.agreementDate, 'agreement_date', 'Agreement Date', formatDate(fac.agreementDate?.value));
  if (fac.effectiveDate?.value) add(fac.effectiveDate, 'effective_date', 'Effective Date', formatDate(fac.effectiveDate.value));
  add(fac.expiryDate, 'expiry_date', 'Expiry Date', formatDate(fac.expiryDate?.value));
  add(fac.finalMaturityDate, 'maturity_date', 'Final Maturity Date', formatDate(fac.finalMaturityDate?.value));
  if (fac.loanPurpose?.loanPurposeCode?.value) add(fac.loanPurpose.loanPurposeCode, 'loan_purpose', 'Loan Purpose');
  if (fac.risk?.riskTypeCode?.value) add(fac.risk.riskTypeCode, 'risk_type', 'Risk Type Code');

  return {
    facilityName,
    facilityType: fac.facilityType?.value || 'N/A',
    amount: formatAmount(fac.proposedCommitmentAmount?.value),
    interestMargin: 'N/A',
    maturityDate: formatDate(fac.finalMaturityDate?.value),
    attributes: attrs,
  };
}

function normalizeRawApiDeal(rawInput: unknown): RawApiDeal {
  const payload = (rawInput ?? {}) as Record<string, unknown>;
  const maybeMetadataDeal = payload.deal && typeof payload.deal === 'object' ? (payload.deal as Record<string, unknown>) : payload;

  const facilitiesSource = Array.isArray(maybeMetadataDeal.facilities)
    ? maybeMetadataDeal.facilities
    : Array.isArray(maybeMetadataDeal.facilityList)
    ? maybeMetadataDeal.facilityList
    : [];

  const normalizedFacilities: RawApiFacility[] = facilitiesSource.map((f, idx) => {
    const fac = (f ?? {}) as Record<string, unknown>;
    return {
      facilityRid: null,
      facilityInternalId: null,
      facilityName: asStringField(fac.facilityName ?? `Facility ${idx + 1}`),
      facilityType: asStringField(fac.facilityType ?? fac.facilityName ?? 'N/A'),
      proposedCommitmentAmount: asAmountField(fac.proposedCommitmentAmount),
      closingCommitment: asAmountField(fac.closingCommitment),
      agreementDate: asStringField(fac.agreementDate),
      effectiveDate: asStringField(fac.effectiveDate),
      expiryDate: asStringField(fac.expiryDate),
      finalMaturityDate: asStringField(fac.finalMaturityDate),
      globalNewAmount: null,
      risk: { riskTypeCode: asStringField((fac.risk as Record<string, unknown> | undefined)?.riskTypeCode) },
      loanPurpose: { loanPurposeCode: asStringField((fac.loanPurpose as Record<string, unknown> | undefined)?.loanPurposeCode) },
      facilityInterestPricingList: Array.isArray(fac.facilityInterestPricingList) ? fac.facilityInterestPricingList : [],
      facilitySubLimit: Array.isArray(fac.facilitySubLimit) ? fac.facilitySubLimit : [],
    };
  });

  const adminSource = (maybeMetadataDeal.administrativeAgent as Record<string, unknown> | undefined)
    ?? (maybeMetadataDeal.dealAdminAgent as Record<string, unknown> | undefined)
    ?? {};

  return {
    dealName: asStringField(maybeMetadataDeal.dealName),
    currency: asStringField(maybeMetadataDeal.currency),
    department: asStringField(maybeMetadataDeal.department),
    branch: asStringField(maybeMetadataDeal.branch),
    processingAreaCode: asStringField(maybeMetadataDeal.processingAreaCode),
    classification: asStringField(maybeMetadataDeal.classification),
    agreementDate: asStringField(maybeMetadataDeal.agreementDate),
    globalDealProposedCommitmentAmount: asAmountField(maybeMetadataDeal.globalDealProposedCommitmentAmount),
    expenseCode: asStringField(maybeMetadataDeal.expenseCode),
    dealInternalId: null,
    dealTrackingNumber: String(maybeMetadataDeal.dealTrackingNumber ?? ''),
    administrativeAgent: {
      customerExternalId: asStringField((adminSource.customerExternalId as unknown) ?? null),
      dealAdminServicingGroup: {
        profileType: asStringField(((adminSource.dealAdminServicingGroup as Record<string, unknown> | undefined)?.profileType as unknown) ?? null),
      },
    },
    dealBorrower: {
      customerExternalId: asStringField(((maybeMetadataDeal.dealBorrower as Record<string, unknown> | undefined)?.customerExternalId as unknown) ?? null),
    },
    borrowerIndicator: String(maybeMetadataDeal.borrowerIndicator ?? ''),
    isDistressed: String(maybeMetadataDeal.isDistressed ?? ''),
    interestPricing: Array.isArray(maybeMetadataDeal.interestPricing) ? maybeMetadataDeal.interestPricing : [],
    circleFinalStatusCode: String(maybeMetadataDeal.circleFinalStatusCode ?? ''),
    price: typeof maybeMetadataDeal.price === 'number' ? maybeMetadataDeal.price : 0,
    facilities: normalizedFacilities,
    tradeList: Array.isArray(maybeMetadataDeal.tradeList) ? maybeMetadataDeal.tradeList : [],
    version: String(maybeMetadataDeal.version ?? 'v1'),
  };
}

function guessCategory(key: string): AttributeCategory {
  const normalized = key.toLowerCase();
  if (normalized.includes('date') || normalized.includes('rate') || normalized.includes('margin')) return 'DATES & RATES';
  if (normalized.includes('amount') || normalized.includes('price') || normalized.includes('commitment') || normalized.includes('currency')) return 'FINANCIAL';
  if (normalized.includes('legal') || normalized.includes('governance') || normalized.includes('compliance') || normalized.includes('covenant')) return 'LEGAL & GOVERNANCE';
  return 'GENERAL';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRawFieldLike(value: unknown): value is { value: unknown; pageNumber?: number; confidence?: number; sourceText?: string } {
  return isPlainObject(value) && 'value' in value && 'pageNumber' in value && 'confidence' in value && 'sourceText' in value;
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function stringFromRawValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function rawFieldToAttribute(field: { value: unknown; pageNumber?: number; confidence?: number; sourceText?: string }, path: string[]): DealAttribute | null {
  if (field.value === null || field.value === undefined) return null;
  const rawValue = stringFromRawValue(field.value);
  const label = path.map(humanizeKey).join(' / ');
  const leafKey = path[path.length - 1] ?? label;
  return {
    id: path.join('_').replace(/[^a-zA-Z0-9_]/g, '_'),
    label,
    value: rawValue,
    originalValue: rawValue,
    confidence: toPercent(typeof field.confidence === 'number' ? field.confidence : 1),
    page: typeof field.pageNumber === 'number' ? field.pageNumber : 1,
    excerpt: field.sourceText ? `"${field.sourceText}"` : '',
    category: guessCategory(leafKey),
    status: 'PENDING',
  };
}

function collectRawAttributes(node: unknown, path: string[] = [], skipKeys = new Set<string>()): DealAttribute[] {
  if (!node) return [];

  if (isRawFieldLike(node)) {
    const attr = rawFieldToAttribute(node, path);
    return attr ? [attr] : [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((item, idx) => collectRawAttributes(item, [...path, String(idx)], skipKeys));
  }

  if (!isPlainObject(node)) return [];

  return Object.entries(node).flatMap(([key, value]) => {
    if (skipKeys.has(key)) return [];
    return collectRawAttributes(value, [...path, key], skipKeys);
  });
}

function facilityNameFromItem(item: Record<string, unknown>, fallback: string): string {
  const nameField = item.facilityName;
  if (isRawFieldLike(nameField) && nameField.value !== null && nameField.value !== undefined) {
    return stringFromRawValue(nameField.value) || fallback;
  }
  return fallback;
}

export function mapRawApiToExtractionData(
  rawInput: RawApiDeal | Record<string, unknown>,
  overrides?: { uuid?: string; fileName?: string; fileSize?: string; pageCount?: number }
): ExtractionData {
  const rawPayload = (rawInput ?? {}) as Record<string, unknown>;
  const dealPayload = rawPayload.deal && isPlainObject(rawPayload.deal) ? rawPayload.deal : rawPayload;
  const facilityItems = Array.isArray(dealPayload.facilities)
    ? dealPayload.facilities
    : Array.isArray(dealPayload.facilityList)
    ? dealPayload.facilityList
    : [];

  const topLevelSkip = new Set(['facilities', 'facilityList']);
  const attributes = collectRawAttributes(dealPayload, [], topLevelSkip);

  const facilities: FacilityGroup[] = facilityItems.map((item, idx) => {
    const fac = isPlainObject(item) ? item : {};
    const facilityAttributes = collectRawAttributes(fac);
    const facilityName = facilityNameFromItem(fac, `Facility ${idx + 1}`);
    const facilityType = isRawFieldLike(fac.facilityType) ? stringFromRawValue(fac.facilityType.value) : 'N/A';
    const amountField = isRawFieldLike(fac.proposedCommitmentAmount) ? stringFromRawValue(fac.proposedCommitmentAmount.value) : 'N/A';
    const maturityField = isRawFieldLike(fac.finalMaturityDate) ? stringFromRawValue(fac.finalMaturityDate.value) : 'N/A';

    return {
      facilityName,
      facilityType,
      amount: amountField || 'N/A',
      interestMargin: 'N/A',
      maturityDate: maturityField || 'N/A',
      attributes: facilityAttributes,
    };
  });

  const dealNameField = isRawFieldLike(dealPayload.dealName) ? stringFromRawValue(dealPayload.dealName.value) : 'Deal';
  const borrowerField = isPlainObject(dealPayload.dealBorrower) && isRawFieldLike(dealPayload.dealBorrower.customerExternalId)
    ? stringFromRawValue(dealPayload.dealBorrower.customerExternalId.value)
    : 'N/A';

  return {
    uuid: overrides?.uuid ?? 'api-extracted-uuid',
    fileName: overrides?.fileName ?? `${dealNameField}.pdf`,
    fileSize: overrides?.fileSize ?? 'N/A',
    pageCount: overrides?.pageCount ?? 1,
    documentType: 'Credit Agreement',
    borrowerName: borrowerField,
    kycApproved: false,
    extractedAt: new Date().toISOString(),
    attributes,
    facilities,
  };
}
