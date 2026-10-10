import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  Play,
  Film,
  Sparkles,
  Lock,
  Unlock,
  LogOut,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Share2,
} from 'lucide-react';
import {
  WatchPartyState,
  WatchPartyMember,
  MediaItem,
} from '../types/media';
import { SAMPLE_MOVIES, createMediaItemFromSample, SampleMovie } from '../utils/sampleMovies';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: WatchPartyState | null;
  currentMemberId: string | null;
  isHost: boolean;
  onCreateRoom: (userName: string, hostOnlyControl: boolean) => void;
  onJoinRoom: (roomCode: string, userName: string) => void;
  onLeaveRoom: () => void;
  onResync: () => void;
  onToggleHostControl: (enabled: boolean) => void;
  onOpenChat: () => void;
  onLoadSampleMovie: (sample: SampleMovie) => void;
  currentMedia: MediaItem | null;
  initialRoomCode?: string;
  error: string | null;
  onClearError: () => void;
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
  isOpen,
  onClose,
  roomState,
  currentMemberId,
  isHost,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onResync,
  onToggleHostControl,
  onOpenChat,
  onLoadSampleMovie,
  currentMedia,
  initialRoomCode = '',
  error,
  onClearError,
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'create' | 'samples'>('join');
  const [inputCode, setInputCode] = useState(initialRoomCode);
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('omniplay_user_name') || `User_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [hostOnlyControl, setHostOnlyControl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setInputCode(initialRoomCode.toUpperCase());
      setActiveTab('join');
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (userName.trim()) {
      localStorage.setItem('omniplay_user_name', userName.trim());
    }
  }, [userName]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!roomState?.code) return;
    navigator.clipboard.writeText(roomState.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!roomState?.code) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomState.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    onCreateRoom(userName || 'Host', hostOnlyControl);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    onClearError();
    onJoinRoom(inputCode.trim().toUpperCase(), userName || 'Guest');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Watch Party
                {roomState && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                    Live Room
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Watch movies together in real-time with synchronized play, pause & seek
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-6 py-3 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={onClearError}
              className="text-rose-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Active Room View */}
          {roomState ? (
            <div className="space-y-6">
              {/* Room Code Card */}
              <div className="bg-gradient-to-br from-sky-950/40 via-zinc-900 to-zinc-900 border border-sky-500/30 rounded-2xl p-5 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">
                  Party Room Code
                </span>
                <div className="mt-2 text-3xl sm:text-4xl font-mono font-black tracking-widest text-white selection:bg-sky-500">
                  {roomState.code}
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  Share this code or link with your friend to sync video playback!
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-semibold transition-all shadow-md active:scale-95"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all active:scale-95"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-sky-400" />}
                    <span>{copiedLink ? 'Invite Link Copied!' : 'Copy Invite Link'}</span>
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-400" />
                    <span>Participants ({roomState.members.length})</span>
                  </h3>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChat();
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Party Chat</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roomState.members.map((member: WatchPartyMember) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-zinc-950 shadow-xs"
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
                        <span>Online</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Media Status */}
              <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-sky-400" />
                    Room Movie:
                  </span>
                  <span className="font-medium text-zinc-200 truncate max-w-[220px]">
                    {roomState.mediaInfo?.name || currentMedia?.name || 'No video active yet'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  OmniPlay synchronizes playback frame-by-frame. Both viewers can load the same local file, or pick one of our shared test movies!
                </p>
              </div>

              {/* Host Settings & Controls */}
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
                        <span>Host-Only Playback Controls</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {roomState.hostOnlyControl
                          ? 'Only you can play, pause, or seek.'
                          : 'Collaborative: anyone in the room can pause or seek.'}
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleHostControl(!roomState.hostOnlyControl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        roomState.hostOnlyControl
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                          : 'bg-zinc-700/60 text-zinc-300 border-zinc-600 hover:bg-zinc-700'
                      }`}
                    >
                      {roomState.hostOnlyControl ? 'Locked' : 'Unlock All'}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
                <button
                  onClick={onResync}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-colors"
                  title="Resync to exact host time"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Force Resync</span>
                </button>

                <button
                  onClick={onLeaveRoom}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors ml-auto"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Leave Room</span>
                </button>
              </div>
            </div>
          ) : (
            /* Not in room: Tabs to Join or Create */
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="flex rounded-2xl bg-zinc-800/80 p-1 border border-zinc-700/60">
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'join'
                      ? 'bg-sky-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Join with Code
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'create'
                      ? 'bg-sky-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Create a Room
                </button>
                <button
                  onClick={() => setActiveTab('samples')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'samples'
                      ? 'bg-sky-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sample Movies
                </button>
              </div>

              {/* Tab 1: Join with Code */}
              {activeTab === 'join' && (
                <form onSubmit={handleJoinSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-300">
                      Room Code (6 characters)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="e.g. CINE74"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white font-mono text-center text-xl tracking-widest uppercase focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-zinc-600"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-300">Your Nickname</label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="e.g. Alex"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-sm transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Join Watch Party</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                    <p className="font-semibold text-zinc-300">Tip for seamless syncing:</p>
                    <p>
                      Both you and your friend should select the same video file (or load a sample movie from the Sample Movies tab) so you both see identical scenes!
                    </p>
                  </div>
                </form>
              )}

              {/* Tab 2: Create a Room */}
              {activeTab === 'create' && (
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-300">Host Nickname</label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="e.g. CinemaHost"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      required
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/60 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">
                        Host-Only Playback Controls
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Only you will be able to play, pause, or seek
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hostOnlyControl}
                        onChange={(e) => setHostOnlyControl(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500" />
                    </label>
                  </div>

                  {currentMedia ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                      <Film className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Will broadcast: <strong>{currentMedia.name}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        No media loaded yet. You can open files or pick a sample movie anytime!
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-sm transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Create Watch Party Room</span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Tab 3: Sample Movies */}
              {activeTab === 'samples' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    Want to test the Watch Party immediately with another browser tab or friend? Pick one of these ready-to-stream open movie clips:
                  </p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {SAMPLE_MOVIES.map((sample) => (
                      <div
                        key={sample.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-sky-500/40 transition-all group"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                            {sample.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 line-clamp-1">
                            {sample.description}
                          </div>
                          <span className="text-[10px] text-sky-400 font-semibold">
                            {sample.category} • {Math.floor(sample.duration / 60)}m {sample.duration % 60}s
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            onLoadSampleMovie(sample);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-zinc-950 text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Load</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
