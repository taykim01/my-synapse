import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, LogOut, HelpCircle } from 'lucide-react';
import { SynapseCanvas } from '@/components/SynapseCanvas';
import { CaptureModal } from '@/components/CaptureModal';
import { NodeDetailPanel } from '@/components/NodeDetailPanel';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { useAuth } from '@/hooks/useAuth';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { SynapseLogo } from '@/components/SynapseLogo';

const Index = () => {
  const navigate = useNavigate();
  const gameState = useGalaxyStore(s => s.gameState);
  const searchQuery = useGalaxyStore(s => s.searchQuery);
  const searchResults = useGalaxyStore(s => s.searchResults);
  const handleSearch = useGalaxyStore(s => s.handleSearch);
  const isAddingCapture = useGalaxyStore(s => s.isAddingCapture);
  const openCaptureModal = useGalaxyStore(s => s.openCaptureModal);
  const nodes = useGalaxyStore(s => s.nodes);
  const initFromDB = useGalaxyStore(s => s.initFromDB);
  const { signOut, user } = useAuth();
  const [showTutorial, setShowTutorial] = useState(!localStorage.getItem('synapse_tutorial_seen'));

  useEffect(() => {
    if (user) initFromDB();
  }, [user]);

  useEffect(() => {
    if (gameState === 'onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [gameState, navigate]);

  if (gameState === 'loading' || gameState === 'onboarding') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">네트워크 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden" style={{ overflow: 'hidden' }}>
      <SynapseCanvas />

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
          <SynapseLogo size="sm" />
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="튜토리얼"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="pointer-events-auto relative">
          <input
            type="text"
            placeholder="노드 또는 키워드 검색..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-64 bg-card/60 backdrop-blur border border-border rounded-full px-4 py-2 pl-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />

          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-12 left-0 w-full bg-card/90 backdrop-blur border border-border rounded-lg p-2 max-h-64 overflow-y-auto space-y-1">
              {searchResults.map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    useGalaxyStore.getState().setSelectedNode(r);
                    handleSearch('');
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.type === 'keyword' ? '관심사' : r.type === 'detailed_keyword' ? '세부 키워드' : r.content_type}
                    </p>
                  </div>
                  {r.similarity !== undefined && (
                    <span className="text-[10px] text-accent ml-2 shrink-0 font-mono">
                      {(r.similarity * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="absolute top-12 left-0 w-full bg-card/90 backdrop-blur border border-border rounded-lg p-3 text-xs text-muted-foreground">
              관련된 노드가 없습니다.
            </div>
          )}
        </div>
      </header>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-card/60 backdrop-blur p-4 rounded-lg border border-border text-xs text-muted-foreground space-y-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_hsl(187,80%,48%)]" /> 나
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_hsl(292,84%,61%)]" /> 관심사
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-synapse-indigo shadow-[0_0_8px_hsl(239,84%,67%)]" /> 세부 키워드
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_4px_hsl(160,84%,39%)]" /> 캡처
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => { (window as any).gtag?.('event', 'click_new_capture'); openCaptureModal(); }}
        className="absolute bottom-10 right-10 z-10 w-14 h-14 bg-accent text-accent-foreground rounded-full flex items-center justify-center shadow-[0_0_20px_hsl(160,84%,39%,0.4)] hover:scale-105 transition-transform"
      >
        <Plus size={24} />
      </button>

      {/* Detail Panel */}
      <NodeDetailPanel />

      {/* Capture Modal */}
      {isAddingCapture && <CaptureModal />}
    </div>
  );
};

export default Index;
