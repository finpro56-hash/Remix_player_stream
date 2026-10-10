import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WatchPartyState,
  WatchPartyMember,
  WatchPartyMessage,
  WatchPartyMediaInfo,
  FloatingReaction,
} from '../types/media';

interface RemoteSyncPayload {
  action: 'play' | 'pause' | 'seek' | 'rate';
  currentTime: number;
  playbackRate: number;
  isPlaying: boolean;
  updatedAt: number;
  sender: {
    id: string;
    name: string;
  };
}

interface UseWatchPartyOptions {
  onRemotePlaybackSync?: (payload: RemoteSyncPayload) => void;
  onSystemNotification?: (message: string) => void;
}

export function useWatchParty(options: UseWatchPartyOptions = {}) {
  const { onRemotePlaybackSync, onSystemNotification } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<WatchPartyState | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [lastRemoteAction, setLastRemoteAction] = useState<{
    action: string;
    senderName: string;
    time: number;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const currentMember = roomState?.members.find((m) => m.id === currentMemberId);
  const isHost = Boolean(currentMember?.isHost || (roomState && roomState.hostId === currentMemberId));

  // Initialize or get WebSocket
  const getWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        // Wait for open
        const existingWs = wsRef.current;
        const onOpen = () => {
          existingWs.removeEventListener('open', onOpen);
          existingWs.removeEventListener('error', onError);
          resolve(existingWs);
        };
        const onError = (e: Event) => {
          existingWs.removeEventListener('open', onOpen);
          existingWs.removeEventListener('error', onError);
          reject(e);
        };
        existingWs.addEventListener('open', onOpen);
        existingWs.addEventListener('error', onError);
        return;
      }

      setIsConnecting(true);
      setError(null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        resolve(ws);
      };

      ws.onerror = (e) => {
        console.error('WatchParty WebSocket error:', e);
        setIsConnecting(false);
        setError('Failed to connect to party server. Check your connection.');
        reject(e);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleIncomingMessage(data);
        } catch (err) {
          console.error('Error parsing incoming WebSocket payload:', err);
        }
      };
    });
  }, []);

  // Process incoming server messages
  const handleIncomingMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'created':
      case 'joined': {
        setCurrentMemberId(data.memberId);
        setRoomState(data.room);
        setError(null);
        if (data.room?.playback && optionsRef.current.onRemotePlaybackSync) {
          optionsRef.current.onRemotePlaybackSync({
            action: data.room.playback.isPlaying ? 'play' : 'pause',
            currentTime: data.room.playback.currentTime,
            playbackRate: data.room.playback.playbackRate,
            isPlaying: data.room.playback.isPlaying,
            updatedAt: data.room.playback.updatedAt,
            sender: {
              id: 'system',
              name: 'Room Sync',
            },
          });
        }
        break;
      }

      case 'playback_sync': {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            playback: {
              isPlaying: data.isPlaying,
              currentTime: data.currentTime,
              updatedAt: data.updatedAt || Date.now(),
              playbackRate: data.playbackRate || 1,
            },
          };
        });

        if (data.sender && data.sender.name) {
          setLastRemoteAction({
            action: data.action,
            senderName: data.sender.name,
            time: Date.now(),
          });
        }

        if (optionsRef.current.onRemotePlaybackSync) {
          optionsRef.current.onRemotePlaybackSync(data);
        }
        break;
      }

      case 'member_joined': {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: data.members,
            messages: data.systemMessage
              ? [...prev.messages, data.systemMessage]
              : prev.messages,
          };
        });
        if (data.systemMessage && optionsRef.current.onSystemNotification) {
          optionsRef.current.onSystemNotification(data.systemMessage.text);
        }
        break;
      }

      case 'member_left': {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            hostId: data.newHostId || prev.hostId,
            members: data.members,
            messages: data.systemMessage
              ? [...prev.messages, data.systemMessage]
              : prev.messages,
          };
        });
        if (data.systemMessage && optionsRef.current.onSystemNotification) {
          optionsRef.current.onSystemNotification(data.systemMessage.text);
        }
        break;
      }

      case 'chat_message': {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...prev.messages, data.message],
          };
        });
        break;
      }

      case 'reaction': {
        const id = data.id || `react-${Date.now()}-${Math.random()}`;
        const newReaction: FloatingReaction = {
          id,
          emoji: data.emoji,
          senderName: data.senderName,
          senderColor: '#38bdf8',
          leftPercent: 15 + Math.random() * 70, // random spread
        };
        setReactions((prev) => [...prev, newReaction]);

        // Auto remove reaction after animation completes
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 3400);
        break;
      }

      case 'media_announce': {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            mediaInfo: data.mediaInfo,
            messages: data.systemMessage
              ? [...prev.messages, data.systemMessage]
              : prev.messages,
          };
        });
        if (data.systemMessage && optionsRef.current.onSystemNotification) {
          optionsRef.current.onSystemNotification(data.systemMessage.text);
        }
        break;
      }

      case 'settings_updated': {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            hostOnlyControl: data.hostOnlyControl,
            messages: data.systemMessage
              ? [...prev.messages, data.systemMessage]
              : prev.messages,
          };
        });
        if (data.systemMessage && optionsRef.current.onSystemNotification) {
          optionsRef.current.onSystemNotification(data.systemMessage.text);
        }
        break;
      }

      case 'action_rejected': {
        setError(data.message);
        if (optionsRef.current.onSystemNotification) {
          optionsRef.current.onSystemNotification(data.message);
        }
        break;
      }

      case 'error': {
        setError(data.message);
        break;
      }
    }
  }, []);

  // Actions
  const createRoom = useCallback(
    async (
      userName: string,
      hostOnlyControl: boolean = false,
      mediaInfo?: WatchPartyMediaInfo | null,
      currentTime: number = 0,
      isPlaying: boolean = false,
      playbackRate: number = 1
    ) => {
      try {
        const ws = await getWebSocket();
        ws.send(
          JSON.stringify({
            type: 'create',
            userName,
            hostOnlyControl,
            mediaInfo: mediaInfo || null,
            currentTime,
            isPlaying,
            playbackRate,
          })
        );
      } catch (err: any) {
        setError('Failed to create room. Please try again.');
      }
    },
    [getWebSocket]
  );

  const joinRoom = useCallback(
    async (
      roomCode: string,
      userName: string,
      mediaInfo?: WatchPartyMediaInfo | null
    ) => {
      try {
        const ws = await getWebSocket();
        ws.send(
          JSON.stringify({
            type: 'join',
            roomCode: roomCode.trim().toUpperCase(),
            userName,
            mediaInfo: mediaInfo || null,
          })
        );
      } catch (err: any) {
        setError('Failed to join room. Please check room code.');
      }
    },
    [getWebSocket]
  );

  const leaveRoom = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
      } catch {
        // ignore
      }
    }
    setRoomState(null);
    setCurrentMemberId(null);
    setReactions([]);
  }, []);

  const sendPlaybackSync = useCallback(
    (
      action: 'play' | 'pause' | 'seek' | 'rate',
      currentTime: number,
      playbackRate: number = 1
    ) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'playback_sync',
            action,
            currentTime,
            playbackRate,
          })
        );
      }
    },
    []
  );

  const sendHeartbeat = useCallback((currentTime: number, isPlaying: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'heartbeat',
          currentTime,
          isPlaying,
        })
      );
    }
  }, []);

  const sendMediaAnnounce = useCallback((mediaInfo: WatchPartyMediaInfo) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'media_announce',
          mediaInfo,
        })
      );
    }
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          text,
        })
      );
    }
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'reaction',
          emoji,
        })
      );
    }
  }, []);

  const setHostOnlyControl = useCallback((enabled: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'update_settings',
          hostOnlyControl: enabled,
        })
      );
    }
  }, []);

  const requestResync = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'sync_request',
        })
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    roomState,
    currentMemberId,
    currentMember,
    isHost,
    error,
    setError,
    reactions,
    lastRemoteAction,
    createRoom,
    joinRoom,
    leaveRoom,
    sendPlaybackSync,
    sendHeartbeat,
    sendMediaAnnounce,
    sendChatMessage,
    sendReaction,
    setHostOnlyControl,
    requestResync,
  };
}
