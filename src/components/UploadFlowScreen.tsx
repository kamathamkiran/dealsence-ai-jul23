import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../api';
import { WorkflowStatusResponse } from '../types';

interface UploadScreenProps {
  onWorkflowComplete: (uuid: string, fileData: { name: string; size: string; pdfUrl?: string | null }) => void;
}

const workflowStages = [
  'Uploading',
  'Parsing',
  'Extracting',
  'Validating',
  'Reviewing',
];

const eventProgress: Record<string, { started: { label: string; percent: number }; success: { label: string; percent: number } }> = {
  UPLOAD: {
    started: { label: 'Uploading', percent: 8 },
    success: { label: 'Uploaded', percent: 16 },
  },
  DOCUMENT_PARSER: {
    started: { label: 'Parsing', percent: 24 },
    success: { label: 'Parsed', percent: 32 },
  },
  EXTRACTION: {
    started: { label: 'Extracting', percent: 40 },
    success: { label: 'Extracted', percent: 48 },
  },
  VALIDATION: {
    started: { label: 'Validating', percent: 56 },
    success: { label: 'Validated', percent: 64 },
  },
  REVIEW: {
    started: { label: 'Reviewing', percent: 72 },
    success: { label: 'Reviewed', percent: 80 },
  },
  HUMAN_REVIEW: {
    started: { label: 'Reviewing', percent: 90 },
    success: { label: 'Complete', percent: 100 },
  },
};

const workflowProgress: Record<string, { label: string; percent: number }> = {
  UPLOADED: { label: 'Uploaded', percent: 16 },
  PARSED: { label: 'Parsed', percent: 32 },
  EXTRACTED: { label: 'Extracted', percent: 48 },
  VALIDATED: { label: 'Validated', percent: 64 },
  REVIEWED: { label: 'Reviewed', percent: 80 },
  HUMAN_REVIEW_PENDING: { label: 'Reviewing', percent: 90 },
  HUMAN_REVIEW_COMPLETED: { label: 'Complete', percent: 100 },
  DEAL_CREATED: { label: 'Complete', percent: 100 },
};

