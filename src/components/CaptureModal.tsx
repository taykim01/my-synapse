import { useState } from 'react';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { X, ChevronDown, Type, Link, FileText, Image } from 'lucide-react';

const CONTENT_TYPES = [
  { value: 'TEXT', label: '텍스트', icon: Type },
  { value: 'LINK', label: '링크', icon: Link },
  { value: 'FILE', label: '파일', icon: FileText },
  { value: 'IMAGE', label: '이미지', icon: Image },
] as const;

export function CaptureModal() {
  const captureForm = useGalaxyStore(s => s.captureForm);
  const setCaptureForm = useGalaxyStore(s => s.setCaptureForm);
  const addCapture = useGalaxyStore(s => s.addCapture);
  const setIsAddingCapture = useGalaxyStore(s => s.setIsAddingCapture);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isText = captureForm.content_type === 'TEXT';
  const selectedType = CONTENT_TYPES.find(ct => ct.value === captureForm.content_type) || CONTENT_TYPES[0];
  const SelectedIcon = selectedType.icon;

  return (
    <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display text-foreground">새로운 캡처</h2>
          <button onClick={() => setIsAddingCapture(false)} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Content Type Dropdown */}
          <div className="relative">
            <label className="text-xs text-muted-foreground mb-2 block">입력 형식</label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground hover:border-accent/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <SelectedIcon size={16} className="text-accent" />
                {selectedType.label}
              </span>
              <ChevronDown size={16} className={`text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                {CONTENT_TYPES.map(ct => {
                  const Icon = ct.icon;
                  return (
                    <button
                      key={ct.value}
                      onClick={() => {
                        setCaptureForm({ content_type: ct.value });
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-accent/10 transition-colors ${
                        captureForm.content_type === ct.value ? 'text-accent bg-accent/5' : 'text-foreground'
                      }`}
                    >
                      <Icon size={16} />
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Title — editable for TEXT, AI placeholder for others */}
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs text-muted-foreground">제목</label>
              {!isText && (
                <span className="text-[10px] text-synapse-indigo bg-synapse-indigo/10 px-2 py-0.5 rounded">
                  AI 자동 생성 · 수정 가능
                </span>
              )}
            </div>
            {isText ? (
              <input
                type="text"
                placeholder="어떤 정보인가요?"
                value={captureForm.title}
                onChange={e => setCaptureForm({ title: e.target.value })}
                className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            ) : (
              <input
                type="text"
                placeholder="캡처 후 AI가 자동으로 제목을 생성합니다"
                value={captureForm.title}
                onChange={e => setCaptureForm({ title: e.target.value })}
                className="w-full bg-synapse-deep/50 border border-border/50 rounded-lg px-4 py-3 text-foreground/70 placeholder-muted-foreground/60 focus:outline-none focus:border-accent transition-colors italic"
              />
            )}
          </div>

          {/* Content URL / File input (for non-TEXT) */}
          {!isText && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {captureForm.content_type === 'LINK' ? 'URL' : captureForm.content_type === 'IMAGE' ? '이미지 URL' : '파일 URL'}
              </label>
              <input
                type="url"
                placeholder={captureForm.content_type === 'LINK' ? 'https://...' : captureForm.content_type === 'IMAGE' ? '이미지 URL 또는 촬영 (추후 지원)' : '파일 URL을 입력하세요'}
                value={captureForm.content_url}
                onChange={e => setCaptureForm({ content_url: e.target.value })}
                className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">메모</label>
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
            <label className="text-xs text-muted-foreground mb-1 block">출처</label>
            <input
              type="text"
              placeholder="출처 앱/웹사이트 이름"
              value={captureForm.source}
              onChange={e => setCaptureForm({ source: e.target.value })}
              className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setIsAddingCapture(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            취소
          </button>
          <button
            onClick={addCapture}
            disabled={isText && !captureForm.title.trim()}
            className="px-6 py-2 text-sm bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors glow-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            캡처 추가
          </button>
        </div>
      </div>
    </div>
  );
}
