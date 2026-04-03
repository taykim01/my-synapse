import { Search, Plus } from 'lucide-react';
import { GalaxyCanvas } from '@/components/GalaxyCanvas';
import { OnboardingModal } from '@/components/OnboardingModal';
import { CaptureModal } from '@/components/CaptureModal';
import { NodeDetailPanel } from '@/components/NodeDetailPanel';
import { useGalaxyStore } from '@/stores/galaxyStore';

const Index = () => {
  const gameState = useGalaxyStore(s => s.gameState);
  const searchQuery = useGalaxyStore(s => s.searchQuery);
  const searchResults = useGalaxyStore(s => s.searchResults);
  const handleSearch = useGalaxyStore(s => s.handleSearch);
  const isAddingCapture = useGalaxyStore(s => s.isAddingCapture);
  const openCaptureModal = useGalaxyStore(s => s.openCaptureModal);
  const nodes = useGalaxyStore(s => s.nodes);

  if (gameState === 'onboarding') {
    return <OnboardingModal />;
  }

  return (
    <div className="relative w-full h-screen bg-[#05050A] overflow-hidden">
      <GalaxyCanvas />

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-xl font-serif text-white tracking-widest drop-shadow-lg">MY GALAXY</h1>
          <p className="text-xs text-gray-400 mt-1">정보 탐사 및 확장</p>
        </div>

        {/* Search */}
        <div className="pointer-events-auto relative">
          <input
            type="text"
            placeholder="별(캡처) 또는 별자리 검색..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-64 bg-black/40 backdrop-blur border border-white/20 rounded-full px-4 py-2 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          {searchQuery && searchResults.length === 0 && (
            <div className="absolute top-12 left-0 w-full bg-black/80 backdrop-blur border border-white/10 rounded-lg p-3 text-xs text-gray-300">
              관련된 노드가 없습니다.<br />
              대신{' '}
              <span className="text-blue-400 cursor-pointer hover:underline">
                #{nodes.filter(n => n.type === 'keyword')[0]?.title}
              </span>{' '}
              영역을 개척해보는 건 어떨까요?
            </div>
          )}
        </div>
      </header>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-black/40 backdrop-blur p-4 rounded-lg border border-white/10 text-xs text-gray-300 space-y-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" /> 자아 (Center)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]" /> 주요 관심사 (Keyword)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#8b5cf6]" /> AI 자동 분류 (Detailed)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_#fff]" /> 기록 (Capture)
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openCaptureModal}
        className="absolute bottom-10 right-10 z-10 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform"
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
