/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  FolderOpen,
  FilePlus,
  ListMusic,
  Sliders,
  Keyboard,
  ShieldCheck,
  Maximize,
  Users,
  Home,
  ArrowLeft,
  Play,
} from 'lucide-react';
import {
  MediaItem,
  VideoFilters,
  AspectRatioMode,
  EqualizerBand,
  LoopMode,
} from './types/media';
import { detectMediaType, SUBTITLE_EXTENSIONS } from './utils/formatters';
import { audioEngine, DEFAULT_EQ_BANDS, EQ_PRESETS } from './utils/audioEngine';
import { EmptyState } from './components/EmptyState';
import { VideoPlayer } from './components/VideoPlayer';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { EffectsModal } from './components/EffectsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { MediaInfoModal } from './components/MediaInfoModal';
import { ScreenshotModal } from './components/ScreenshotModal';
import { WatchPartyModal } from './components/WatchPartyModal';
import { WatchPartyDrawer } from './components/WatchPartyDrawer';
import { useWatchParty } from './hooks/useWatchParty';
import { createMediaItemFromSample, SampleMovie } from './utils/sampleMovies';

export default function App() {
  const [playlist, setPlaylist] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentView, setCurrentView] = useState<'home' | 'player'>('home');

  // Settings & state
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('original');
  const [videoFilters, setVideoFilters] = useState<VideoFilters>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hueRotate: 0,
    blur: 0,
    invert: false,
    sepia: false,
    flipHorizontal: false,
    flipVertical: false,
  });

  // Audio Equalizer & Boost
  const [volumeBoost, setVolumeBoost] = useState<number>(1.0);
  const [eqBands, setEqBands] = useState<EqualizerBand[]>(DEFAULT_EQ_BANDS);

  // Playback playlist modes
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);

  // Drawers and Modals
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Screenshot modal
  const [screenshotData, setScreenshotData] = useState<{
    isOpen: boolean;
    imageUrl: string | null;
    time: number;
  }>({
    isOpen: false,
    imageUrl: null,
    time: 0,
  });

  // Watch Party & Sync State
  const [isWatchPartyOpen, setIsWatchPartyOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [remoteSyncTarget, setRemoteSyncTarget] = useState<any>(null);
  const [partyToast, setPartyToast] = useState<string | null>(null);

  const showPartyToast = (msg: string) => {
    setPartyToast(msg);
    setTimeout(() => {
      setPartyToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const watchParty = useWatchParty({
    onRemotePlaybackSync: (payload) => {
      setRemoteSyncTarget(payload);
    },
    onSystemNotification: (msg) => {
      showPartyToast(msg);
    },
  });

  // Check URL query parameters for direct invite link (?room=CODE)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setInitialRoomCode(roomParam.toUpperCase());
        setIsWatchPartyOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Hidden inputs for header buttons
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);
  const headerFolderInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to load files into playlist
  const handleAddFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const newItems: MediaItem[] = [];

    fileList.forEach((file) => {
      const { isVideo, isAudio, extension } = detectMediaType(file.name, file.type);
      // Skip subtitle files from playlist; they are handled separately
      if (SUBTITLE_EXTENSIONS.has(extension)) return;

      const url = URL.createObjectURL(file);
      newItems.push({
        id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        url,
        size: file.size,
        type: file.type,
        extension,
        isVideo,
        isAudio,
        bookmarks: [],
      });
    });

    if (newItems.length > 0) {
      setPlaylist((prev) => {
        const nextList = [...prev, ...newItems];
        // If nothing was playing, play first new track
        if (prev.length === 0) {
          setCurrentIndex(0);
        }
        return nextList;
      });
      setCurrentView('player');
    }
  };

  // Add individual media item (e.g. from demo generator)
  const handleLoadMediaItem = (item: MediaItem) => {
    setPlaylist((prev) => {
      const nextList = [item, ...prev];
      setCurrentIndex(0);
      return nextList;
    });
    setCurrentView('player');
  };

  // Switch Track
  const handleSelectTrack = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setCurrentView('player');
    }
  };

  // Previous & Next navigation
  const handlePreviousTrack = () => {
    if (playlist.length === 0) return;
    if (isShuffle) {
      const rand = Math.floor(Math.random() * playlist.length);
      setCurrentIndex(rand);
    } else {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : playlist.length - 1));
    }
  };

  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    if (loopMode === 'one') {
      // Loop same track
      return;
    }
    if (isShuffle) {
      const rand = Math.floor(Math.random() * playlist.length);
      setCurrentIndex(rand);
    } else {
      if (currentIndex < playlist.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else if (loopMode === 'all') {
        setCurrentIndex(0);
      }
    }
  };

  // Remove track
  const handleRemoveTrack = (id: string) => {
    setPlaylist((prev) => {
      const itemIdx = prev.findIndex((p) => p.id === id);
      const updated = prev.filter((p) => p.id !== id);
      if (itemIdx === currentIndex && updated.length > 0) {
        setCurrentIndex(Math.min(currentIndex, updated.length - 1));
      }
      return updated;
    });
  };

  // Clear playlist
  const handleClearPlaylist = () => {
    setPlaylist([]);
    setCurrentIndex(0);
  };

  // Toggle loop mode
  const handleToggleLoop = () => {
    setLoopMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  // Audio Equalizer handlers
  const handleBandChange = (index: number, gain: number) => {
    setEqBands((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], gain };
      return next;
    });
    audioEngine.setBandGain(index, gain);
  };

  const handleApplyEqPreset = (presetKey: string) => {
    const presetValues = EQ_PRESETS[presetKey] || EQ_PRESETS.flat;
    setEqBands((prev) =>
      prev.map((band, idx) => ({
        ...band,
        gain: presetValues[idx] || 0,
      }))
    );
    audioEngine.applyPreset(presetValues);
  };

  const handleVolumeBoostChange = (boost: number) => {
    setVolumeBoost(boost);
    audioEngine.setBoost(boost);
  };

  // Bookmarks handlers for currently playing media
  const currentMedia = playlist[currentIndex] || null;

  // Broadcast loaded media to party room
  useEffect(() => {
    if (watchParty.roomState && currentMedia) {
      watchParty.sendMediaAnnounce({
        name: currentMedia.name,
        duration: currentMedia.duration || 0,
        size: currentMedia.size,
        isDemo: currentMedia.isDemo,
      });
    }
  }, [currentMedia?.name, watchParty.roomState?.code]);

  const handleCreateRoom = (userName: string, hostOnlyControl: boolean) => {
    const video = document.querySelector('video, audio') as HTMLMediaElement | null;
    const curTime = video ? video.currentTime : 0;
    const isPlaying = video ? !video.paused : false;
    const rate = video ? video.playbackRate : 1;

    watchParty.createRoom(
      userName,
      hostOnlyControl,
      currentMedia
        ? {
            name: currentMedia.name,
            duration: currentMedia.duration || 0,
            size: currentMedia.size,
            isDemo: currentMedia.isDemo,
          }
        : null,
      curTime,
      isPlaying,
      rate
    );
  };

  const handleJoinRoom = (roomCode: string, userName: string) => {
    watchParty.joinRoom(
      roomCode,
      userName,
      currentMedia
        ? {
            name: currentMedia.name,
            duration: currentMedia.duration || 0,
            size: currentMedia.size,
            isDemo: currentMedia.isDemo,
          }
        : null
    );
  };

  const handleLoadSampleMovie = (sample: SampleMovie) => {
    const newItem = createMediaItemFromSample(sample);
    handleLoadMediaItem(newItem);
    showPartyToast(`Loaded sample movie: ${sample.title}`);
  };

  const handleAddBookmark = (time: number, label: string) => {
    if (!currentMedia) return;
    const newBm = {
      id: `bm-${Date.now()}`,
      time,
      label,
      createdAt: Date.now(),
    };
    setPlaylist((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? { ...item, bookmarks: [...item.bookmarks, newBm] }
          : item
      )
    );
  };

  const handleDeleteBookmark = (id: string) => {
    if (!currentMedia) return;
    setPlaylist((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? { ...item, bookmarks: item.bookmarks.filter((b) => b.id !== id) }
          : item
      )
    );
  };

  const handleSeekToBookmark = (time: number) => {
    const video = document.querySelector('video, audio') as HTMLMediaElement | null;
    if (video) {
      video.currentTime = time;
    }
  };

  // Global Drag & Drop Handler
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleAddFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/95 px-4 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-2 group text-left cursor-pointer hover:opacity-90 transition-opacity"
            title="Go to Home Screen"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-wide text-white group-hover:text-sky-300 transition-colors hidden sm:inline">
              OmniPlay
            </span>
          </button>

          {/* Dedicated Back to Home Button when viewing player */}
          {currentView === 'player' && (
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border border-sky-500/40 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Return to Home Screen & Library"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
              <Home className="w-3.5 h-3.5 text-zinc-400" />
              <span>Back to Home</span>
            </button>
          )}

          {/* Navigation Controls: Home vs Now Playing */}
          <div className="flex items-center gap-1 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800/80">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'home'
                  ? 'bg-sky-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
              }`}
              title="Return to Home Screen"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            {playlist.length > 0 && currentMedia && (
              <button
                onClick={() => setCurrentView('player')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentView === 'player'
                    ? 'bg-sky-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
                }`}
                title="Return to Video Player"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Now Playing</span>
                <span className="text-[10px] opacity-75 font-mono max-w-[110px] truncate hidden lg:inline">
                  ({currentMedia.name})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Watch Party Room Status / Trigger */}
          {watchParty.roomState ? (
            <button
              onClick={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/50 shadow-md transition-all"
              title="Watch Party Active: Open Live Chat & Room Options"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">{watchParty.roomState.code}</span>
              <span className="text-[11px] text-zinc-300 hidden sm:inline">
                ({watchParty.roomState.members.length})
              </span>
              <Users className="w-3.5 h-3.5 text-sky-400" />
            </button>
          ) : (
            <button
              onClick={() => setIsWatchPartyOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 text-sky-300 border border-sky-500/40 transition-colors shadow-xs"
              title="Watch movies together in real-time"
            >
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Watch Together</span>
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-zinc-950 text-[10px] font-bold">
                Party
              </span>
            </button>
          )}

          {/* Open Files */}
          <input
            type="file"
            ref={headerFileInputRef}
            multiple
            accept="video/*,audio/*,.mkv,.avi,.flv,.wmv,.mov,.ts,.3gp,.opus,.weba,.m4v"
            onChange={(e) => {
              if (e.target.files) handleAddFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            onClick={() => headerFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors shadow-xs"
            title="Open local files"
          >
            <FilePlus className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Choose Files</span>
          </button>

          {/* Open Folder */}
          <input
            type="file"
            ref={headerFolderInputRef}
            // @ts-expect-error webkitdirectory is standard for directory picker
            webkitdirectory="true"
            directory="true"
            onChange={(e) => {
              if (e.target.files) handleAddFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            onClick={() => headerFolderInputRef.current?.click()}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors"
            title="Import folder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Folder</span>
          </button>

          {/* Effects & EQ */}
          <button
            onClick={() => setIsEffectsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors"
            title="Audio Equalizer & Video Filters"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Audio & FX</span>
          </button>

          {/* Queue / Playlist Drawer Trigger */}
          <button
            onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isPlaylistOpen
                ? 'bg-sky-950/60 text-sky-300 border-sky-600/50'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700/60'
            }`}
            title="Toggle Queue"
          >
            <ListMusic className="w-3.5 h-3.5 text-sky-400" />
            <span>Queue</span>
            {playlist.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-zinc-950 text-[10px] font-bold">
                {playlist.length}
              </span>
            )}
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Player Display Area */}
      <main className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {currentView === 'home' || playlist.length === 0 || !currentMedia ? (
          <EmptyState
            onAddFiles={(files) => {
              handleAddFiles(files);
              setCurrentView('player');
            }}
            onLoadMediaItem={(item) => {
              handleLoadMediaItem(item);
              setCurrentView('player');
            }}
            onOpenWatchParty={() => setIsWatchPartyOpen(true)}
            hasLoadedMedia={Boolean(currentMedia)}
            onReturnToPlayer={() => setCurrentView('player')}
            currentMediaName={currentMedia?.name}
          />
        ) : (
          <VideoPlayer
            currentMedia={currentMedia}
            videoFilters={videoFilters}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            onOpenEffects={() => setIsEffectsOpen(true)}
            onOpenInfo={() => setIsInfoOpen(true)}
            onOpenBookmarks={() => setIsBookmarksOpen(true)}
            onAddBookmark={handleAddBookmark}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            onPreviousTrack={handlePreviousTrack}
            onNextTrack={handleNextTrack}
            hasPrevious={playlist.length > 1}
            hasNext={playlist.length > 1}
            volumeBoost={volumeBoost}
            onCaptureScreenshot={(dataUrl, time) => {
              setScreenshotData({
                isOpen: true,
                imageUrl: dataUrl,
                time,
              });
            }}
            onPlaybackAction={watchParty.sendPlaybackSync}
            onReportTime={watchParty.sendHeartbeat}
            remoteSyncTarget={remoteSyncTarget}
            remoteActionNotification={watchParty.lastRemoteAction}
            watchPartyState={watchParty.roomState}
            reactions={watchParty.reactions}
            onSendReaction={watchParty.sendReaction}
            onOpenWatchParty={() => setIsWatchPartyOpen(true)}
            onOpenPartyDrawer={() => setIsChatDrawerOpen(true)}
            onBackToHome={() => setCurrentView('home')}
          />
        )}
      </main>

      {/* Slide-out Drawers & Modals */}
      <PlaylistDrawer
        isOpen={isPlaylistOpen}
        onClose={() => setIsPlaylistOpen(false)}
        onBackToHome={() => {
          setIsPlaylistOpen(false);
          setCurrentView('home');
        }}
        playlist={playlist}
        currentIndex={currentIndex}
        onSelectTrack={handleSelectTrack}
        onRemoveTrack={handleRemoveTrack}
        onClearPlaylist={handleClearPlaylist}
        onAddFiles={handleAddFiles}
        loopMode={loopMode}
        onToggleLoop={handleToggleLoop}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
      />

      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        onBackToHome={() => {
          setIsBookmarksOpen(false);
          setCurrentView('home');
        }}
        bookmarks={currentMedia?.bookmarks || []}
        currentTime={
          (document.querySelector('video, audio') as HTMLMediaElement | null)?.currentTime || 0
        }
        onAddBookmark={handleAddBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onSeekTo={handleSeekToBookmark}
      />

      <EffectsModal
        isOpen={isEffectsOpen}
        onClose={() => setIsEffectsOpen(false)}
        onBackToHome={() => {
          setIsEffectsOpen(false);
          setCurrentView('home');
        }}
        filters={videoFilters}
        onFiltersChange={setVideoFilters}
        bands={eqBands}
        onBandChange={handleBandChange}
        onApplyEqPreset={handleApplyEqPreset}
        volumeBoost={volumeBoost}
        onVolumeBoostChange={handleVolumeBoostChange}
        isVideo={currentMedia?.isVideo ?? true}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        onBackToHome={() => {
          setIsShortcutsOpen(false);
          setCurrentView('home');
        }}
      />

      <MediaInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        onBackToHome={() => {
          setIsInfoOpen(false);
          setCurrentView('home');
        }}
        item={currentMedia}
      />

      <ScreenshotModal
        isOpen={screenshotData.isOpen}
        onClose={() => setScreenshotData({ isOpen: false, imageUrl: null, time: 0 })}
        onBackToHome={() => {
          setScreenshotData({ isOpen: false, imageUrl: null, time: 0 });
          setCurrentView('home');
        }}
        imageUrl={screenshotData.imageUrl}
        videoTitle={currentMedia?.name || 'Video'}
        timestamp={screenshotData.time}
      />

      {/* Watch Party Modal & Live Drawer */}
      <WatchPartyModal
        isOpen={isWatchPartyOpen}
        onClose={() => setIsWatchPartyOpen(false)}
        onBackToHome={() => {
          setIsWatchPartyOpen(false);
          setCurrentView('home');
        }}
        roomState={watchParty.roomState}
        currentMemberId={watchParty.currentMemberId}
        isHost={watchParty.isHost}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={watchParty.leaveRoom}
        onResync={watchParty.requestResync}
        onToggleHostControl={watchParty.setHostOnlyControl}
        onOpenChat={() => setIsChatDrawerOpen(true)}
        onLoadSampleMovie={handleLoadSampleMovie}
        currentMedia={currentMedia}
        initialRoomCode={initialRoomCode}
        error={watchParty.error}
        onClearError={() => watchParty.setError(null)}
      />

      <WatchPartyDrawer
        isOpen={isChatDrawerOpen}
        onClose={() => setIsChatDrawerOpen(false)}
        onBackToHome={() => {
          setIsChatDrawerOpen(false);
          setCurrentView('home');
        }}
        roomState={watchParty.roomState}
        currentMemberId={watchParty.currentMemberId}
        isHost={watchParty.isHost}
        onSendMessage={watchParty.sendChatMessage}
        onSendReaction={watchParty.sendReaction}
        onResync={watchParty.requestResync}
        onLeaveRoom={watchParty.leaveRoom}
        onToggleHostControl={watchParty.setHostOnlyControl}
      />

      {/* Party Notification Toast */}
      {partyToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-900/95 border border-sky-500/40 text-sky-300 rounded-2xl text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" />
          <span>{partyToast}</span>
        </div>
      )}
    </div>
  );
}
