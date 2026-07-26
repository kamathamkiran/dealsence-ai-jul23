import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { UploadScreen } from './components/UploadScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { FinalScreen } from './components/FinalScreen';
import { LoginScreen } from './components/LoginScreen.tsx';
import { ACTUAL_DEAL_1_EXTRACTION_DATA } from './data/actualDeal_1';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'review' | 'final'>('upload');
  const [workflowUuid, setWorkflowUuid] = useState<string>('actual-deal-1-uuid-001');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string }>({
    name: '',
    size: 'N/A'
  });
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [createDealResponse, setCreateDealResponse] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (uploadedPdfUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedPdfUrl);
      }
    };
  }, [uploadedPdfUrl]);

  const handleWorkflowComplete = (uuid: string, info: { name: string; size: string; pdfUrl?: string | null }) => {
    setWorkflowUuid(uuid);
    setFileInfo(info);
    setUploadedPdfUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return info.pdfUrl ?? null;
    });
    setCurrentScreen('review');
  };

  const handleSignOffComplete = (dealResponse: any) => {
    setCreateDealResponse(dealResponse);
    setCurrentScreen('final');
  };

  const handleLogin = (username: string, password: string) => {
    const normalizedUser = username.trim();
   // if (normalizedUser === 'admin' && password === 'admin123') {
    if(true){
      setIsAuthenticated(true);
      setLoginError(null);
      setCurrentScreen('upload');
      return;
    }
    setLoginError('Invalid credentials. Use username: admin and password: admin123');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased">
      {!isAuthenticated ? (
        <LoginScreen onLogin={handleLogin} error={loginError} />
      ) : (
        <>
          {/* Navigation Header */}
          <Header
            currentScreen={currentScreen}
            fileName={fileInfo.name}
            borrowerName={ACTUAL_DEAL_1_EXTRACTION_DATA.borrowerName}
            pageCount={ACTUAL_DEAL_1_EXTRACTION_DATA.pageCount}
            onNavigateUpload={() => setCurrentScreen('upload')}
            onNavigateReview={() => setCurrentScreen('review')}
          />

          {/* Screen Views */}
          <main className="flex-1 overflow-hidden">
            {currentScreen === 'upload' && (
              <UploadScreen onWorkflowComplete={handleWorkflowComplete} />
            )}

            {currentScreen === 'review' && (
              <ReviewScreen
                uuid={workflowUuid}
                pdfUrl={uploadedPdfUrl}
                fileName={fileInfo.name}
                onSignOffComplete={handleSignOffComplete}
              />
            )}

            {currentScreen === 'final' && (
              <FinalScreen
                dealResponse={createDealResponse}
                currentFileName={fileInfo.name}
                onNavigateUpload={() => setCurrentScreen('upload')}
                onNavigateReview={() => setCurrentScreen('review')}
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}
