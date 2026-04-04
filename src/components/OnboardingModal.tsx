import { useState } from 'react';
import { useGalaxyStore } from '@/stores/galaxyStore';

export function OnboardingModal() {
  const [keyword, setKeyword] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const startExploration = useGalaxyStore(s => s.startExploration);

  const addKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim() && keywords.length < 8 && !keywords.includes(keyword.trim())) {
      setKeywords([...keywords, keyword.trim()]);
      setKeyword('');
    }
  };

  const handleStart = () => {
    const valid = keywords.length > 0 ? keywords : ['일상', '아이디어'];
    startExploration(valid);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-synapse-fuchsia/30 via-background to-background" />

      <div className="z-10 max-w-md w-full bg-card/80 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-display text-primary text-center tracking-wider mb-2">Synapse</h1>
        <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
          생각의 파편을 연결하는 뉴런 네트워크
        </p>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">
            초기 신경망을 구성할 관심사를 입력해주세요. (최대 8개)
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            입력하신 관심사는 AI가 조작할 수 없는 고유의 Keyword가 됩니다.
          </p>
        </div>

        <form onSubmit={addKeyword} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder={keywords.length >= 8 ? "최대 8개까지 입력 가능합니다." : "관심사 입력 (엔터)"}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            disabled={keywords.length >= 8}
            className="flex-1 bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-secondary transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={keywords.length >= 8}
            className="bg-muted hover:bg-muted/80 px-6 rounded-lg transition-colors disabled:opacity-50 text-foreground"
          >
            추가
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mb-6 min-h-[40px] bg-synapse-deep/50 rounded-lg p-3 border border-border">
          {keywords.map(kw => (
            <span key={kw} className="flex items-center gap-1.5 bg-secondary/20 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-xs">
              {kw}
              <button onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="hover:text-foreground text-secondary/70">×</button>
            </span>
          ))}
          {keywords.length === 0 && <span className="text-xs text-muted-foreground">입력된 관심사가 없습니다.</span>}
        </div>

        <button
          onClick={handleStart}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-medium py-3 rounded-lg transition-colors glow-secondary"
        >
          네트워크 생성
        </button>
      </div>
    </div>
  );
}
