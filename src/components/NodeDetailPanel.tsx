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
      className={`absolute top-4 right-4 bottom-4 w-80 md:w-96 z-40 bg-[#101018]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-6 flex flex-col rounded-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selectedNode ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-medium text-white pr-4">{displayNode?.title}</h2>
        <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-white shrink-0">
          <X size={20} />
        </button>
      </div>

      {displayNode?.type === 'capture' && (
        <>
          {displayNode?.body && (
            <div className="flex-1 overflow-y-auto mb-6">
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-white/5 p-4 rounded-xl border border-white/10">
                {displayNode.body}
              </p>
            </div>
          )}

          {displayNode?.tags && displayNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-white/10">
              {displayNode.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-blue-900/40 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-full text-xs shadow-[0_0_8px_rgba(59,130,246,0.3)]"
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
          <h3 className="text-xs font-semibold text-gray-500 mb-3 tracking-wider">연결된 별(기록) 목록</h3>
          {getConnectedCaptures(displayNode.id).length > 0 ? (
            getConnectedCaptures(displayNode.id).map(capture => (
              <div
                key={capture.id}
                className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-blue-500/50 cursor-pointer transition-all group"
                onClick={() => setSelectedNode(capture)}
              >
                <h4 className="text-white text-sm font-medium group-hover:text-blue-400 transition-colors">{capture.title}</h4>
                {capture.body && <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">{capture.body}</p>}
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-white/5 rounded-xl border border-dashed border-white/10">
              <p className="text-xs text-gray-500">아직 이 영역에 개척된 기록이 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