export const UploadScreen: React.FC<UploadScreenProps> = ({ onWorkflowComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [workflowUuid, setWorkflowUuid] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatusResponse | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (file: File) => {
    if ((file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) || file.size > 50 * 1024 * 1024) {
      setUploadError('Select a PDF file up to 50MB.');
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      setUploadError('Please select a PDF document first.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setWorkflowStatus(null);
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `workflow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const formData = new FormData();
    formData.append('uuid', uuid);
    formData.append('username', 'ops.user1@dealsense.ai');
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/workflow/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error((await response.text()) || `Upload failed with status ${response.status}`);
      }

      setWorkflowUuid(uuid);
      if (pdfUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = URL.createObjectURL(selectedFile);

      const fetchStatus = async () => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/workflow/${encodeURIComponent(uuid)}/status`);
          if (statusResponse.status === 404) return;
          if (!statusResponse.ok) throw new Error(`Status request failed with status ${statusResponse.status}`);

          const status = await statusResponse.json() as WorkflowStatusResponse;
          setWorkflowStatus(status);

          if (status.status === 'FAILED' || status.eventStatus === 'FAILED') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            const reason = status.eventFailureReason || status.failureReason;
            setUploadError(reason ? `Processing failed: ${reason}` : 'Processing failed.');
          } else {
            setUploadError(null);
          }

          if (status.status !== 'FAILED' && status.eventStatus !== 'FAILED'
              && (status.status === 'HUMAN_REVIEW_PENDING' || status.status === 'DEAL_CREATED')) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            onWorkflowComplete(uuid, {
              name: selectedFile.name,
              size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
              pdfUrl: pdfUrlRef.current,
            });
          }
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : 'Unable to read backend workflow status.');
        }
      };

      pollTimerRef.current = window.setInterval(fetchStatus, 3000);
      void fetchStatus();
    } catch (error) {
      setIsUploading(false);
      setUploadError(error instanceof Error ? error.message : 'Failed to connect to the workflow service.');
    }
  };

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const fileSize = selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : null;
  const eventStage = workflowStatus?.currentAgent && workflowStatus.eventStatus
    ? eventProgress[workflowStatus.currentAgent]?.[
      workflowStatus.eventStatus === 'STARTED' ? 'started' : 'success'
    ]
    : undefined;
  const statusStage = workflowStatus ? workflowProgress[workflowStatus.status] : undefined;
  const currentStageLabel = workflowStatus?.eventStatus === 'FAILED'
    ? 'Processing failed'
    : eventStage?.label ?? statusStage?.label ?? 'Waiting for workflow';
  const progressPercent = eventStage?.percent ?? statusStage?.percent ?? 0;

  return (
    <div className="min-h-[calc(100vh-57px)] bg-[#f8fafc] grid-background flex flex-col justify-between p-6 md:p-10">
      <div className="max-w-3xl mx-auto w-full space-y-6 my-auto">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Build IQ • Intelligent Extraction Engine
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
          {!isUploading ? (
            <>
              <div
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (event.dataTransfer.files[0]) acceptFile(event.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-blue-300 hover:border-blue-500 hover:bg-slate-50/60'}`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(event) => {
                    if (event.target.files?.[0]) acceptFile(event.target.files[0]);
                    event.target.value = '';
                  }}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Drag & Drop your document here</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">Supports PDF documents up to 50MB</p>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}
                  className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white border border-sky-200 text-sky-700 font-semibold text-xs shadow-lg shadow-sky-200/60 transition-all duration-300 hover:bg-sky-50"
                >
                  <CloudUpload className="w-4 h-4" />
                  Browse Files
                </button>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Selected document</span>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); setUploadError(null); }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Remove document
                    </button>
                  )}
                </div>
                {selectedFile ? (
                  <div className="bg-white rounded-lg p-3.5 border border-slate-200 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{fileSize}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 border border-dashed border-slate-200 rounded-lg bg-white">
                    <p className="text-xs text-slate-500">No PDF selected</p>
                  </div>
                )}
              </div>

              {uploadError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">{uploadError}</div>}

              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={!selectedFile}
                className={`w-full py-3.5 px-6 rounded-xl text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${selectedFile ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed text-slate-500'}`}
              >
                <Sparkles className="w-4 h-4" />
                Analyze and Retrieve Deal Attributes
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                Bank-grade 256-bit SSL encryption. All extraction data stays strictly confidential.
              </div>
            </>
          ) : (
            <div className="space-y-6 py-4">
              <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200 flex items-center gap-3">
                <FileText className="w-5 h-5 text-rose-600" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{fileSize}</p>
                </div>
              </div>

              <div className="bg-blue-50/60 rounded-xl p-6 border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-slate-800 text-sm">
                    {currentStageLabel}
                  </p>
                  <span className="text-xs font-bold text-blue-700">{progressPercent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Backend workflow progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  className="h-2.5 w-full overflow-hidden rounded-full border border-blue-200 bg-white"
                >
                  <div
                    className="h-full bg-blue-600 transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {workflowStatus?.updatedAt && <p className="text-xs text-slate-500">Last updated: {new Date(workflowStatus.updatedAt).toLocaleString()}</p>}
                {uploadError && <p className="text-xs text-rose-700">{uploadError}</p>}
                <p className="text-xs text-slate-500">Workflow ID: {workflowUuid}</p>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                Bank-grade 256-bit SSL encryption. All extraction data stays strictly confidential.
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Zap className="w-5 h-5" /></div>
            <div><h4 className="font-bold text-slate-800 text-xs">Precision Extraction</h4><p className="text-[11px] text-slate-500 mt-0.5">Automated parsing of complex credit facilities, covenants, and rates.</p></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
            <div><h4 className="font-bold text-slate-800 text-xs">Highlight Sync</h4><p className="text-[11px] text-slate-500 mt-0.5">Jump from extracted attributes to their PDF source.</p></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><ShieldCheck className="w-5 h-5" /></div>
            <div><h4 className="font-bold text-slate-800 text-xs">Human Validation</h4><p className="text-[11px] text-slate-500 mt-0.5">Review extracted terms before sign-off.</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};