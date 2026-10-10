import React from 'react';
import { X, Keyboard, ArrowLeft, Home } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToHome?: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, onBackToHome }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'H / Esc', desc: 'Back to Home / File Hub' },
    { key: 'Space / K', desc: 'Play / Pause' },
    { key: 'F', desc: 'Toggle Fullscreen' },
    { key: 'M', desc: 'Mute / Unmute Audio' },
    { key: '← / →', desc: 'Seek Backward / Forward 5s' },
    { key: 'J / L', desc: 'Seek Backward / Forward 10s' },
    { key: '↑ / ↓', desc: 'Increase / Decrease Volume' },
    { key: '[ / ]', desc: 'Decrease / Increase Speed' },
    { key: ', / .', desc: 'Step Frame Backward / Forward' },
    { key: '0 – 9', desc: 'Jump to 0% – 90% of media' },
    { key: 'C', desc: 'Toggle Subtitles on/off' },
    { key: 'S', desc: 'Capture high-res Screenshot' },
    { key: 'B', desc: 'Add Bookmark at current time' },
    { key: '?', desc: 'Open / Close Shortcuts Guide' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onBackToHome?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700/60 cursor-pointer"
              title="Return to Home Screen"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
              <Home className="w-3.5 h-3.5 text-zinc-400" />
              <span>Home</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shortcuts.map((sc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80"
              >
                <span className="text-xs text-zinc-300">{sc.desc}</span>
                <kbd className="px-2 py-1 text-[11px] font-mono font-medium text-sky-300 bg-zinc-800/90 rounded border border-zinc-700/60 shadow-xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onBackToHome?.();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700/80 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span>Back to Home</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-colors shadow-md active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Player</span>
          </button>
        </div>
      </div>
    </div>
  );
};
