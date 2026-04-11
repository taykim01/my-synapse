import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Plus, MousePointerClick, Sparkles, ChevronRight } from 'lucide-react';

interface TutorialSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: React.ReactNode;
}

const slides: TutorialSlide[] = [
  {
    icon: <Network className="w-10 h-10 text-primary" />,
    title: '네트워크 구조',
    description: '"나"를 중심으로 지식이 계층적으로 연결됩니다.',
    details: (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_10px_hsl(187,80%,48%)]" />
          <span className="text-foreground/80">나 — 네트워크의 중심</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-secondary shadow-[0_0_10px_hsl(292,84%,61%)]" />
          <span className="text-foreground/80">관심사 — 큰 주제 카테고리</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-synapse-indigo shadow-[0_0_10px_hsl(239,84%,67%)]" />
          <span className="text-foreground/80">세부 키워드 — 하위 분류</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_6px_hsl(160,84%,39%)]" />
          <span className="text-foreground/80">캡처 — 저장한 콘텐츠</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Plus className="w-10 h-10 text-accent" />,
    title: '캡처 추가',
    description: '오른쪽 하단 + 버튼을 눌러 콘텐츠를 저장하세요.',
    details: (
      <div className="space-y-2 text-sm text-foreground/70">
        <p>📝 텍스트 메모</p>
        <p>🔗 URL 링크</p>
        <p>📄 파일 업로드</p>
        <p>🖼️ 이미지</p>
        <p className="text-accent pt-2 text-xs">AI가 자동으로 관련 키워드에 연결합니다.</p>
      </div>
    ),
  },
  {
    icon: <MousePointerClick className="w-10 h-10 text-secondary" />,
    title: '노드 탐색',
    description: '노드를 클릭하면 상세 정보를 확인할 수 있습니다.',
    details: (
      <div className="space-y-2 text-sm text-foreground/70">
        <p>• 노드 클릭 → 상세 패널 열기</p>
        <p>• 우측 상단 검색으로 빠르게 찾기</p>
        <p>• 드래그로 캔버스 이동, 스크롤로 확대/축소</p>
      </div>
    ),
  },
  {
    icon: <Sparkles className="w-10 h-10 text-synapse-indigo" />,
    title: '자동 연결',
    description: '캡처가 쌓이면 AI가 유사한 것끼리 묶어줍니다.',
    details: (
      <div className="space-y-2 text-sm text-foreground/70">
        <p>비슷한 캡처들이 자동으로 세부 키워드 아래 그룹화됩니다.</p>
        <p>저장만 하세요 — 정리는 AI가 알아서 합니다.</p>
      </div>
    ),
  },
];

interface TutorialOverlayProps {
  onClose: () => void;
}

export const TutorialOverlay = ({ onClose }: TutorialOverlayProps) => {
  const [step, setStep] = useState(0);
  const isLast = step === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('synapse_tutorial_seen', 'true');
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('synapse_tutorial_seen', 'true');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
    >
      <div className="relative w-full max-w-md mx-4">
        {/* Skip */}
        <button
          onClick={handleSkip}
          className="absolute -top-10 right-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          건너뛰기
        </button>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                {slides[step].icon}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{slides[step].title}</h2>
                  <p className="text-sm text-muted-foreground">{slides[step].description}</p>
                </div>
              </div>
              <div className="pl-1">{slides[step].details}</div>
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8">
            {/* Dots */}
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === step ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {isLast ? '시작하기' : '다음'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
