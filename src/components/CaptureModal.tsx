import { useGalaxyStore } from '@/stores/galaxyStore';
import { X } from 'lucide-react';

export function CaptureModal() {
  const captureForm = useGalaxyStore(s => s.captureForm);
  const setCaptureForm = useGalaxyStore(s => s.setCaptureForm);
  const addCapture = useGalaxyStore(s => s.addCapture);
  const setIsAddingCapture = useGalaxyStore(s => s.setIsAddingCapture);

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#101018] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium text-white">새로운 별 기록하기</h2>
          <button onClick={() => setIsAddingCapture(false)} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={captureForm.title}
            onChange={e => setCaptureForm({ ...captureForm, title: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <textarea
            placeholder="내용을 입력하여 새로운 영역을 개척하세요..."
            value={captureForm.body}
            onChange={e => setCaptureForm({ ...captureForm, body: e.target.value })}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />

          <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg">
            <span className="text-blue-400 text-sm whitespace-nowrap">✨ AI 태그 제안:</span>
            <input
              type="text"
              value={captureForm.tag}
              onChange={e => setCaptureForm({ ...captureForm, tag: e.target.value })}
              className="bg-transparent border-b border-blue-500/50 text-white text-sm focus:outline-none w-full pb-1"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setIsAddingCapture(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            취소
          </button>
          <button
            onClick={addCapture}
            className="px-6 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-gray-200 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
          >
            우주에 발사
          </button>
        </div>
      </div>
    </div>
  );
}
