import { useGalaxyStore } from '@/stores/galaxyStore';
import { X } from 'lucide-react';

const CONTENT_TYPES = ['TEXT', 'IMAGE', 'LINK', 'FILE'] as const;

export function CaptureModal() {
  const captureForm = useGalaxyStore(s => s.captureForm);
  const setCaptureForm = useGalaxyStore(s => s.setCaptureForm);
  const addCapture = useGalaxyStore(s => s.addCapture);
  const setIsAddingCapture = useGalaxyStore(s => s.setIsAddingCapture);

  return (
    <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display text-foreground">새로운 캡처 기록</h2>
          <button onClick={() => setIsAddingCapture(false)} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Content Type */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">콘텐츠 유형</label>
            <div className="flex gap-2">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct}
                  onClick={() => setCaptureForm({ content_type: ct })}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    captureForm.content_type === ct
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-synapse-deep border-border text-muted-foreground hover:border-accent/50'
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">제목 (Title)</label>
            <input
              type="text"
              placeholder="어떤 정보인가요?"
              value={captureForm.title}
              onChange={e => setCaptureForm({ title: e.target.value })}
              className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Content URL (for IMAGE, LINK, FILE) */}
          {captureForm.content_type !== 'TEXT' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {captureForm.content_type === 'LINK' ? 'URL' : `${captureForm.content_type} URL`}
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={captureForm.content_url}
                onChange={e => setCaptureForm({ content_url: e.target.value })}
                className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">메모 (Description)</label>
            <textarea
              placeholder="세부 내용을 기록하세요."
              value={captureForm.description}
              onChange={e => setCaptureForm({ description: e.target.value })}
              rows={3}
              className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent resize-none transition-colors"
            />
          </div>

          {/* Source */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">출처 (Source)</label>
            <input
              type="text"
              placeholder="출처 앱/웹사이트 이름"
              value={captureForm.source}
              onChange={e => setCaptureForm({ source: e.target.value })}
              className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Tag */}
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs text-muted-foreground">태그 (Tag)</label>
              <span className="text-[10px] text-synapse-indigo bg-synapse-indigo/10 px-2 py-0.5 rounded">AI 제안 태그 (수정 가능)</span>
            </div>
            <input
              type="text"
              value={captureForm.tag}
              onChange={e => setCaptureForm({ tag: e.target.value })}
              className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
              placeholder="태그 없이도 게시 가능"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setIsAddingCapture(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            취소
          </button>
          <button
            onClick={addCapture}
            className="px-6 py-2 text-sm bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors glow-accent"
          >
            네트워크에 추가
          </button>
        </div>
      </div>
    </div>
  );
}
