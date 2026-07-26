import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  X,
  Layers,
  Sparkles,
  Loader2,
  CheckCheck,
  ShieldCheck,
  Send
} from 'lucide-react';
import { PdfViewer } from './PdfViewer';
import { ExtractionData, DealAttribute, AttributeCategory, AttributeStatus, FacilityGroup } from '../types';
import { ACTUAL_DEAL_1_EXTRACTION_DATA } from '../data/actualDeal_1';
import { mapRawApiToExtractionData } from '../data/mapApiResponse';

interface ReviewScreenProps {
  uuid: string;
  pdfUrl?: string | null;
  fileName?: string;
  onSignOffComplete: (createDealResponse: any) => void;
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({ uuid, pdfUrl, fileName, onSignOffComplete }) => {
  const [data, setData] = useState<ExtractionData | null>(null);
  const [attributes, setAttributes] = useState<DealAttribute[]>([]);
  const [facilities, setFacilities] = useState<FacilityGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active page & highlighted attribute for PDF viewer jump
  const [activePdfPage, setActivePdfPage] = useState<number>(1);
  const [selectedAttribute, setSelectedAttribute] = useState<DealAttribute | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Editing state
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Dropdown states for ProcessingArea, Department, Branch
  const [processingArea, setProcessingArea] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [branch, setBranch] = useState<string>('');

  // Accordion open/close state for facilities (populated dynamically after data loads)
  const [openFacilities, setOpenFacilities] = useState<Record<string, boolean>>({});

  // Is sign-off ready state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Helper: apply extracted data (or fall back to sample_1.json data)
  const applyData = (extracted: ExtractionData) => {
    const hasAttrs = (extracted.attributes?.length ?? 0) > 0;
    const source = hasAttrs ? extracted : ACTUAL_DEAL_1_EXTRACTION_DATA;
    setData(source);
    setAttributes(source.attributes);
    setFacilities(source.facilities ?? []);
    // Open all facility accordions by default
    const openMap: Record<string, boolean> = {};
    (source.facilities ?? []).forEach(f => { openMap[f.facilityName] = true; });
    setOpenFacilities(openMap);
  };

  // 1. Fetch JSON from API on page load
  useEffect(() => {
    const fetchExtractedData = async () => {
      setIsLoading(true);
      try {
        let apiUrl = `http://localhost:8081/api/workflow/${uuid}/metadata`;
        if (window.location.hostname === 'localhost' && window.location.port === '3000') {
          apiUrl = `http://localhost:8081/api/workflow/${uuid}/metadata`;
        }

        let res: Response;
        try {
          res = await fetch(apiUrl);
          console.log("Result : " , res);
        } catch {
          res = await fetch(`http://localhost:8081/api/workflow/${uuid}/metadata`);
        }

        if (res.ok) {
          const rawPayload = await res.json();
          const mapped = mapRawApiToExtractionData(rawPayload as Record<string, unknown>, { uuid });
          applyData(mapped);
        } else {
          // API error — use sample_1.json fallback
          applyData(ACTUAL_DEAL_1_EXTRACTION_DATA);
        }
      } catch (e) {
        console.error('Error fetching extracted data:', e);
        applyData(ACTUAL_DEAL_1_EXTRACTION_DATA);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExtractedData();
  }, [uuid]);

  // Jump to PDF page & highlight attribute
  const handleJumpToPage = (attr: DealAttribute) => {
    setActivePdfPage(attr.page);
    setSelectedAttribute(attr);
  };

  // Status updates
  const handleSetStatus = (id: string, status: AttributeStatus) => {
    setAttributes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );

    setFacilities((prev) =>
      prev.map((fac) => ({
        ...fac,
        attributes: fac.attributes.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      }))
    );
  };

  const handleApproveAll = () => {
    setAttributes((prev) => prev.map((item) => ({ ...item, status: 'APPROVED' })));
    setFacilities((prev) =>
      prev.map((fac) => ({
        ...fac,
        attributes: fac.attributes.map((item) => ({ ...item, status: 'APPROVED' }))
      }))
    );
  };

  const handleRejectAll = () => {
    setAttributes((prev) => prev.map((item) => ({ ...item, status: 'REJECTED' })));
    setFacilities((prev) =>
      prev.map((fac) => ({
        ...fac,
        attributes: fac.attributes.map((item) => ({ ...item, status: 'REJECTED' }))
      }))
    );
  };

  const handleResetAll = () => {
    setAttributes((prev) => prev.map((item) => ({ ...item, status: 'PENDING' })));
    setFacilities((prev) =>
      prev.map((fac) => ({
        ...fac,
        attributes: fac.attributes.map((item) => ({ ...item, status: 'PENDING' }))
      }))
    );
  };

  // Inline value editing
  const handleStartEdit = (attr: DealAttribute) => {
    setEditingAttrId(attr.id);
    setEditValue(attr.value);
  };

  const handleSaveEdit = (id: string) => {
    setAttributes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value: editValue } : item))
    );
    setFacilities((prev) =>
      prev.map((fac) => ({
        ...fac,
        attributes: fac.attributes.map((item) =>
          item.id === id ? { ...item, value: editValue } : item
        )
      }))
    );
    setEditingAttrId(null);
  };

  // Toggle facility accordion
  const toggleFacility = (facilityName: string) => {
    setOpenFacilities((prev) => ({
      ...prev,
      [facilityName]: !prev[facilityName]
    }));
  };

  // Compute summary stats
  const allFieldsList = [
    ...attributes,
    ...facilities.flatMap((f) => f.attributes)
  ];
  const approvedCount = allFieldsList.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = allFieldsList.filter((a) => a.status === 'REJECTED').length;
  const pendingCount = allFieldsList.filter((a) => a.status === 'PENDING').length;
  const totalFields = allFieldsList.length;
  const maxExtractedPage = allFieldsList.reduce((max, attr) => Math.max(max, attr.page || 1), 1);
  const derivedPageCount = Math.max(data?.pageCount ?? 0, maxExtractedPage, 1);
  const pageFieldCounts = Array.from({ length: derivedPageCount }, (_, idx) => {
    const page = idx + 1;
    return allFieldsList.filter((attr) => attr.page === page).length;
  });

  const assignNestedValue = (target: Record<string, any>, path: string[], value: string) => {
    if (path.length === 0) return;

    let current: Record<string, any> = target;
    path.forEach((segment, index) => {
      const isLeaf = index === path.length - 1;
      if (isLeaf) {
        current[segment] = value;
        return;
      }

      if (!current[segment] || typeof current[segment] !== 'object' || Array.isArray(current[segment])) {
        current[segment] = {};
      }
      current = current[segment];
    });
  };

  const buildObjectFromAttributes = (items: DealAttribute[]) => {
    const result: Record<string, any> = {};
    items.forEach((attr) => {
      const path = attr.id.split('_').filter(Boolean);
      assignNestedValue(result, path, attr.value);
    });
    return result;
  };

  // Create JSON in API-like structure, but only with key/value pairs.
  const createNameValuePairJson = () => {
    const jsonResult = buildObjectFromAttributes(attributes);
    if (processingArea) jsonResult.processingAreaCode = processingArea;
    if (department) jsonResult.department = department;
    if (branch) jsonResult.branch = branch;
    jsonResult.facilityList = facilities.map((facility) => buildObjectFromAttributes(facility.attributes));
    return jsonResult;
  };

  // Handle Sign Off & Create POST call
  const handleSignOffAndCreate = async () => {
    setIsSubmitting(true);
    const jsonPairs = createNameValuePairJson();
    // Snapshot counts at submit time so FinalScreen always reflects the latest review decision state.
    const submitAllFields = [...attributes, ...facilities.flatMap((f) => f.attributes)];
    const submitApprovedCount = submitAllFields.filter((a) => a.status === 'APPROVED').length;
    const submitRejectedCount = submitAllFields.filter((a) => a.status === 'REJECTED').length;
    const submitPendingCount = submitAllFields.filter((a) => a.status === 'PENDING').length;
    const submitTotalFields = submitAllFields.length;
console.log('Sign-off JSON payload:', jsonPairs);
    try {
      let createUrl = '/api/deals/create';
      if (window.location.hostname === 'localhost' && window.location.port === '3000') {
        createUrl = 'http://localhost:8081/api/deals/create';
      }

      const payload = {
        uuid,
        fileName: data?.fileName ?? ACTUAL_DEAL_1_EXTRACTION_DATA.fileName,
        borrowerName: data?.borrowerName ?? ACTUAL_DEAL_1_EXTRACTION_DATA.borrowerName,
        attributes: jsonPairs,
        Borrower: jsonPairs.dealBorrower?.customerExternalId ?? data?.borrowerName,
        'Deal Name': jsonPairs.dealName ?? data?.fileName,
        'Total Aggregate Amount': jsonPairs.globalDealProposedCommitmentAmount ?? jsonPairs.totalAggregateAmount,
        'Effective Date': jsonPairs.agreementDate ?? jsonPairs.effectiveDate
      };

      let res: Response;
      try {
        res = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {
        res = await fetch('/workflow/create/deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const createResponse = await res.json();
        const normalizedResponse = {
          ...createResponse,
          deal: {
            ...(createResponse?.deal ?? {}),
            totalFields: submitTotalFields,
            approvedFields: submitApprovedCount,
            rejectedFields: submitRejectedCount,
            pendingFields: submitPendingCount,
          },
        };
        onSignOffComplete(normalizedResponse);
      } else {
        throw new Error('Failed to create deal via API');
      }
    } catch (e) {
      console.error('Create deal error:', e);
      // Fallback sign-off using actual loaded data
      onSignOffComplete({
        success: true,
        dealId: `DEAL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'DEAL_CREATED',
        message: 'Deal creation done successfully!',
        deal: {
          dealId: `DEAL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          uuid,
          borrowerName: data?.borrowerName ?? ACTUAL_DEAL_1_EXTRACTION_DATA.borrowerName,
          dealName: jsonPairs.dealName ?? data?.fileName ?? ACTUAL_DEAL_1_EXTRACTION_DATA.fileName,
          fileName: data?.fileName ?? ACTUAL_DEAL_1_EXTRACTION_DATA.fileName,
          effectiveDate: jsonPairs.agreementDate ?? jsonPairs.effectiveDate ?? 'N/A',
          totalAmount: jsonPairs.globalDealProposedCommitmentAmount ?? jsonPairs.totalAggregateAmount ?? 'N/A',
          createdAt: new Date().toLocaleString(),
          totalFields: submitTotalFields,
          approvedFields: submitApprovedCount,
          rejectedFields: submitRejectedCount,
          pendingFields: submitPendingCount,
          status: 'SIGNED_OFF',
          attributes: Object.fromEntries(
            Object.entries(jsonPairs).filter(([key]) => key !== 'facilityList') as Array<[string, string]>
          ),
          facilityList: Array.isArray(jsonPairs.facilityList) ? jsonPairs.facilityList : []
        }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter attributes for display
  const filteredAttributes = attributes.filter((attr) => {
    const matchesSearch =
      attr.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attr.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attr.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || attr.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-57px)] flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">
            Parsing extracted credit agreement JSON attributes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-57px)] flex flex-col bg-slate-100 overflow-hidden">
      {/* Dual Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: PDF Viewer */}
        <div className="w-1/2 h-full border-r border-slate-300">
          <PdfViewer
            activePage={activePdfPage}
            activeAttribute={selectedAttribute}
            pdfUrl={pdfUrl}
            fileName={fileName ?? data?.fileName}
            pageCount={derivedPageCount}
            pageFieldCounts={pageFieldCounts}
            onPageChange={(p) => setActivePdfPage(p)}
          />
        </div>

        {/* Right Pane: Extracted Deal Attributes */}
        <div className="w-1/2 h-full flex flex-col bg-white overflow-hidden">
          {/* Top Filter & Search Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-sm">Extracted Deal Attributes</h2>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalFields}
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusFilter === 'ALL'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All {totalFields}
                </button>
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusFilter === 'PENDING'
                      ? 'bg-amber-500 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending {pendingCount}
                </button>
                <button
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusFilter === 'APPROVED'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Approved {approvedCount}
                </button>
                <button
                  onClick={() => setStatusFilter('REJECTED')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusFilter === 'REJECTED'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rejected {rejectedCount}
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attributes, values, or pages..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>
          </div>

          {/* Cards Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
            {/* General & Financial Attributes */}
            {filteredAttributes.map((attr) => {
              const labelLower = attr.label.toLowerCase();
              const isBorrower = attr.id === 'borrower_name' || labelLower === 'borrower';
              const isDealBorrower = labelLower.includes('deal borrower') || attr.id.toLowerCase().includes('dealborrower');
              const shouldShowKycBadge = isDealBorrower || (isBorrower && data?.kycApproved);
              const displayLabel = isDealBorrower ? `${attr.label}` : attr.label;

              return (
                <div
                  key={attr.id}
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all hover:shadow-xs ${
                    attr.status === 'APPROVED'
                      ? 'border-emerald-200 bg-emerald-50/10'
                      : attr.status === 'REJECTED'
                      ? 'border-rose-200 bg-rose-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {attr.category}
                      </span>

                      {/* Borrower KYC Approved badge near borrower name */}
                      {shouldShowKycBadge && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          KYC Approved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Page Jump Button */}
                      <button
                        onClick={() => handleJumpToPage(attr)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 inline-flex items-center gap-1 transition-colors"
                      >
                        Page {attr.page} <ExternalLink className="w-3 h-3" />
                      </button>

                      {/* Status Badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          attr.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : attr.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {attr.status === 'APPROVED' ? '✓ Approved' : attr.status === 'REJECTED' ? '✕ Rejected' : '⏱ Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Field Label & Value with Edit Button */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between items-center">
                      {/* Label click jumps to PDF page */}
                      <button
                        onClick={() => handleJumpToPage(attr)}
                        className="font-bold text-slate-900 text-sm hover:text-blue-600 text-left transition-colors flex items-center gap-1.5"
                      >
                        {displayLabel}
                      </button>

                      <button
                        onClick={() => handleStartEdit(attr)}
                        title="Edit value"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Value Area (Editable) */}
                    {editingAttrId === attr.id ? (
                      <div className="flex gap-2 my-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-blue-500 rounded text-sm font-semibold text-slate-900 focus:outline-none bg-blue-50/30"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(attr.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingAttrId(null)}
                          className="px-2 py-1.5 border border-slate-300 text-slate-600 rounded text-xs font-medium hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-900 font-semibold text-sm">
                        {attr.value}
                      </div>
                    )}

                    {/* Excerpt */}
                    <p className="text-xs italic text-slate-500 font-serif pl-2 border-l-2 border-slate-300 my-1">
                      {attr.excerpt}
                    </p>

                    {/* Confidence Meter */}
                    <div className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className={`h-full ${
                              attr.confidence > 95
                                ? 'bg-emerald-500'
                                : attr.confidence > 85
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${attr.confidence}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-slate-700 text-[11px]">{attr.confidence}%</span>
                      </div>

                      {/* Approve / Reject Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetStatus(attr.id, 'REJECTED')}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors ${
                            attr.status === 'REJECTED'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'border-slate-200 hover:bg-rose-50 text-slate-700 hover:text-rose-700'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => handleSetStatus(attr.id, 'APPROVED')}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors ${
                            attr.status === 'APPROVED'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'border-slate-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Collapsible Facilities Array Accordion */}
            {facilities && facilities.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-slate-900 text-sm">Credit Facilities ({facilities.length})</h3>
                </div>

                {facilities.map((fac) => {
                  const isOpen = !!openFacilities[fac.facilityName];

                  return (
                    <div key={fac.facilityName} className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleFacility(fac.facilityName)}
                        className="w-full bg-slate-100/80 hover:bg-slate-200/60 p-3.5 flex items-center justify-between text-left transition-colors border-b border-slate-200"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded bg-blue-600 text-white font-bold">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{fac.facilityName}</h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {fac.amount} • {fac.interestMargin} • Maturity {fac.maturityDate}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {fac.attributes.length} Sub-attributes
                          </span>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isOpen && (
                        <div className="p-4 space-y-3 bg-slate-50/50">
                          {fac.attributes.map((attr) => (
                            <div key={attr.id} className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <button
                                  onClick={() => handleJumpToPage(attr)}
                                  className="font-bold text-xs text-slate-900 hover:text-blue-600"
                                >
                                  {attr.label}
                                </button>
                                <button
                                  onClick={() => handleJumpToPage(attr)}
                                  className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                                >
                                  Page {attr.page} ↗
                                </button>
                              </div>

                              <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs font-semibold text-slate-900">
                                {attr.value}
                              </div>

                              <div className="flex justify-between items-center pt-1 text-xs">
                                <span className="text-[11px] font-bold text-emerald-600">{attr.confidence}% Confidence</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleSetStatus(attr.id, 'REJECTED')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                                      attr.status === 'REJECTED'
                                        ? 'bg-rose-600 text-white'
                                        : 'hover:bg-rose-50 text-slate-700'
                                    }`}
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => handleSetStatus(attr.id, 'APPROVED')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                                      attr.status === 'APPROVED'
                                        ? 'bg-emerald-600 text-white'
                                        : 'hover:bg-emerald-50 text-slate-700'
                                    }`}
                                  >
                                    Approve
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dropdown Filters for ProcessingArea, Department, Branch */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Deal Operational Details</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Processing Area</label>
                  <select
                    value={processingArea}
                    onChange={(e) => setProcessingArea(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="NY">NY</option>
                    <option value="BNG">BNG</option>
                    <option value="LDN">LDN</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Retail">Retail</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Branch</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="New York">New York</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="London">London</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sticky Toolbar */}
          <div className="p-4 bg-white border-t border-slate-200 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-extrabold uppercase text-slate-500 tracking-wider">
                STATUS OVERVIEW:
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-md">
                Approved: {approvedCount}
              </span>
              <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2.5 py-1 rounded-md">
                Rejected: {rejectedCount}
              </span>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2.5 py-1 rounded-md">
                Pending: {pendingCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetAll}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All
              </button>

              <button
                onClick={handleRejectAll}
                className="px-3.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject All
              </button>

              <button
                onClick={handleApproveAll}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
              >
                <CheckCheck className="w-4 h-4" /> Approve All
              </button>

              <button
                onClick={handleSignOffAndCreate}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing Off...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Sign Off and Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
