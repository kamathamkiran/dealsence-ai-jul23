import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  CloudUpload,
  FileText,
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  X,
  Loader2,
  FileCheck
} from 'lucide-react';
import { WorkflowStatusResponse } from '../types';

interface UploadScreenProps {
  onWorkflowComplete: (uuid: string, fileData: { name: string; size: string; pdfUrl?: string | null }) => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ onWorkflowComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sampleLoaded, setSampleLoaded] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Workflow tracking state
  const [workflowUuid, setWorkflowUuid] = useState<string | null>(null);
  const [currentStepInfo, setCurrentStepInfo] = useState<WorkflowStatusResponse | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setSelectedFile(file);
        setSampleLoaded(false);
        setUploadError(null);
      } else {
        setUploadError('Please select a valid PDF file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setSampleLoaded(false);
      setUploadError(null);
    }
  };

  const handleLoadSample = () => {
    setSelectedFile(null);
    setSampleLoaded(true);
    setUploadError(null);
  };

  const handleRemoveDocument = () => {
    if (pdfUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setSelectedFile(null);
    setSampleLoaded(false);
    setUploadError(null);
  };

  // 1. Submit Upload and initiate workflow
  const handleStartAnalysis = async () => {
    if (!selectedFile && !sampleLoaded) {
      setUploadError('Please select or load a PDF document first.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    // Generate uuid client-side
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `uuid-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const userName = 'ops.user1@dealsense.ai';

    try {
      const formData = new FormData();
      formData.append('uuid', uuid);
      formData.append('username', userName);

      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        // Sample file dummy blob
        const sampleBlob = new Blob(['Sample Credit Agreement Content'], { type: 'application/pdf' });
        formData.append('file', sampleBlob, 'ABC_Manufacturing_Credit_Agreement_2025.pdf');
      }

      // Try calling /workflow/upload (and fallback to origin if localhost fails)
      let uploadUrl = '/workflow/upload';
      if (window.location.hostname === 'localhost' && window.location.port === '3000') {
        uploadUrl = 'http://localhost:8080/workflow/upload';
      }

      let response: Response;
      try {
        response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });
      } catch (err) {
        // Fallback to relative endpoint if absolute port 8080 fails
        response = await fetch('/workflow/upload', {
          method: 'POST',
          body: formData,
        });
      }

      if (!response.ok) {
        setUploadError(`Upload failed with status ${response.status}`);
        setIsUploading(false);
        return;
      }

      //const uploadData: UploadResponse = await response.json();
      const activeUuid = uuid;
      setWorkflowUuid(activeUuid);

      if (pdfUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      pdfUrlRef.current = selectedFile ? URL.createObjectURL(selectedFile) : null;

      // Start status polling
      startPollingStatus(activeUuid);

    } catch (err: any) {
      console.error('Upload Error:', err);
      setUploadError(err.message || 'Failed to connect to workflow upload service.');
      setIsUploading(false);
    }
  };

  // 2. Poll /workflow/:uuid/status every 10 seconds
  const startPollingStatus = (uuid: string) => {
    // Status mapping: description, percentage, step count
    const statusMap: Record<string, { description: string; percentage: number; step: number }> = {
      'UPLOADING': {
        description: 'Uploading your credit agreement document to the secure processing engine...',
        percentage: 20,
        step: 1
      },
      'UPLOADING_COMPLETE': {
        description: 'File uploaded successfully. Beginning OCR and document analysis...',
        percentage: 25,
        step: 1
      },
      'PARSED': {
        description: 'AI is parsing the document structure and identifying key sections...',
        percentage: 40,
        step: 2
      },
      'EXTRACTED': {
        description: 'Intelligent agent is extracting credit terms, rates, covenants, and facility details...',
        percentage: 60,
        step: 3
      },
      'VALIDATED': {
        description: 'Validating extracted attributes against legal framework and data integrity rules...',
        percentage: 80,
        step: 4
      },
      'COMPLETED': {
        description: 'Processing complete! Your deal attributes are ready for human review and sign-off.',
        percentage: 100,
        step: 5
      },
      'HUMAN APPROVED': {
        description: 'Deal successfully approved and processed. Proceeding to review screen...',
        percentage: 100,
        step: 6
      }
    };

    const fetchStatus = async () => {
      try {
        let statusUrl = `/workflow/${uuid}/status`;
        if (window.location.hostname === 'localhost' && window.location.port === '3000') {
          statusUrl = `http://localhost:8081/api/workflow/${uuid}/status`;
        }

        let res: Response;
        try {
          res = await fetch(statusUrl);
        } catch {
          res = await fetch(`/workflow/${uuid}/status`);
        }

        if (res.ok) {
          const rawStatus = await res.json() as {
            uuid?: string;
            status?: string;
            data?: {
              workflowId?: string;
              status?: string;
              username?: string;
              updatedAt?: string;
            };
            userName?: string;
            updatedAt?: string;
          };

          // Extract actual status from API (handle both nested and flat responses)
          const actualStatus = (rawStatus.data?.status || rawStatus.status || 'UPLOADING') as string;
          const statusInfo = statusMap[actualStatus] || {
            description: 'Processing workflow...',
            percentage: 50,
            step: 2
          };

          const displayStatus: WorkflowStatusResponse = {
            uuid: rawStatus.uuid || rawStatus.data?.workflowId || uuid,
            status: (actualStatus as any) || 'PROCESSING',
            step: statusInfo.step,
            totalSteps: 6,
            message: statusInfo.description,
            percentage: statusInfo.percentage,
            userName: rawStatus.userName || rawStatus.data?.username,
            updatedAt: rawStatus.updatedAt || rawStatus.data?.updatedAt,
          };

          setCurrentStepInfo(displayStatus);

          // Proceed when workflow reaches terminal state
          if (actualStatus === 'COMPLETED' || actualStatus === 'HUMAN_REVIEW_PENDING') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setTimeout(() => {
              onWorkflowComplete(uuid, {
                name: selectedFile ? selectedFile.name : 'ABC_Manufacturing_Credit_Agreement_2025.pdf',
                size: selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : '3.32 MB',
                pdfUrl: pdfUrlRef.current
              });
            }, 800);
          }
        }
      } catch (e) {
        console.error('Error fetching workflow status:', e);
      }
    };

    // Initial fetch immediately
    fetchStatus();

    // Set 10-second polling interval
    pollTimerRef.current = setInterval(fetchStatus, 10000);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const fileName = selectedFile
      ? selectedFile.name
      : sampleLoaded
          ? 'ABC_Manufacturing_Credit_Agreement_2025.pdf'
          : null;

  const fileSize = selectedFile
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
      : sampleLoaded
          ? '3.32 MB'
          : null;

  return (
      <div className="min-h-[calc(100vh-57px)] bg-[#f8fafc] grid-background flex flex-col justify-between p-6 md:p-10">
        <div className="max-w-3xl mx-auto w-full space-y-6 my-auto">
          {/* Top Badge */}
          <div className="text-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Build IQ • Intelligent Extraction Engine
          </span>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
            {!isUploading ? (
                <>
                  {/* Drag & Drop Area */}
                  <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                          isDragging
                              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                              : 'border-blue-300 hover:border-blue-500 hover:bg-slate-50/60'
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,application/pdf"
                        className="hidden"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                      <Upload className="w-8 h-8" />
                    </div>

                    <h3 className="text-lg font-bold text-slate-800">
                      Drag & Drop your document here
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Supports PDF documents up to 50MB
                    </p>

                    <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white border border-sky-200 text-sky-700 font-semibold text-xs shadow-lg shadow-sky-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-50 hover:shadow-xl hover:shadow-sky-200/70 active:translate-y-0 active:scale-98"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
                        <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                      </span>
                      <span className="tracking-wide">Browse Files</span>
                    </button>
                  </div>

                  {/* Selected Document Box */}
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                    SELECTED DOCUMENT
                  </span>
                      {fileName && (
                          <button
                              onClick={handleRemoveDocument}
                              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Remove Document
                          </button>
                      )}
                    </div>

                    {fileName ? (
                        <div className="bg-white rounded-lg p-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm">{fileName}</span>
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            READY
                          </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {fileSize} • 20 Pages • Syndicated Term Loan
                              </p>
                            </div>
                          </div>

                          <button
                              onClick={handleRemoveDocument}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                    ) : (
                        <div className="text-center py-4 border border-dashed border-slate-200 rounded-lg bg-white">
                          <p className="text-xs text-slate-500 mb-2">No document selected</p>
                          <button
                              type="button"
                              onClick={handleLoadSample}
                              className="px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <FileCheck className="w-4 h-4" />
                            Load Credit Agreement
                          </button>
                        </div>
                    )}
                  </div>

                  {uploadError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                        {uploadError}
                      </div>
                  )}

                  {/* Analyze Button */}
                  <button
                      type="button"
                      onClick={handleStartAnalysis}
                      disabled={!fileName}
                      className={`w-full py-3.5 px-6 rounded-xl text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                          fileName
                              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-blue-600/20'
                              : 'bg-slate-300 cursor-not-allowed text-slate-500'
                      }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Analyze and Retrieve Deal Attributes →
                  </button>

                  {/* Security Footer */}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    Bank-grade 256-bit SSL encryption. All extraction data stays strictly confidential.
                  </div>
                </>
            ) : (
                /* Loading Screen with Step Progress */
                <div className="space-y-6 py-4">
                  {/* File details card */}
                  <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{fileName}</span>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        READY
                      </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fileSize} • 20 Pages • Syndicated Term Loan
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Loading progress box */}
                  <div className="bg-blue-50/60 rounded-xl p-6 border border-blue-200/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span className="font-semibold text-slate-800 text-sm">
                      {currentStepInfo?.message || 'Initiating intelligent PDF processing...'}
                    </span>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200">
                    Step {currentStepInfo?.step || 1} of {currentStepInfo?.totalSteps || 6}
                  </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden border border-slate-300">
                      <div
                          className="bg-blue-600 h-full transition-all duration-700 ease-out"
                          style={{ width: `${currentStepInfo?.percentage || 15}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>Polling status every 10 seconds via <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">/workflow/{workflowUuid?.substring(0, 8)}/status</code></span>
                      <span className="font-semibold text-blue-600">
                    {currentStepInfo?.status === 'HUMAN APPROVED' ? '✓ HUMAN APPROVED' : `${currentStepInfo?.percentage || 15}% Complete`}
                  </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    Bank-grade 256-bit SSL encryption. All extraction data stays strictly confidential.
                  </div>
                </div>
            )}
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs">Precision Extraction</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automated parsing of complex credit facilities, covenants, and rates.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs">Highlight Sync</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any attribute card to instantly highlight and scroll to its PDF source.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs">Institutional Audit</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  One-click bulk approval, audit logging, and exportable deal memos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};