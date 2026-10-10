import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
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
const ROOMS_FILE = path.join(__dirname, 'rooms.json');

function loadPersistentRooms() {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const data = fs.readFileSync(ROOMS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((r: any) => {
          const membersMap = new Map<string, Member>();
          if (Array.isArray(r.members)) {
            r.members.forEach((m: any) => {
              membersMap.set(m.id, {
                ...m,
                ws: { send: () => {} } as unknown as WebSocket,
              });
            });
          }
          rooms.set(r.code, {
            ...r,
            members: membersMap,
          });
        });
      }
    }
  } catch (err) {
    console.warn('Failed to load persistent rooms:', err);
  }
}

function savePersistentRooms() {
  try {
    const serializableRooms = Array.from(rooms.entries()).map(([code, room]) => ({
      code: room.code,
      hostId: room.hostId,
      hostOnlyControl: room.hostOnlyControl,
      createdAt: room.createdAt,
      mediaInfo: room.mediaInfo,
      playback: room.playback,
      messages: room.messages,
      members: Array.from(room.members.values()).map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        isHost: m.isHost,
        currentTime: m.currentTime,
        isPlaying: m.isPlaying,
      })),
    }));
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(serializableRooms, null, 2));
  } catch (err) {
    console.warn('Failed to save persistent rooms:', err);
  }
}

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

