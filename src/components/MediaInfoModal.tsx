import React from 'react';
import { X, Info, HardDrive, ShieldCheck, Video, Music, ArrowLeft, Home } from 'lucide-react';
import { MediaItem } from '../types/media';
import { formatFileSize, formatTime } from '../utils/formatters';

interface MediaInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediaItem | null;
  onBackToHome?: () => void;
}

export const MediaInfoModal: React.FC<MediaInfoModalProps> = ({ isOpen, onClose, item, onBackToHome }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-semibold text-white">Media Details & Metadata</h2>
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

        <div className="p-6 space-y-4">
          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
              {item.isVideo ? <Video className="w-5 h-5" /> : <Music className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 break-words">{item.name}</p>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5 uppercase">
                {item.extension.toUpperCase()} CONTAINER · {item.type || 'Standard Format'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 block mb-1">File Size</span>
              <span className="font-mono font-medium text-zinc-200">{formatFileSize(item.size)}</span>
            </div>

            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 block mb-1">Duration</span>
              <span className="font-mono font-medium text-zinc-200">
                {item.duration ? formatTime(item.duration) : 'Calculating...'}
              </span>
            </div>

            {item.isVideo && item.width && item.height && (
              <>
                <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-500 block mb-1">Resolution</span>
                  <span className="font-mono font-medium text-zinc-200">
                    {item.width} × {item.height}
                  </span>
                </div>

                <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-500 block mb-1">Aspect Ratio</span>
                  <span className="font-mono font-medium text-zinc-200">
                    {(item.width / item.height).toFixed(2)} : 1
                  </span>
                </div>
              </>
            )}

            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 block mb-1">Bookmarks</span>
              <span className="font-mono font-medium text-zinc-200">{item.bookmarks.length} saved</span>
            </div>

            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 block mb-1">Data Source</span>
              <span className="font-mono font-medium text-emerald-400">Local Memory Blob</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2.5 text-emerald-300 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>100% Private playback. This file has never left your device.</span>
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
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-colors shadow-md active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Player</span>
          </button>
        </div>
      </div>
    </div>
  );
};
