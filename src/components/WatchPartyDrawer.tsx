import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Users,
  Copy,
  Check,
  Film,
  RefreshCw,
  LogOut,
  Lock,
  Unlock,
  Share2,
  Sparkles,
  Home,
  ArrowLeft,
} from 'lucide-react';
import { WatchPartyState, WatchPartyMember, WatchPartyMessage } from '../types/media';

interface WatchPartyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: WatchPartyState | null;
  currentMemberId: string | null;
  isHost: boolean;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onResync: () => void;
  onLeaveRoom: () => void;
  onToggleHostControl: (enabled: boolean) => void;
  onBackToHome?: () => void;
}

const QUICK_REACTIONS = ['🍿', '❤️', '😂', '😱', '🔥', '👏', '🎉', '🤯'];

export const WatchPartyDrawer: React.FC<WatchPartyDrawerProps> = ({
  isOpen,
  onClose,
  roomState,
  currentMemberId,
  isHost,
  onSendMessage,
  onSendReaction,
  onResync,
  onLeaveRoom,
  onToggleHostControl,
  onBackToHome,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'people' | 'settings'>('chat');
  const [inputText, setInputText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomState?.messages, activeTab]);

  if (!isOpen || !roomState) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomState.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomState.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              onClose();
              onBackToHome?.();
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700/60 cursor-pointer"
            title="Return to Home Screen"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span>Home</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-800/50">
              {roomState.code}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 hidden sm:inline">
            ({roomState.members.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyCode}
            title="Copy Code"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors text-xs"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/40">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'chat'
              ? 'border-sky-500 text-sky-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Live Chat ({roomState.messages.length})
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'people'
              ? 'border-sky-500 text-sky-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Members ({roomState.members.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-sky-500 text-sky-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Room Settings
        </button>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Reaction Bar */}
          <div className="px-3 py-2 bg-zinc-950/60 border-b border-zinc-800/80 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-zinc-500 mr-1 shrink-0">React:</span>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="text-lg p-1 hover:scale-130 active:scale-95 transition-transform rounded hover:bg-zinc-800"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans">
            {roomState.messages.map((msg: WatchPartyMessage) => {
              const isMe = msg.senderId === currentMemberId;

              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="inline-block px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/40 text-[10px] text-zinc-400">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: msg.senderColor || '#38bdf8' }}
                    >
                      {msg.senderName}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${
                      isMe
                        ? 'bg-sky-500 text-zinc-950 rounded-tr-xs font-medium'
                        : 'bg-zinc-800 text-zinc-100 rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Chat with friends in room..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-sky-500 text-zinc-950 disabled:opacity-40 hover:bg-sky-400 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* People Tab */}
      {activeTab === 'people' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Connected Viewers ({roomState.members.length})
          </div>
          {roomState.members.map((member: WatchPartyMember) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/70 border border-zinc-700/50"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-zinc-950 shadow-xs"
                  style={{ backgroundColor: member.color || '#38bdf8' }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <span>{member.name}</span>
                    {member.id === currentMemberId && (
                      <span className="text-[10px] text-zinc-400">(You)</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {member.isHost ? 'Party Host 👑' : 'Guest'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Synced</span>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-sky-400" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Watch Party Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 space-y-2">
            <div className="text-xs font-semibold text-zinc-300">Room Information</div>
            <div className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Code:</span>
              <span className="font-mono font-bold text-white">{roomState.code}</span>
            </div>
            <div className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Movie Title:</span>
              <span className="text-zinc-200 truncate max-w-[160px]">
                {roomState.mediaInfo?.name || 'Local File'}
              </span>
            </div>
          </div>

          {isHost && (
            <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    {roomState.hostOnlyControl ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Host-Only Control</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {roomState.hostOnlyControl
                      ? 'Only you can play, pause, or seek.'
                      : 'Collaborative: anyone can control playback.'}
                  </p>
                </div>
                <button
                  onClick={() => onToggleHostControl(!roomState.hostOnlyControl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    roomState.hostOnlyControl
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-700 text-zinc-200 border-zinc-600'
                  }`}
                >
                  {roomState.hostOnlyControl ? 'Locked' : 'Unlock All'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={onResync}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Force Resync Playback</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Leave Watch Party</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onBackToHome?.();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span>Return to Home Screen</span>
          </button>
        </div>
      )}
    </div>
  );
};
