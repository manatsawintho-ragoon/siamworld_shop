'use client';

export default function RconModal({ command, onClose }: { command: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-terminal text-purple-500 text-sm" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800 text-sm">RCON Command</p>
            <p className="text-[10px] text-gray-400">คำสั่งที่จะถูกส่งไปยังเซิร์ฟเวอร์</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times text-xs" />
          </button>
        </div>
        <div className="p-5">
          <pre className="bg-[#1e2735] text-green-400 rounded-xl px-4 py-3 text-[12px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {command || '(ไม่มีคำสั่ง)'}
          </pre>
        </div>
      </div>
    </div>
  );
}
