import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { X, Sparkles } from 'lucide-react';

export function CaptureModal() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const addCapture = useGalaxyStore(s => s.addCapture);
  const closeCaptureModal = useGalaxyStore(s => s.closeCaptureModal);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const handleSubmit = () => {
    if (!title.trim()) return;
    addCapture({ title: title.trim(), body: body.trim(), tags });
    setTitle('');
    setBody('');
    setTags([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm"
      onClick={closeCaptureModal}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25 }}
        className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={closeCaptureModal}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={20} className="text-star-warm" />
          <h2 className="font-display text-lg font-semibold text-foreground">새로운 별 생성</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">제목</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="이 별의 이름은..."
              className="w-full bg-secondary text-foreground rounded-lg px-4 py-2.5 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary font-body placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">내용</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="당신의 생각을 기록하세요..."
              rows={4}
              className="w-full bg-secondary text-foreground rounded-lg px-4 py-2.5 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary font-body placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">태그</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="태그 추가..."
                className="flex-1 bg-secondary text-foreground rounded-lg px-4 py-2 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary font-body placeholder:text-muted-foreground"
              />
              <button
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 disabled:opacity-30 font-body"
              >
                +
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/30 text-accent text-xs font-body"
                  >
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-foreground">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="w-full mt-6 py-3 rounded-xl font-display font-semibold text-primary-foreground disabled:opacity-30 transition-all"
          style={{
            background: title.trim()
              ? 'linear-gradient(135deg, hsl(260,60%,55%), hsl(165,70%,45%))'
              : 'hsl(230,15%,20%)',
          }}
        >
          별 추가하기 ✦
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
