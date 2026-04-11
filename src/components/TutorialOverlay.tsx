import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Plus, Search, MousePointerClick, Sparkles, ChevronRight, HelpCircle } from 'lucide-react';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  targetSelector?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  details?: React.ReactNode;
}

const steps: TutorialStep[] = [
  {
    icon: <Network className="w-8 h-8 text-primary" />,
    title: '네트워크 구조',
    description: '"나"를 중심으로 관심사 → 세부 키워드 → 캡처가 연결됩니다.',
    targetSelector: '[data-tutorial="legend"]',
    tooltipPosition: 'right',
    details: (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_hsl(187,80%,48%)]" />
          <span className="text-foreground/80">나 — 중심</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_hsl(292,84%,61%)]" />
          <span className="text-foreground/80">관심사</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-synapse-indigo shadow-[0_0_8px_hsl(239,84%,67%)]" />
          <span className="text-foreground/80">세부 키워드</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_4px_hsl(160,84%,39%)]" />
          <span className="text-foreground/80">캡처</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Plus className="w-8 h-8 text-accent" />,
    title: '캡처 추가',
    description: '이 버튼을 눌러 텍스트, 링크, 파일, 이미지를 저장하세요. AI가 자동으로 분류합니다.',
    targetSelector: '[data-tutorial="fab"]',
    tooltipPosition: 'left',
  },
  {
    icon: <Search className="w-8 h-8 text-foreground" />,
    title: '검색',
    description: '노드나 키워드를 검색해서 빠르게 찾을 수 있습니다.',
    targetSelector: '[data-tutorial="search"]',
    tooltipPosition: 'bottom',
  },
  {
    icon: <MousePointerClick className="w-8 h-8 text-secondary" />,
    title: '노드 탐색',
    description: '캔버스의 노드를 클릭하면 상세 정보를 볼 수 있습니다. 드래그로 이동, 스크롤로 확대/축소하세요.',
  },
  {
    icon: <Sparkles className="w-8 h-8 text-synapse-indigo" />,
    title: '자동 연결',
    description: '캡처가 쌓이면 AI가 유사한 것끼리 세부 키워드로 묶어줍니다. 저장만 하세요!',
  },
  {
    icon: <HelpCircle className="w-8 h-8 text-muted-foreground" />,
    title: '다시 보기',
    description: '이 버튼을 누르면 언제든 튜토리얼을 다시 볼 수 있습니다.',
    targetSelector: '[data-tutorial="help"]',
    tooltipPosition: 'bottom',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  onClose: () => void;
}

export const TutorialOverlay = ({ onClose }: TutorialOverlayProps) => {
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [cardSize, setCardSize] = useState({ width: 288, height: 220 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const updateSpotlight = useCallback(() => {
    if (current.targetSelector) {
      const el = document.querySelector(current.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const padding = 8;
        setSpotlight({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
        return;
      }
    }
    setSpotlight(null);
  }, [current.targetSelector]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [updateSpotlight]);

  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const updateCardSize = () => {
      const rect = element.getBoundingClientRect();
      setCardSize({ width: rect.width, height: rect.height });
    };

    updateCardSize();

    const observer = new ResizeObserver(updateCardSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [step]);

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

  const GAP = 16;
  const MARGIN = 12;

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlight || !current.tooltipPosition) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { width: cardWidth, height: cardHeight } = cardSize;

    let top = 0;
    let left = 0;

    switch (current.tooltipPosition) {
      case 'right':
        top = spotlight.top;
        left = spotlight.left + spotlight.width + GAP;
        break;
      case 'left':
        top = spotlight.top + spotlight.height / 2 - cardHeight / 2;
        left = spotlight.left - GAP - cardWidth;
        break;
      case 'bottom':
        top = spotlight.top + spotlight.height + GAP;
        left = spotlight.left + spotlight.width / 2 - cardWidth / 2;
        break;
      case 'top':
        top = spotlight.top - GAP - cardHeight;
        left = spotlight.left + spotlight.width / 2 - cardWidth / 2;
        break;
    }

    top = clamp(top, MARGIN, vh - cardHeight - MARGIN);
    left = clamp(left, MARGIN, vw - cardWidth - MARGIN);

    return { position: 'fixed', top, left };
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          background: 'rgba(0,0,0,0.75)',
          ...(spotlight
            ? {
                maskImage: `radial-gradient(ellipse ${spotlight.width * 0.7}px ${spotlight.height * 0.7}px at ${spotlight.left + spotlight.width / 2}px ${spotlight.top + spotlight.height / 2}px, transparent 60%, black 100%)`,
                WebkitMaskImage: `radial-gradient(ellipse ${spotlight.width * 0.7}px ${spotlight.height * 0.7}px at ${spotlight.left + spotlight.width / 2}px ${spotlight.top + spotlight.height / 2}px, transparent 60%, black 100%)`,
              }
            : {}),
        }}
        onClick={handleNext}
      />

      {spotlight && (
        <motion.div
          layoutId="spotlight-ring"
          className="absolute rounded-xl border-2 border-primary/60 pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 20px hsl(187 80% 48% / 0.3), 0 0 60px hsl(187 80% 48% / 0.1)',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          ref={cardRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={getTooltipStyle()}
          className="z-50 w-72 max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto bg-card border border-border rounded-xl p-5 shadow-2xl"
        >
          <div className="flex items-start gap-3 mb-3">
            {current.icon}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{current.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{current.description}</p>
            </div>
          </div>

          {current.details && <div className="mb-3 pl-1">{current.details}</div>}

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {step === 0 && (
                <button
                  onClick={handleSkip}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  건너뛰기
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                {isLast ? '시작하기' : '다음'}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
