import { Search, Plus, LogOut } from 'lucide-react';
import { GalaxyCanvas } from '@/components/GalaxyCanvas';
import { OnboardingModal } from '@/components/OnboardingModal';
import { CaptureModal } from '@/components/CaptureModal';
import { NodeDetailPanel } from '@/components/NodeDetailPanel';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const gameState = useGalaxyStore(s => s.gameState);
  const searchQuery = useGalaxyStore(s => s.searchQuery);
  const searchResults = useGalaxyStore(s => s.searchResults);
  const handleSearch = useGalaxyStore(s => s.handleSearch);
  const isAddingCapture = useGalaxyStore(s => s.isAddingCapture);
  const openCaptureModal = useGalaxyStore(s => s.openCaptureModal);
  const nodes = useGalaxyStore(s => s.nodes);
  const { signOut } = useAuth();

  if (gameState === 'onboarding') {
    return <OnboardingModal />;
  }

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <GalaxyCanvas />

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
          <div>
            <h1 className="text-xl font-display text-primary tracking-widest drop-shadow-lg">SYNAPSE</h1>
            <p className="text-xs text-muted-foreground mt-1">뉴런 네트워크 탐사</p>
          </div>
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="로그아웃"
          >
            <LogOut size={18} />
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

          {searchQuery && searchResults.length === 0 && (
            <div className="absolute top-12 left-0 w-full bg-card/90 backdrop-blur border border-border rounded-lg p-3 text-xs text-muted-foreground">
              관련된 노드가 없습니다.<br />
              대신{' '}
              <span className="text-secondary cursor-pointer hover:underline">
                #{nodes.filter(n => n.type === 'keyword')[0]?.title}
              </span>{' '}
              영역을 개척해보는 건 어떨까요?
            </div>
          )}
        </div>
      </header>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-card/60 backdrop-blur p-4 rounded-lg border border-border text-xs text-muted-foreground space-y-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_hsl(187,80%,48%)]" /> 나 (Center)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_hsl(292,84%,61%)]" /> 관심사 (Keyword)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-synapse-indigo shadow-[0_0_8px_hsl(239,84%,67%)]" /> AI 생성 (Detailed)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_4px_hsl(160,84%,39%)]" /> 데이터 (Capture)
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openCaptureModal}
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
