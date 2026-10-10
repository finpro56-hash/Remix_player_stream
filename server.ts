import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

interface Member {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  currentTime: number;
  isPlaying: boolean;
  ws: WebSocket;
}

interface RoomMediaInfo {
  name: string;
  duration: number;
  url?: string;
  isDemo?: boolean;
  size?: number;
}

interface RoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface Room {
  code: string;
  hostId: string;
  hostOnlyControl: boolean;
  createdAt: number;
  mediaInfo: RoomMediaInfo | null;
  playback: {
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
    playbackRate: number;
  };
  messages: RoomMessage[];
  members: Map<string, Member>;
}

const rooms = new Map<string, Room>();

const USER_COLORS = [
  '#38bdf8', // sky
  '#f43f5e', // rose
  '#a855f7', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSanitizedMembers(room: Room) {
  return Array.from(room.members.values()).map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    isHost: m.isHost,
    currentTime: m.currentTime,
    isPlaying: m.isPlaying,
  }));
}

function computeEstimatedTime(room: Room): number {
  if (!room.playback.isPlaying) {
    return room.playback.currentTime;
  }
  const elapsedSec = (Date.now() - room.playback.updatedAt) / 1000;
  return room.playback.currentTime + elapsedSec * room.playback.playbackRate;
}

