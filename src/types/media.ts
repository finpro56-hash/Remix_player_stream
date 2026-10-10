export interface MediaBookmark {
  id: string;
  time: number;
  label: string;
  createdAt: number;
}

export interface MediaItem {
  id: string;
  file?: File;
  name: string;
  url: string;
  size: number;
  type: string;
  extension: string;
  isVideo: boolean;
  isAudio: boolean;
  duration?: number;
  width?: number;
  height?: number;
  isDemo?: boolean;
  bookmarks: MediaBookmark[];
}

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  name: string;
  cues: SubtitleCue[];
  delaySeconds: number; // offset in seconds (can be positive or negative)
}

export interface VideoFilters {
  brightness: number; // default 100%
  contrast: number; // default 100%
  saturation: number; // default 100%
  hueRotate: number; // default 0deg
  blur: number; // default 0px
  invert: boolean;
  sepia: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface EqualizerBand {
  id: string;
  freq: number;
  label: string;
  gain: number; // dB, -12 to +12
}

export type AspectRatioMode = 'original' | '16:9' | '4:3' | '21:9' | 'cover' | 'fill';

export type VisualizerMode = 'bars' | 'wave' | 'radial' | 'particles';

export type LoopMode = 'off' | 'all' | 'one';

export interface WatchPartyMember {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  currentTime?: number;
  isPlaying?: boolean;
}

export interface WatchPartyMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface WatchPartyMediaInfo {
  name: string;
  duration: number;
  url?: string;
  isDemo?: boolean;
  size?: number;
}

export interface WatchPartyState {
  code: string;
  hostId: string;
  hostOnlyControl: boolean;
  mediaInfo: WatchPartyMediaInfo | null;
  playback: {
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
    playbackRate: number;
  };
  members: WatchPartyMember[];
  messages: WatchPartyMessage[];
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  senderColor: string;
  leftPercent: number;
}
