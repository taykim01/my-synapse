import { useGalaxyStore } from '@/stores/galaxyStore';
import { X } from 'lucide-react';

export function NodeDetailPanel() {
  const selectedNode = useGalaxyStore(s => s.selectedNode);
  const activeNode = useGalaxyStore(s => s.activeNode);
  const setSelectedNode = useGalaxyStore(s => s.setSelectedNode);
  const getConnectedCaptures = useGalaxyStore(s => s.getConnectedCaptures);

  const displayNode = activeNode;

  return (
    <div
      className={`absolute top-4 right-4 bottom-4 w-80 md:w-96 z-40 bg-card/95 backdrop-blur-xl border border-border shadow-2xl p-6 flex flex-col rounded-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selectedNode ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-display text-foreground pr-4">{displayNode?.title}</h2>
        <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground shrink-0">
          <X size={20} />
        </button>
      </div>

      {displayNode?.type === 'capture' && (
        <>
          {displayNode.content_type && (
            <div className="mb-3">
              <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded">
                {displayNode.content_type}
              </span>
              {displayNode.source && (
                <span className="text-[10px] text-muted-foreground ml-2">출처: {displayNode.source}</span>
              )}
            </div>
          )}

          {displayNode.content_url && (
            <a
              href={displayNode.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mb-3 block truncate"
            >
              {displayNode.content_url}
            </a>
          )}

          {displayNode.description && (
            <div className="flex-1 overflow-y-auto mb-6">
              <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed bg-muted/50 p-4 rounded-xl border border-border">
                {displayNode.description}
              </p>
            </div>
          )}

          {displayNode.tags && displayNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-border">
              {displayNode.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-synapse-indigo/20 text-synapse-indigo border border-synapse-indigo/30 px-3 py-1.5 rounded-full text-xs shadow-[0_0_8px_hsl(239,84%,67%,0.3)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {displayNode?.type === 'keyword' && (
        <div className="flex-1 overflow-y-auto mb-6 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider">연결된 캡처 목록</h3>
          {getConnectedCaptures(displayNode.id).length > 0 ? (
            getConnectedCaptures(displayNode.id).map(capture => (
              <div
                key={capture.id}
                className="bg-muted/50 p-4 rounded-xl border border-border hover:bg-muted hover:border-secondary/50 cursor-pointer transition-all group"
                onClick={() => setSelectedNode(capture)}
              >
                <h4 className="text-foreground text-sm font-medium group-hover:text-secondary transition-colors">{capture.title}</h4>
                {capture.description && <p className="text-muted-foreground text-xs mt-1.5 line-clamp-2 leading-relaxed">{capture.description}</p>}
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-muted/50 rounded-xl border border-dashed border-border">
              <p className="text-xs text-muted-foreground">아직 이 영역에 연결된 캡처가 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
