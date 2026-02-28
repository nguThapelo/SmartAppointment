const { Server } = require('socket.io');
const { supabase } = require('../supabaseClient');
const { getUserRole } = require('../middleware/role');
const { getAuthorizedAppointment } = require('../services/chatAccess');
const {
  ensureAppointmentChatTable,
  isMissingChatTableError,
  insertAppointmentChatMessage,
  getAppointmentChatMessageById,
  updateAppointmentChatMessage,
  softDeleteAppointmentChatMessage,
} = require('../services/ensureChatTable');

const toRoomName = (appointmentId) => `appointment:${appointmentId}`;
const roomMembers = new Map();

const createSenderName = (user) => {
  const firstName = user?.user_metadata?.firstName || '';
  const lastName = user?.user_metadata?.lastName || '';
  const combined = `${firstName} ${lastName}`.trim();
  return combined || user?.email || 'User';
};

const getRoomUsers = (appointmentId) => {
  const members = roomMembers.get(toRoomName(appointmentId));
  if (!members) {
    return [];
  }

  const uniqueUsers = new Map();
  for (const user of members.values()) {
    uniqueUsers.set(user.id, user);
  }
  return Array.from(uniqueUsers.values());
};

const emitOnlineUsers = (io, appointmentId) => {
  io.to(toRoomName(appointmentId)).emit('chat:online', {
    appointmentId,
    users: getRoomUsers(appointmentId),
  });
};

const createChatSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const rawToken = socket.handshake?.auth?.token || '';
      const token = typeof rawToken === 'string' ? rawToken : '';

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return next(new Error('Unauthorized'));
      }

      socket.data.user = data.user;
      socket.data.userRole = getUserRole(data.user);
      return next();
    } catch (_error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.data.joinedAppointments = new Set();

    socket.on('chat:join', async (payload, callback) => {
      try {
        const appointmentId = payload?.appointmentId;
        const access = await getAuthorizedAppointment({
          appointmentId,
          userId: socket.data.user?.id,
          role: socket.data.userRole,
        });

        if (!access.appointment) {
          callback?.({ ok: false, error: access.error });
          return;
        }

        socket.join(toRoomName(appointmentId));
        socket.data.joinedAppointments.add(appointmentId);

        const roomName = toRoomName(appointmentId);
        if (!roomMembers.has(roomName)) {
          roomMembers.set(roomName, new Map());
        }

        roomMembers.get(roomName).set(socket.id, {
          id: socket.data.user?.id,
          role: socket.data.userRole,
          name: createSenderName(socket.data.user),
        });

        emitOnlineUsers(io, appointmentId);
        console.log(`User ${socket.data.user?.email} joined appointment chat: ${appointmentId}`);
        callback?.({ ok: true });
      } catch (_error) {
        callback?.({ ok: false, error: 'Unable to join conversation' });
      }
    });

    socket.on('chat:leave', (payload) => {
      const appointmentId = payload?.appointmentId;
      if (!appointmentId) {
        return;
      }
      socket.leave(toRoomName(appointmentId));
      socket.data.joinedAppointments?.delete(appointmentId);

      const roomName = toRoomName(appointmentId);
      const members = roomMembers.get(roomName);
      if (members) {
        members.delete(socket.id);
        if (members.size === 0) {
          roomMembers.delete(roomName);
        }
      }

      emitOnlineUsers(io, appointmentId);
    });

    socket.on('chat:typing', (payload) => {
      const appointmentId = payload?.appointmentId;
      const isTyping = Boolean(payload?.isTyping);
      if (!appointmentId) {
        return;
      }

      socket.to(toRoomName(appointmentId)).emit('chat:typing', {
        appointmentId,
        userId: socket.data.user?.id,
        role: socket.data.userRole,
        name: createSenderName(socket.data.user),
        isTyping,
      });
    });

    socket.on('chat:message', async (payload, callback) => {
      try {
        const appointmentId = payload?.appointmentId;
        const messageText = String(payload?.message || '').trim();

        if (!messageText) {
          callback?.({ ok: false, error: 'Message cannot be empty' });
          return;
        }

        if (messageText.length > 1000) {
          callback?.({ ok: false, error: 'Message cannot exceed 1000 characters' });
          return;
        }

        const access = await getAuthorizedAppointment({
          appointmentId,
          userId: socket.data.user?.id,
          role: socket.data.userRole,
        });

        if (!access.appointment) {
          callback?.({ ok: false, error: access.error });
          return;
        }

        await ensureAppointmentChatTable();

        const insertPayload = {
          appointment_id: appointmentId,
          sender_id: socket.data.user.id,
          sender_role: socket.data.userRole,
          sender_name: createSenderName(socket.data.user),
          message_text: messageText,
        };

        const { data, error } = await insertAppointmentChatMessage(insertPayload);

        if (error) {
          if (isMissingChatTableError(error)) {
            callback?.({
              ok: false,
              error: 'Chat storage is not ready. Ensure the appointment chat migration has been applied.',
            });
            return;
          }
          callback?.({ ok: false, error: error.message });
          return;
        }

        io.to(toRoomName(appointmentId)).emit('chat:message', data);
        callback?.({ ok: true, message: data });
      } catch (_error) {
        callback?.({ ok: false, error: 'Failed to send message' });
      }
    });

    socket.on('chat:message:update', async (payload, callback) => {
      try {
        const messageId = payload?.messageId;
        const messageText = String(payload?.message || '').trim();

        if (!messageId || !messageText) {
          callback?.({ ok: false, error: 'Message cannot be empty' });
          return;
        }

        const existing = await getAppointmentChatMessageById(messageId);
        if (existing.error || !existing.data) {
          callback?.({ ok: false, error: 'Message not found' });
          return;
        }

        if (socket.data.userRole !== 'admin' && existing.data.sender_id !== socket.data.user?.id) {
          callback?.({ ok: false, error: 'You can only edit your own messages' });
          return;
        }

        const access = await getAuthorizedAppointment({
          appointmentId: existing.data.appointment_id,
          userId: socket.data.user?.id,
          role: socket.data.userRole,
        });

        if (!access.appointment) {
          callback?.({ ok: false, error: access.error });
          return;
        }

        const updated = await updateAppointmentChatMessage({ messageId, messageText });
        if (updated.error || !updated.data) {
          callback?.({ ok: false, error: updated.error?.message || 'Unable to update message' });
          return;
        }

        io.to(toRoomName(updated.data.appointment_id)).emit('chat:message:updated', updated.data);
        callback?.({ ok: true, message: updated.data });
      } catch (_error) {
        callback?.({ ok: false, error: 'Failed to update message' });
      }
    });

    socket.on('chat:message:delete', async (payload, callback) => {
      try {
        const messageId = payload?.messageId;
        if (!messageId) {
          callback?.({ ok: false, error: 'Message not found' });
          return;
        }

        const existing = await getAppointmentChatMessageById(messageId);
        if (existing.error || !existing.data) {
          callback?.({ ok: false, error: 'Message not found' });
          return;
        }

        if (socket.data.userRole !== 'admin' && existing.data.sender_id !== socket.data.user?.id) {
          callback?.({ ok: false, error: 'You can only delete your own messages' });
          return;
        }

        const access = await getAuthorizedAppointment({
          appointmentId: existing.data.appointment_id,
          userId: socket.data.user?.id,
          role: socket.data.userRole,
        });

        if (!access.appointment) {
          callback?.({ ok: false, error: access.error });
          return;
        }

        const deleted = await softDeleteAppointmentChatMessage({
          messageId,
          deletedBy: socket.data.user?.id,
        });

        if (deleted.error || !deleted.data) {
          callback?.({ ok: false, error: deleted.error?.message || 'Unable to delete message' });
          return;
        }

        io.to(toRoomName(deleted.data.appointment_id)).emit('chat:message:deleted', deleted.data);
        callback?.({ ok: true, message: deleted.data });
      } catch (_error) {
        callback?.({ ok: false, error: 'Failed to delete message' });
      }
    });

    socket.on('disconnect', () => {
      const joinedAppointments = socket.data.joinedAppointments || new Set();
      for (const appointmentId of joinedAppointments) {
        const roomName = toRoomName(appointmentId);
        const members = roomMembers.get(roomName);
        if (members) {
          members.delete(socket.id);
          if (members.size === 0) {
            roomMembers.delete(roomName);
          }
        }
        emitOnlineUsers(io, appointmentId);
      }
    });
  });

  return io;
};

module.exports = {
  createChatSocketServer,
};
