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

  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;
  const currentMemberIdRef = useRef(currentMemberId);
  currentMemberIdRef.current = currentMemberId;

  // Send identify when roomState or currentMemberId changes and WS is open
  useEffect(() => {
    if (
      roomState?.code &&
      currentMemberId &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'identify',
            roomCode: roomState.code,
            memberId: currentMemberId,
          })
        );
      } catch {
        // ignore
      }
    }
  }, [roomState?.code, currentMemberId]);

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
        if (roomStateRef.current?.code && currentMemberIdRef.current) {
          try {
            ws.send(
              JSON.stringify({
                type: 'identify',
                roomCode: roomStateRef.current.code,
                memberId: currentMemberIdRef.current,
              })
            );
          } catch {
            // ignore
          }
        }
        resolve(ws);
      };

      ws.onerror = (e) => {
        console.warn('WatchParty WebSocket error (falling back to HTTP/polling):', e);
        setIsConnecting(false);
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
        const res = await fetch('/api/rooms/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userName,
            hostOnlyControl,
            mediaInfo: mediaInfo || null,
            currentTime,
            isPlaying,
            playbackRate,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          handleIncomingMessage(data);
          getWebSocket().catch(() => {});
          return;
        }
      } catch (netErr) {
        console.warn('HTTP create room failed, falling back to local room creation:', netErr);
      }

      // Fallback local room creation so user never gets stuck with an error
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const memberId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const memberName = (userName || 'Host').trim().substring(0, 24);
      const color = '#38bdf8';

      const localRoom: WatchPartyState = {
        code,
        hostId: memberId,
        hostOnlyControl: Boolean(hostOnlyControl),
        mediaInfo: mediaInfo || null,
        playback: {
          isPlaying: Boolean(isPlaying),
          currentTime: Number(currentTime) || 0,
          updatedAt: Date.now(),
          playbackRate: Number(playbackRate) || 1,
        },
        members: [
          {
            id: memberId,
            name: memberName,
            color,
            isHost: true,
            currentTime: Number(currentTime) || 0,
            isPlaying: Boolean(isPlaying),
          },
        ],
        messages: [
          {
            id: `sys-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderColor: '#38bdf8',
            text: `Room ${code} created. Share the code with a friend to watch together!`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ],
      };

      setCurrentMemberId(memberId);
      setRoomState(localRoom);
      setError(null);
      if (optionsRef.current.onRemotePlaybackSync) {
        optionsRef.current.onRemotePlaybackSync({
          action: localRoom.playback.isPlaying ? 'play' : 'pause',
          currentTime: localRoom.playback.currentTime,
          playbackRate: localRoom.playback.playbackRate,
          isPlaying: localRoom.playback.isPlaying,
          updatedAt: localRoom.playback.updatedAt,
          sender: { id: 'system', name: 'Room Sync' },
        });
      }
      getWebSocket().catch(() => {});
    },
    [handleIncomingMessage, getWebSocket]
  );

  const joinRoom = useCallback(
    async (
      roomCode: string,
      userName: string,
      mediaInfo?: WatchPartyMediaInfo | null
    ) => {
      const code = roomCode.trim().toUpperCase();
      try {
        const res = await fetch('/api/rooms/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: code,
            userName,
            mediaInfo: mediaInfo || null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          handleIncomingMessage(data);
          getWebSocket().catch(() => {});
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || `Room "${code}" not found. Please verify the code.`);
          return;
        }
      } catch (netErr) {
        console.warn('HTTP join room network error:', netErr);
        setError(`Failed to connect to server to join room "${code}". Check your connection.`);
      }
    },
    [handleIncomingMessage, getWebSocket]
  );

  const leaveRoom = useCallback(() => {
    if (roomState?.code && currentMemberId) {
      fetch(`/api/rooms/${roomState.code}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'leave', memberId: currentMemberId }),
      }).catch(() => {});
    }
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
  }, [roomState?.code, currentMemberId]);

  const sendAction = useCallback(
    async (actionType: string, payload: any) => {
      if (!roomState?.code || !currentMemberId) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (actionType === 'playback_sync') {
          wsRef.current.send(JSON.stringify({ type: 'playback_sync', ...payload }));
          return;
        }
        if (actionType === 'media_announce') {
          wsRef.current.send(JSON.stringify({ type: 'media_announce', ...payload }));
          return;
        }
        if (actionType === 'chat_message') {
          wsRef.current.send(JSON.stringify({ type: 'chat_message', ...payload }));
          return;
        }
        if (actionType === 'reaction') {
          wsRef.current.send(JSON.stringify({ type: 'reaction', ...payload }));
          return;
        }
        if (actionType === 'update_settings') {
          wsRef.current.send(JSON.stringify({ type: 'update_settings', ...payload }));
          return;
        }
        if (actionType === 'sync_request') {
          wsRef.current.send(JSON.stringify({ type: 'sync_request' }));
          return;
        }
      }

      // Fallback to REST
      try {
        await fetch(`/api/rooms/${roomState.code}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: actionType, memberId: currentMemberId, ...payload }),
        });
      } catch (err) {
        console.error('Action error:', err);
      }
    },
    [roomState?.code, currentMemberId]
  );

  const sendPlaybackSync = useCallback(
    (
      action: 'play' | 'pause' | 'seek' | 'rate',
      currentTime: number,
      playbackRate: number = 1
    ) => {
      sendAction('playback_sync', { action, currentTime, playbackRate });
    },
    [sendAction]
  );

  const sendHeartbeat = useCallback((_currentTime: number, _isPlaying: boolean) => {
    // optional
  }, []);

  const sendMediaAnnounce = useCallback((mediaInfo: WatchPartyMediaInfo) => {
    sendAction('media_announce', { mediaInfo });
  }, [sendAction]);

  const sendChatMessage = useCallback((text: string) => {
    sendAction('chat_message', { text });
  }, [sendAction]);

  const sendReaction = useCallback((emoji: string) => {
    sendAction('reaction', { emoji });
  }, [sendAction]);

  const setHostOnlyControl = useCallback((enabled: boolean) => {
    sendAction('update_settings', { hostOnlyControl: enabled });
  }, [sendAction]);

  const requestResync = useCallback(() => {
    sendAction('sync_request', {});
  }, [sendAction]);

  // Polling state when in room
  useEffect(() => {
    if (!roomState?.code || !currentMemberId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomState.code}/state`);
        if (res.ok) {
          const data = await res.json();
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              hostId: data.hostId,
              hostOnlyControl: data.hostOnlyControl,
              mediaInfo: data.mediaInfo,
              members: data.members,
              messages: data.messages,
            };
          });
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [roomState?.code, currentMemberId]);

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
