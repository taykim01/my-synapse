import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { X } from 'lucide-react';

const SUGGESTED_KEYWORDS = [
  '기술', '예술', '과학', '음악', '철학', '역사', '문학', '여행',
  '요리', '운동', '경제', '디자인', '심리학', '건축', '영화', '수학',
];

export function OnboardingModal() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const setOnboarded = useGalaxyStore(s => s.setOnboarded);

  const toggleKeyword = (kw: string) => {
    if (selected.includes(kw)) {
      setSelected(selected.filter(s => s !== kw));
    } else if (selected.length < 8) {
      setSelected([...selected, kw]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed) && selected.length < 8) {
      setSelected([...selected, trimmed]);
      setCustomInput('');
    }
  };

  const handleStart = () => {
    if (selected.length > 0) {
      setOnboarded(selected);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', damping: 25 }}
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card p-8"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, hsl(260,80%,75%) 0%, hsl(260,60%,40%) 100%)' }}
          >
            <span className="text-2xl">✦</span>
          </motion.div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            당신의 은하를 시작합니다
          </h1>
          <p className="text-muted-foreground text-sm">
            관심 분야를 선택하세요. 이것들이 당신의 첫 번째 별자리가 됩니다.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            최대 8개 · {selected.length}/8
          </p>
        </div>

        {/* Suggested keywords */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {SUGGESTED_KEYWORDS.map(kw => (
            <motion.button
              key={kw}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleKeyword(kw)}
              className={`px-3 py-1.5 rounded-full text-sm font-body transition-all ${
                selected.includes(kw)
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {kw}
            </motion.button>
          ))}
        </div>

        {/* Custom input */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="직접 입력..."
            className="flex-1 bg-secondary text-foreground rounded-lg px-4 py-2 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary font-body placeholder:text-muted-foreground"
          />
          <button
            onClick={addCustom}
            disabled={!customInput.trim() || selected.length >= 8}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 disabled:opacity-30 font-body"
          >
            추가
          </button>
        </div>

        {/* Selected keywords display */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 mb-6 justify-center overflow-hidden"
            >
              {selected.map(kw => (
                <motion.span
                  key={kw}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-body"
                >
                  {kw}
                  <button onClick={() => toggleKeyword(kw)} className="hover:text-foreground">
                    <X size={12} />
                  </button>
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          disabled={selected.length === 0}
          className="w-full py-3 rounded-xl font-display font-semibold text-primary-foreground disabled:opacity-30 transition-all"
          style={{
            background: selected.length > 0
              ? 'linear-gradient(135deg, hsl(260,60%,55%), hsl(200,70%,50%))'
              : 'hsl(230,15%,20%)',
          }}
        >
          은하 탐험 시작 ✦
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