function broadcastToRoom(room: Room, message: unknown, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  room.members.forEach((member) => {
    if (member.ws !== excludeWs && member.ws.readyState === WebSocket.OPEN) {
      try {
        member.ws.send(payload);
      } catch (err) {
        console.error('Failed to send message to client:', err);
      }
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API status and room lookup endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json({
      code: room.code,
      memberCount: room.members.size,
      mediaInfo: room.mediaInfo,
      hostOnlyControl: room.hostOnlyControl,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    let currentMemberId: string | null = null;

    ws.on('message', (raw: string) => {
      try {
        const data = JSON.parse(raw.toString());

        switch (data.type) {
          case 'create': {
            let code = generateRoomCode();
            while (rooms.has(code)) {
              code = generateRoomCode();
            }

            const memberId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const memberName = (data.userName || 'Host').trim().substring(0, 24);
            const color = getRandomColor();

            const newMember: Member = {
              id: memberId,
              name: memberName,
              color,
              isHost: true,
              currentTime: Number(data.currentTime) || 0,
              isPlaying: Boolean(data.isPlaying),
              ws,
            };

            const room: Room = {
              code,
              hostId: memberId,
              hostOnlyControl: Boolean(data.hostOnlyControl),
              createdAt: Date.now(),
              mediaInfo: data.mediaInfo || null,
              playback: {
                isPlaying: Boolean(data.isPlaying),
                currentTime: Number(data.currentTime) || 0,
                updatedAt: Date.now(),
                playbackRate: Number(data.playbackRate) || 1,
              },
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
              members: new Map([[memberId, newMember]]),
            };

            rooms.set(code, room);
            currentRoomCode = code;
            currentMemberId = memberId;

            ws.send(
              JSON.stringify({
                type: 'created',
                roomCode: code,
                memberId,
                member: {
                  id: memberId,
                  name: memberName,
                  color,
                  isHost: true,
                },
                room: {
                  code,
                  hostId: memberId,
                  hostOnlyControl: room.hostOnlyControl,
                  mediaInfo: room.mediaInfo,
                  playback: room.playback,
                  members: getSanitizedMembers(room),
                  messages: room.messages,
                },
              })
            );
            break;
          }

          case 'join': {
            const code = (data.roomCode || '').toUpperCase().trim();
            const room = rooms.get(code);

            if (!room) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: `Room "${code}" not found. Please verify the room code.`,
                })
              );
              return;
            }

            const memberId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const memberName = (data.userName || `Guest ${room.members.size + 1}`).trim().substring(0, 24);
            const color = getRandomColor();

            const newMember: Member = {
              id: memberId,
              name: memberName,
              color,
              isHost: false,
              currentTime: room.playback.currentTime,
              isPlaying: room.playback.isPlaying,
              ws,
            };

            room.members.set(memberId, newMember);
            currentRoomCode = code;
            currentMemberId = memberId;

            // System message
            const joinMsg: RoomMessage = {
              id: `sys-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderColor: color,
              text: `${memberName} joined the party!`,
              timestamp: Date.now(),
              isSystem: true,
            };
            room.messages.push(joinMsg);
            if (room.messages.length > 100) room.messages.shift();

            // Send joined payload to new user with calculated estimated time
            const estTime = computeEstimatedTime(room);
            ws.send(
              JSON.stringify({
                type: 'joined',
                roomCode: code,
                memberId,
                member: {
                  id: memberId,
                  name: memberName,
                  color,
                  isHost: false,
                },
                room: {
                  code,
                  hostId: room.hostId,
                  hostOnlyControl: room.hostOnlyControl,
                  mediaInfo: room.mediaInfo,
                  playback: {
                    ...room.playback,
                    currentTime: estTime,
                  },
                  members: getSanitizedMembers(room),
                  messages: room.messages,
                },
              })
            );

            // Broadcast to other users
            broadcastToRoom(
              room,
              {
                type: 'member_joined',
                member: {
                  id: memberId,
                  name: memberName,
                  color,
                  isHost: false,
                },
                members: getSanitizedMembers(room),
                systemMessage: joinMsg,
              },
              ws
            );
            break;
          }

          case 'playback_sync': {
            if (!currentRoomCode || !currentMemberId) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const member = room.members.get(currentMemberId);
            if (!member) return;

            if (room.hostOnlyControl && !member.isHost) {
              ws.send(
                JSON.stringify({
                  type: 'action_rejected',
                  message: 'Host has enabled "Host-Only Playback Controls".',
                })
              );
              return;
            }

            const { action, currentTime, playbackRate } = data;
            const targetTime = typeof currentTime === 'number' ? currentTime : room.playback.currentTime;
            const targetRate = typeof playbackRate === 'number' ? playbackRate : room.playback.playbackRate;

            if (action === 'play') {
              room.playback.isPlaying = true;
              room.playback.currentTime = targetTime;
              room.playback.updatedAt = Date.now();
            } else if (action === 'pause') {
              room.playback.isPlaying = false;
              room.playback.currentTime = targetTime;
              room.playback.updatedAt = Date.now();
            } else if (action === 'seek') {
              room.playback.currentTime = targetTime;
              room.playback.updatedAt = Date.now();
            } else if (action === 'rate') {
              room.playback.playbackRate = targetRate;
              room.playback.currentTime = targetTime;
              room.playback.updatedAt = Date.now();
            }

            // Broadcast playback update to everyone except sender
            broadcastToRoom(
              room,
              {
                type: 'playback_sync',
                action,
                currentTime: targetTime,
                playbackRate: room.playback.playbackRate,
                isPlaying: room.playback.isPlaying,
                updatedAt: room.playback.updatedAt,
                sender: {
                  id: member.id,
                  name: member.name,
                },
              },
              ws
            );
            break;
          }

          case 'sync_request': {
            if (!currentRoomCode) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const estTime = computeEstimatedTime(room);
            ws.send(
              JSON.stringify({
                type: 'playback_sync',
                action: room.playback.isPlaying ? 'play' : 'pause',
                currentTime: estTime,
                playbackRate: room.playback.playbackRate,
                isPlaying: room.playback.isPlaying,
                updatedAt: Date.now(),
                sender: {
                  id: 'system',
                  name: 'System Sync',
                },
              })
            );
            break;
          }

          case 'heartbeat': {
            if (!currentRoomCode || !currentMemberId) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const member = room.members.get(currentMemberId);
            if (member) {
              member.currentTime = Number(data.currentTime) || 0;
              member.isPlaying = Boolean(data.isPlaying);

              // If host sends heartbeat and playback is active, keep server time calibrated
              if (member.isHost && typeof data.currentTime === 'number') {
                room.playback.currentTime = data.currentTime;
                room.playback.updatedAt = Date.now();
              }
            }
            break;
          }

          case 'media_announce': {
            if (!currentRoomCode || !currentMemberId) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const member = room.members.get(currentMemberId);
            if (!member) return;

            room.mediaInfo = data.mediaInfo || null;

            const sysMsg: RoomMessage = {
              id: `sys-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderColor: member.color,
              text: `${member.name} loaded "${data.mediaInfo?.name || 'media file'}"`,
              timestamp: Date.now(),
              isSystem: true,
            };
            room.messages.push(sysMsg);
            if (room.messages.length > 100) room.messages.shift();

            broadcastToRoom(room, {
              type: 'media_announce',
              mediaInfo: room.mediaInfo,
              sender: {
                id: member.id,
                name: member.name,
              },
              systemMessage: sysMsg,
            });
            break;
          }

          case 'chat_message': {
            if (!currentRoomCode || !currentMemberId) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const member = room.members.get(currentMemberId);
            if (!member) return;

            const text = (data.text || '').trim().substring(0, 400);
            if (!text) return;

            const newMsg: RoomMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              senderId: member.id,
              senderName: member.name,
              senderColor: member.color,
              text,
              timestamp: Date.now(),
            };

            room.messages.push(newMsg);
            if (room.messages.length > 100) room.messages.shift();

            broadcastToRoom(room, {
              type: 'chat_message',
              message: newMsg,
            });
            break;
          }

          case 'reaction': {
            if (!currentRoomCode || !currentMemberId) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const member = room.members.get(currentMemberId);
            if (!member) return;

            const emoji = (data.emoji || '🍿').substring(0, 8);

            broadcastToRoom(room, {
              type: 'reaction',
              id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              senderId: member.id,
              senderName: member.name,
              emoji,
              timestamp: Date.now(),
            });
            break;
          }

          case 'update_settings': {
            if (!currentRoomCode || !currentMemberId) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;

            const member = room.members.get(currentMemberId);
            if (!member || !member.isHost) return;

            if (typeof data.hostOnlyControl === 'boolean') {
              room.hostOnlyControl = data.hostOnlyControl;
              const sysMsg: RoomMessage = {
                id: `sys-${Date.now()}`,
                senderId: 'system',
                senderName: 'System',
                senderColor: '#38bdf8',
                text: room.hostOnlyControl
                  ? 'Host enabled Host-Only playback controls.'
                  : 'Host enabled Collaborative playback (anyone can control).',
                timestamp: Date.now(),
                isSystem: true,
              };
              room.messages.push(sysMsg);

              broadcastToRoom(room, {
                type: 'settings_updated',
                hostOnlyControl: room.hostOnlyControl,
                systemMessage: sysMsg,
              });
            }
            break;
          }

          case 'leave': {
            handleLeave();
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    const handleLeave = () => {
      if (!currentRoomCode || !currentMemberId) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      const member = room.members.get(currentMemberId);
      if (!member) return;

      room.members.delete(currentMemberId);

      // If room is empty, clean up
      if (room.members.size === 0) {
        rooms.delete(currentRoomCode);
      } else {
        // If host left, assign next member as host
        let newHostAssigned = false;
        if (member.isHost) {
          const nextMember = room.members.values().next().value;
          if (nextMember) {
            nextMember.isHost = true;
            room.hostId = nextMember.id;
            newHostAssigned = true;
          }
        }

        const leaveMsg: RoomMessage = {
          id: `sys-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderColor: member.color,
          text: `${member.name} left the party.`,
          timestamp: Date.now(),
          isSystem: true,
        };
        room.messages.push(leaveMsg);

        broadcastToRoom(room, {
          type: 'member_left',
          memberId: currentMemberId,
          memberName: member.name,
          members: getSanitizedMembers(room),
          newHostId: newHostAssigned ? room.hostId : undefined,
          systemMessage: leaveMsg,
        });
      }

      currentRoomCode = null;
      currentMemberId = null;
    };

    ws.on('close', () => {
      handleLeave();
    });

    ws.on('error', (err) => {
      console.error('WebSocket connection error:', err);
      handleLeave();
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 OmniPlay server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
