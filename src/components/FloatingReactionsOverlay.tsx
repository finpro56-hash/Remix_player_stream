import React from 'react';
import { FloatingReaction } from '../types/media';

interface FloatingReactionsOverlayProps {
  reactions: FloatingReaction[];
}

export const FloatingReactionsOverlay: React.FC<FloatingReactionsOverlayProps> = ({
  reactions,
}) => {
  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-16 flex flex-col items-center animate-reaction-float pointer-events-none select-none transition-all"
          style={{
            left: `${r.leftPercent}%`,
          }}
        >
          <div className="text-4xl sm:text-5xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] filter transform hover:scale-110">
            {r.emoji}
          </div>
          {r.senderName && (
            <span className="mt-1 px-2 py-0.5 rounded-full bg-black/75 border border-white/20 text-[11px] font-semibold text-white/90 backdrop-blur-xs shadow-md">
              {r.senderName}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