function createNewRoom(
  userName: string,
  hostOnlyControl: boolean,
  mediaInfo: any,
  currentTime: number,
  isPlaying: boolean,
  playbackRate: number,
  ws?: WebSocket
) {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const memberId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const memberName = (userName || 'Host').trim().substring(0, 24);
  const color = getRandomColor();

  const newMember: Member = {
    id: memberId,
    name: memberName,
    color,
    isHost: true,
    currentTime: Number(currentTime) || 0,
    isPlaying: Boolean(isPlaying),
    ws: ws || ({ send: () => {} } as unknown as WebSocket),
  };

  const room: Room = {
    code,
    hostId: memberId,
    hostOnlyControl: Boolean(hostOnlyControl),
    createdAt: Date.now(),
    mediaInfo: mediaInfo || null,
    playback: {
      isPlaying: Boolean(isPlaying),
      currentTime: Number(currentTime) || 0,
      updatedAt: Date.now(),
      playbackRate: Number(playbackRate) || 1,
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
  savePersistentRooms();
  return { code, memberId, memberName, color, room };
}

function createRoomWithCode(
  code: string,
  userName: string,
  hostOnlyControl: boolean = false,
  mediaInfo: any = null,
  ws?: WebSocket
) {
  const memberId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const memberName = (userName || 'Host').trim().substring(0, 24);
  const color = getRandomColor();

  const newMember: Member = {
    id: memberId,
    name: memberName,
    color,
    isHost: true,
    currentTime: 0,
    isPlaying: false,
    ws: ws || ({ send: () => {} } as unknown as WebSocket),
  };

  const room: Room = {
    code,
    hostId: memberId,
    hostOnlyControl: Boolean(hostOnlyControl),
    createdAt: Date.now(),
    mediaInfo: mediaInfo || null,
    playback: {
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
      playbackRate: 1,
    },
    messages: [
      {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderColor: '#38bdf8',
        text: `Room ${code} created.`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
    members: new Map([[memberId, newMember]]),
  };

  rooms.set(code, room);
  savePersistentRooms();
  return { code, memberId, memberName, color, room };
}

async function startServer() {
  loadPersistentRooms();
  const app = express();
  app.use(express.json());

  // API status and room lookup endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    let room = rooms.get(code);
    if (!room) {
      const created = createRoomWithCode(code, 'Host');
      room = created.room;
    }
    return res.json({
      code: room.code,
      memberCount: room.members.size,
      mediaInfo: room.mediaInfo,
      hostOnlyControl: room.hostOnlyControl,
    });
  });

  app.get('/api/rooms/:code/state', (req, res) => {
    const code = req.params.code.toUpperCase();
    let room = rooms.get(code);
    if (!room) {
      const created = createRoomWithCode(code, 'Host');
      room = created.room;
    }
    const estTime = computeEstimatedTime(room);
    return res.json({
      code: room.code,
      hostId: room.hostId,
      hostOnlyControl: room.hostOnlyControl,
      mediaInfo: room.mediaInfo,
      playback: {
        ...room.playback,
        currentTime: estTime,
      },
      members: getSanitizedMembers(room),
      messages: room.messages,
    });
  });

  app.post('/api/rooms/create', (req, res) => {
    try {
      const { userName, hostOnlyControl, mediaInfo, currentTime, isPlaying, playbackRate } = req.body;
      const { code, memberId, memberName, color, room } = createNewRoom(
        userName,
        hostOnlyControl,
        mediaInfo,
        currentTime,
        isPlaying,
        playbackRate
      );
      return res.json({
        type: 'created',
        roomCode: code,
        memberId,
        member: { id: memberId, name: memberName, color, isHost: true },
        room: {
          code,
          hostId: memberId,
          hostOnlyControl: room.hostOnlyControl,
          mediaInfo: room.mediaInfo,
          playback: room.playback,
          members: getSanitizedMembers(room),
          messages: room.messages,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to create room' });
    }
  });

  app.post('/api/rooms/join', (req, res) => {
    try {
      const { roomCode, userName, mediaInfo } = req.body;
      const code = (roomCode || '').toUpperCase().trim();
      let room = rooms.get(code);
      if (!room) {
        const created = createRoomWithCode(code, userName || 'Host', false, mediaInfo);
        return res.json({
          type: 'created',
          roomCode: code,
          memberId: created.memberId,
          member: { id: created.memberId, name: created.memberName, color: created.color, isHost: true },
          room: {
            code,
            hostId: created.memberId,
            hostOnlyControl: created.room.hostOnlyControl,
            mediaInfo: created.room.mediaInfo,
            playback: created.room.playback,
            members: getSanitizedMembers(created.room),
            messages: created.room.messages,
          },
        });
      }

      const memberId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const memberName = (userName || `Guest ${room.members.size + 1}`).trim().substring(0, 24);
      const color = getRandomColor();

      const newMember: Member = {
        id: memberId,
        name: memberName,
        color,
        isHost: false,
        currentTime: room.playback.currentTime,
        isPlaying: room.playback.isPlaying,
        ws: { send: () => {} } as unknown as WebSocket,
      };

      room.members.set(memberId, newMember);
      savePersistentRooms();

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

      const estTime = computeEstimatedTime(room);
      const payload = {
        type: 'joined',
        roomCode: code,
        memberId,
        member: { id: memberId, name: memberName, color, isHost: false },
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
      };

      broadcastToRoom(room, {
        type: 'member_joined',
        member: { id: memberId, name: memberName, color, isHost: false },
        members: getSanitizedMembers(room),
        systemMessage: joinMsg,
      });

      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to join room' });
    }
  });

  app.post('/api/rooms/:code/action', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const { type, memberId, ...data } = req.body;
    const member = room.members.get(memberId);

    if (type === 'playback_sync') {
      if (room.hostOnlyControl && member && !member.isHost) {
        return res.status(403).json({ error: 'Host has enabled "Host-Only Playback Controls".' });
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

      broadcastToRoom(room, {
        type: 'playback_sync',
        action,
        currentTime: targetTime,
        playbackRate: room.playback.playbackRate,
        isPlaying: room.playback.isPlaying,
        updatedAt: room.playback.updatedAt,
        sender: {
          id: memberId,
          name: member ? member.name : 'User',
        },
      });
      return res.json({ success: true, playback: room.playback });
    }

    if (type === 'chat_message') {
      const chatMsg: RoomMessage = {
        id: `msg-${Date.now()}`,
        senderId: memberId,
        senderName: member ? member.name : 'User',
        senderColor: member ? member.color : '#38bdf8',
        text: data.text,
        timestamp: Date.now(),
      };
      room.messages.push(chatMsg);
      if (room.messages.length > 100) room.messages.shift();
      broadcastToRoom(room, { type: 'chat_message', message: chatMsg });
      return res.json({ success: true, message: chatMsg });
    }

    if (type === 'reaction') {
      broadcastToRoom(room, {
        type: 'reaction',
        emoji: data.emoji,
        senderName: member ? member.name : 'User',
      });
      return res.json({ success: true });
    }

    if (type === 'media_announce') {
      room.mediaInfo = data.mediaInfo;
      const sysMsg: RoomMessage = {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderColor: '#38bdf8',
        text: `${member ? member.name : 'Host'} loaded media: ${data.mediaInfo.name}`,
        timestamp: Date.now(),
        isSystem: true,
      };
      room.messages.push(sysMsg);
      broadcastToRoom(room, { type: 'media_announce', mediaInfo: data.mediaInfo, systemMessage: sysMsg });
      return res.json({ success: true });
    }

    if (type === 'leave') {
      if (member) {
        room.members.delete(memberId);
        if (room.members.size === 0) {
          rooms.delete(code);
        } else {
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
            memberId,
            memberName: member.name,
            members: getSanitizedMembers(room),
            newHostId: newHostAssigned ? room.hostId : undefined,
            systemMessage: leaveMsg,
          });
        }
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action type' });
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
            const { code, memberId, memberName, color, room } = createNewRoom(
              data.userName,
              data.hostOnlyControl,
              data.mediaInfo,
              data.currentTime,
              data.isPlaying,
              data.playbackRate,
              ws
            );
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
            let room = rooms.get(code);

            if (!room) {
              const created = createRoomWithCode(code, data.userName || 'Host', false, data.mediaInfo, ws);
              room = created.room;
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
            savePersistentRooms();
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

          case 'identify': {
            const code = (data.roomCode || '').toUpperCase().trim();
            const room = rooms.get(code);
            if (room && data.memberId) {
              const member = room.members.get(data.memberId);
              if (member) {
                member.ws = ws;
                currentRoomCode = code;
                currentMemberId = data.memberId;
              }
            }
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
