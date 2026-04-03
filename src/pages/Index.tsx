import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { StarField } from '@/components/StarField';
import { GalaxyCanvas } from '@/components/GalaxyCanvas';
import { OnboardingModal } from '@/components/OnboardingModal';
import { CaptureModal } from '@/components/CaptureModal';
import { NodeDetailPanel } from '@/components/NodeDetailPanel';
import { useGalaxyStore } from '@/stores/galaxyStore';

const Index = () => {
  const isOnboarded = useGalaxyStore(s => s.isOnboarded);
  const captureModalOpen = useGalaxyStore(s => s.captureModalOpen);
  const openCaptureModal = useGalaxyStore(s => s.openCaptureModal);
  const nodes = useGalaxyStore(s => s.nodes);
  const captureCount = nodes.filter(n => n.type === 'capture').length;

  return (
    <div className="relative w-screen h-screen bg-void overflow-hidden">
      <StarField />

      {!isOnboarded ? (
        <OnboardingModal />
      ) : (
        <>
          {/* Header */}
          <div className="absolute top-6 left-6 z-30">
            <h1 className="font-display text-lg font-bold text-gradient-nebula">
              나의 은하
            </h1>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              {captureCount}개의 별 · {nodes.filter(n => n.type === 'keyword').length}개의 별자리
            </p>
          </div>

          {/* Canvas */}
          <GalaxyCanvas />

          {/* Capture button */}
          <button
            onClick={openCaptureModal}
            className="fixed bottom-8 right-8 z-30 w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 glow-primary"
            style={{
              background: 'linear-gradient(135deg, hsl(260,60%,55%), hsl(200,70%,50%))',
            }}
          >
            <Plus size={24} className="text-primary-foreground" />
          </button>

          {/* Detail Panel */}
          <NodeDetailPanel />

          {/* Capture Modal */}
          <AnimatePresence>
            {captureModalOpen && <CaptureModal />}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default Index;
