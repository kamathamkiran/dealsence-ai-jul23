import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  FileCode,
  Sparkles,
  Building,
  Calendar,
  FileText,
  Search,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { CreatedDealRecord } from '../types';
import { DEFAULT_DEAL_NAME, DEFAULT_AGREEMENT_DATE, DEFAULT_TOTAL_AMOUNT, ACTUAL_DEAL_1_EXTRACTION_DATA } from '../data/actualDeal_1';

interface ApiDealRecord {
  dealId: string;
  dealName: string;
  agreementDate: string;
  branch: string;
  classification: string;
  currency: string;
  departmentId: string;
  expenseCode: string;
  globalDealProposedCommitmentAmount: number;
  processingAreaCode: string;
}

interface FinalScreenProps {
  dealResponse: any;
  currentFileName?: string;
  onNavigateUpload: () => void;
  onNavigateReview: () => void;
}

export const FinalScreen: React.FC<FinalScreenProps> = ({
  dealResponse,
  currentFileName,
  onNavigateUpload,
  onNavigateReview,
}) => {
  const [dealsList, setDealsList] = useState<ApiDealRecord[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState<boolean>(true);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentDeal: CreatedDealRecord = dealResponse?.deal || {
    dealId: dealResponse?.dealId || `DEAL-${new Date().getFullYear()}-0001`,
    uuid: 'actual-deal-1-uuid-001',
    borrowerName: ACTUAL_DEAL_1_EXTRACTION_DATA.borrowerName,
    dealName: DEFAULT_DEAL_NAME,
    fileName: currentFileName || dealResponse?.fileName || ACTUAL_DEAL_1_EXTRACTION_DATA.fileName,
    effectiveDate: DEFAULT_AGREEMENT_DATE,
    totalAmount: DEFAULT_TOTAL_AMOUNT,
    createdAt: dealResponse?.timestamp || new Date().toLocaleString(),
    totalFields: ACTUAL_DEAL_1_EXTRACTION_DATA.attributes.length + (ACTUAL_DEAL_1_EXTRACTION_DATA.facilities?.flatMap(f => f.attributes).length ?? 0),
    approvedFields: 0,
    rejectedFields: 0,
    pendingFields: ACTUAL_DEAL_1_EXTRACTION_DATA.attributes.length + (ACTUAL_DEAL_1_EXTRACTION_DATA.facilities?.flatMap(f => f.attributes).length ?? 0),
    status: 'SIGNED_OFF',
    attributes: Object.fromEntries(
      ACTUAL_DEAL_1_EXTRACTION_DATA.attributes.map(a => [a.label, a.value])
    ),
  };

  // Fetch all deals on page load via GET /workflow/deals
  useEffect(() => {
    const fetchAllDeals = async () => {
      setIsLoadingDeals(true);
      try {
        const apiUrl = 'http://localhost:8081/api/deals/all';
        console.log('Fetching all deals from:', apiUrl);

        const res = await fetch(apiUrl);
        console.log('Deals API response status:', res.status);

        if (res.ok) {
          const json = await res.json();
          console.log('Deals API response:', json);
          const records: ApiDealRecord[] = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          setDealsList(records);
        } else {
          console.warn('Deals API returned non-OK status, setting empty list');
          setDealsList([]);
        }
      } catch (e) {
        console.error('Error fetching deals list from localhost:8081/api/deals/all:', e);
        setDealsList([]);
      } finally {
        setIsLoadingDeals(false);
      }
    };

    fetchAllDeals();
  }, []);

  const handleCopySummary = () => {
    const text = `DEAL CREATION SUMMARY
Deal ID: ${currentDeal.dealId}
Borrower: ${currentDeal.borrowerName}
Deal Name: ${currentDeal.dealName}
File: ${currentDeal.fileName}
Effective Date: ${currentDeal.effectiveDate}
Status: ${currentDeal.status}
Signed Off: ${currentDeal.createdAt}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleExportCsv = () => {
    const rows = [
      ['Attribute', 'Value'],
      ...Object.entries(currentDeal.attributes || {})
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentDeal.dealId}_deal_memo.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(currentDeal, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDeal.dealId}_attributes.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDeals = dealsList.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (
      d.dealId?.toLowerCase().includes(q) ||
      d.dealName?.toLowerCase().includes(q) ||
      d.branch?.toLowerCase().includes(q) ||
      d.classification?.toLowerCase().includes(q) ||
      d.currency?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-[calc(100vh-57px)] bg-[#f8fafc] grid-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Deal Creation Confirmation Banner Card */}
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xl p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Deal Creation Successful • {currentDeal.dealId}
              </span>

              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Deal creation done successfully!
              </h1>

              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                All deal attributes have been parsed, validated, and recorded. The structured credit agreement
                metadata is now ready for risk analysis, loan syndication, and compliance tracking.
              </p>

              {/* Tag Badges */}
{/*              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-800 font-semibold">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  Borrower: <span className="font-bold">{currentDeal.borrowerName}</span>
                </div>
                <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-800 font-semibold">
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  File: <span className="font-bold">{currentDeal.fileName}</span>
                </div>
                <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-800 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  Effective Date: <span className="font-bold">{currentDeal.effectiveDate}</span>
                </div>
              </div>*/}
            </div>

            {/* Stats Matrix */}
            <div className="grid grid-cols-2 gap-3 w-full lg:w-auto min-w-[260px]">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Fields</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{currentDeal.totalFields}</div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{currentDeal.approvedFields}</div>
              </div>

              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-center">
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected</div>
                <div className="text-2xl font-black text-rose-700 mt-1">{currentDeal.rejectedFields}</div>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{currentDeal.pendingFields}</div>
              </div>
            </div>
          </div>

          {/* Verification Audit & Action Buttons Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified and signed off on <strong className="text-slate-900">{currentDeal.createdAt}</strong></span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopySummary}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedSummary ? 'Copied!' : 'Copy Text Summary'}
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export CSV
              </button>

              <button
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <FileCode className="w-3.5 h-3.5" />
                Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* All Deals Pipeline List Section (Fetched via GET /workflow/deals) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                Processed Credit Deals History
                <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                  ({dealsList.length})
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time deals fetched from the workflow pipeline backend API.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals or IDs..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {isLoadingDeals ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs">Fetching all deals</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Deal ID</th>
                    <th className="px-4 py-3">Deal Name</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Agreement Date</th>
                    <th className="px-4 py-3">Dept ID</th>
                    <th className="px-4 py-3">Expense Code</th>
                    <th className="px-4 py-3">Processing Area</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium bg-white">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-xs">No deals found.</td>
                    </tr>
                  ) : filteredDeals.map((deal) => (
                    <tr key={deal.dealId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-blue-600 font-mono whitespace-nowrap">
                        {deal.dealId}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                        {deal.dealName}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                        {deal.globalDealProposedCommitmentAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-mono font-bold">
                        {deal.currency}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {deal.branch}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                          {deal.classification?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {deal.agreementDate}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {deal.departmentId}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {deal.expenseCode}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {deal.processingAreaCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
