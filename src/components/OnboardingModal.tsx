import { useState } from 'react';
import { useGalaxyStore } from '@/stores/galaxyStore';

export function OnboardingModal() {
  const [keywords, setKeywords] = useState(['', '', '']);
  const startExploration = useGalaxyStore(s => s.startExploration);

  const handleStart = () => {
    const valid = keywords.filter(k => k.trim() !== '');
    if (valid.length === 0) return;
    startExploration(valid);
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-gray-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-[#05050A] to-[#05050A]" />

      <div className="z-10 max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-serif text-white mb-2 text-center tracking-wider">지적 대항해 시대</h1>
        <p className="text-sm text-gray-400 text-center mb-8 leading-relaxed">
          당신의 뇌는 무한한 은하이며, <br />모든 기록은 그 은하를 밝히는 별입니다.<br />탐험을 시작할 관심사(별자리)를 입력하세요.
        </p>

        <div className="space-y-3 mb-8">
          {keywords.map((kw, i) => (
            <input
              key={i}
              type="text"
              placeholder={`관심사 키워드 ${i + 1}`}
              value={kw}
              onChange={e => {
                const newKws = [...keywords];
                newKws[i] = e.target.value;
                setKeywords(newKws);
              }}
              className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          ))}
          {keywords.length < 8 && (
            <button
              onClick={() => setKeywords([...keywords, ''])}
              className="w-full py-2 text-sm text-gray-400 hover:text-white border border-dashed border-white/20 rounded-lg transition-colors"
            >
              + 관심사 추가 (최대 8개)
            </button>
          )}
        </div>

        <button
          onClick={handleStart}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.5)]"
        >
          은하 생성하기
        </button>
      </div>
    </div>
  );
}
