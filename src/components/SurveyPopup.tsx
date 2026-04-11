import { useState, useEffect } from 'react';
import { X, ExternalLink, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SURVEY_URL = 'https://relic-gem-3dd.notion.site/33d8df35f10d80fb9e6bdf8dfb15a28d?pvs=105';
const DISMISSED_KEY = 'synapse_survey_dismissed';

interface SurveyPopupProps {
  captureCount: number;
}

export function SurveyPopup({ captureCount }: SurveyPopupProps) {
  const [visible, setVisible] = useState(false);

  const prevCountRef = useState(() => captureCount)[0];
  const [prevCount, setPrevCount] = useState(prevCountRef);

  useEffect(() => {
    // Only trigger when crossing the threshold of 5, not on every load
    if (prevCount < 5 && captureCount >= 5 && !localStorage.getItem(DISMISSED_KEY)) {
      setVisible(true);
    }
    setPrevCount(captureCount);
  }, [captureCount]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-[90vw] max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
                <Coffee className="w-7 h-7 text-accent" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground">
                  🎉 벌써 캡처 5개 달성!
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Synapse를 사용해주셔서 감사합니다!<br />
                  간단한 설문(5문항)에 답해주시면,<br />
                  추첨을 통해 <span className="text-accent font-semibold">스타벅스 기프티콘</span>을 드려요 ☕
                </p>
              </div>

              <a
                href={SURVEY_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismiss}
                className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-medium py-3 px-6 rounded-xl hover:brightness-110 transition-all shadow-[0_0_16px_hsl(160,84%,39%,0.3)]"
              >
                설문 참여하기
                <ExternalLink size={16} />
              </a>

              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                다음에 할게요
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
