import { motion, AnimatePresence } from 'framer-motion';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { X, Star, Hash } from 'lucide-react';

export function NodeDetailPanel() {
  const selectedNode = useGalaxyStore(s => s.selectedNode);
  const selectNode = useGalaxyStore(s => s.selectNode);

  if (!selectedNode || selectedNode.type === 'center') return null;

  return (
    <AnimatePresence>
      <motion.div
        key={selectedNode.id}
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed top-4 right-4 bottom-4 w-80 z-40 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-6 overflow-y-auto"
      >
        <button
          onClick={() => selectNode(null)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedNode.color }}
          />
          <span className="text-xs text-muted-foreground font-body uppercase tracking-wider">
            {selectedNode.type === 'keyword' ? '키워드' : selectedNode.type === 'capture' ? '캡처' : '상세 키워드'}
          </span>
        </div>

        <h2 className="font-display text-xl font-bold text-foreground mb-4">
          {selectedNode.label}
        </h2>

        {selectedNode.type === 'capture' && (
          <>
            {selectedNode.body && (
              <p className="text-sm text-secondary-foreground font-body leading-relaxed mb-4">
                {selectedNode.body}
              </p>
            )}
            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-body"
                  >
                    <Hash size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {selectedNode.type === 'keyword' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
            <Star size={14} className="text-star-warm" />
            <span>{selectedNode.captureCount || 0}개의 별이 연결됨</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
