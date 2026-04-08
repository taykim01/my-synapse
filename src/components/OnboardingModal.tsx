import { useState } from 'react';
import { useGalaxyStore } from '@/stores/galaxyStore';

const RECOMMENDED_KEYWORDS = [
  '음악', '영화', '독서', '여행', '요리', '운동', '게임',
  '프로그래밍', '디자인', '사진', '패션', '경제', '과학',
  '역사', '건강', '교육', '뉴스', '예술', '자기계발', '일상',
];

export function OnboardingModal() {
  const [keyword, setKeyword] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const startExploration = useGalaxyStore(s => s.startExploration);

  const addKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const kw = keyword.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeyword('');
    }
  };

  const toggleRecommended = (kw: string) => {
    if (keywords.includes(kw)) {
      setKeywords(keywords.filter(k => k !== kw));
    } else {
      setKeywords([...keywords, kw]);
    }
  };

  const handleStart = () => {
    const valid = keywords.length > 0 ? keywords : ['일상', '아이디어'];
    startExploration(valid);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-synapse-fuchsia/30 via-background to-background" />

      <div className="z-10 max-w-md w-full bg-card/80 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h1 className="text-3xl font-display text-primary text-center tracking-wider mb-2">Synapse</h1>
        <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
          생각의 파편을 연결하는 뉴런 네트워크
        </p>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">
            초기 신경망을 구성할 관심사를 입력해주세요.
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            입력하신 관심사는 AI가 조작할 수 없는 고유의 Keyword가 됩니다.
          </p>
        </div>

        {/* Recommended keywords */}
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground mb-2">추천 키워드</p>
          <div className="flex flex-wrap gap-1.5">
            {RECOMMENDED_KEYWORDS.map(kw => (
              <button
                key={kw}
                onClick={() => toggleRecommended(kw)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  keywords.includes(kw)
                    ? 'bg-secondary/20 text-secondary border-secondary/30'
                    : 'bg-muted/30 text-muted-foreground border-border hover:border-secondary/30 hover:text-foreground'
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={addKeyword} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="직접 입력 (엔터)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="flex-1 bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-secondary transition-colors"
          />
          <button
            type="submit"
            className="bg-muted hover:bg-muted/80 px-6 rounded-lg transition-colors text-foreground"
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
