import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiInstance } from '@/library/apiClient';
import { supabase } from '@/library/supabaseClient';

export const useAppointmentChat = (appointmentId) => {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

//   console.log('useAppointmentChat called with appointmentId:', appointmentId);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      if (!appointmentId) {
        setMessages([]);
        setOnlineUsers([]);
        setTypingUsers([]);
        return;
      }

      setIsLoadingHistory(true);
      setError('');

      try {
        const response = await apiInstance.get(`/api/chat/appointments/${appointmentId}/messages`);
        if (mounted) {
          setMessages(response.data || []);
          setTypingUsers([]);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError?.response?.data?.error || 'Unable to load messages');
        }
      } finally {
        if (mounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [appointmentId]);

  useEffect(() => {
    let cancelled = false;

    const connectSocket = async () => {
      if (!appointmentId || typeof window === 'undefined') {
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token || cancelled) {
        return;
      }

      const socket = io('http://localhost:8000', {
        path: '/socket.io',
        transports: ['websocket'],
        auth: {
          token,
        },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        setError('');
        console.log('Socket connected successfully');

        socket.emit('chat:join', { appointmentId }, (response) => {
          if (!response?.ok) {
            setError(response?.error || 'Unable to join conversation');
            console.log('Failed to join chat:', response?.error);
          } else {
            console.log('Successfully joined chat for appointment:', appointmentId);
          }
        });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('chat:message', (incoming) => {
        setMessages((previous) => {
          if (previous.some((item) => item.id === incoming.id)) {
            return previous;
          }
          return [...previous, incoming];
        });
      });

      socket.on('chat:message:updated', (incoming) => {
        setMessages((previous) =>
          previous.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item))
        );
      });

      socket.on('chat:message:deleted', (incoming) => {
        setMessages((previous) =>
          previous.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item))
        );
      });

      socket.on('chat:online', (payload) => {
        if (payload?.appointmentId === appointmentId) {
          setOnlineUsers(payload.users || []);
        }
      });

      socket.on('chat:typing', (payload) => {
        if (payload?.appointmentId !== appointmentId) {
          return;
        }

        setTypingUsers((previous) => {
          const next = previous.filter((item) => item.userId !== payload.userId);
          if (payload.isTyping) {
            next.push({ userId: payload.userId, name: payload.name, role: payload.role });
          }
          return next;
        });
      });

      socket.on('connect_error', () => {
        setError('Unable to connect to live chat');
      });
    };

    connectSocket();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.emit('chat:leave', { appointmentId });
        socket.disconnect();
      }
      socketRef.current = null;
      setIsConnected(false);
      setOnlineUsers([]);
      setTypingUsers([]);
    };
  }, [appointmentId]);

  const sendMessage = useCallback(
    async (messageText) => {
      const socket = socketRef.current;
      if (!appointmentId) {
        return { ok: false, error: 'Appointment is required' };
      }

      if (!socket || !socket.connected) {
        try {
          const response = await apiInstance.post(`/api/chat/appointments/${appointmentId}/messages`, {
            message: messageText,
          });

          setMessages((previous) => {
            const incoming = response.data;
            if (!incoming || previous.some((item) => item.id === incoming.id)) {
              return previous;
            }
            return [...previous, incoming];
          });

          return { ok: true, message: response.data };
        } catch (requestError) {
          const message = requestError?.response?.data?.error || 'Unable to send message';
          setError(message);
          return { ok: false, error: message };
        }
      }

      return new Promise((resolve) => {
        socket.emit('chat:message', { appointmentId, message: messageText }, (response) => {
          if (!response?.ok) {
            setError(response?.error || 'Unable to send message');
            resolve({ ok: false, error: response?.error || 'Unable to send message' });
            return;
          }

          resolve({ ok: true });
        });
      });
    },
    [appointmentId]
  );

  const editMessage = useCallback(
    async ({ messageId, messageText }) => {
      const socket = socketRef.current;
      if (!appointmentId || !messageId) {
        return { ok: false, error: 'Message not found' };
      }

      if (socket && socket.connected) {
        return new Promise((resolve) => {
          socket.emit('chat:message:update', { messageId, message: messageText }, (response) => {
            if (!response?.ok) {
              const errorMessage = response?.error || 'Unable to edit message';
              setError(errorMessage);
              resolve({ ok: false, error: errorMessage });
              return;
            }
            resolve({ ok: true, message: response.message });
          });
        });
      }

      try {
        const response = await apiInstance.patch(`/api/chat/messages/${messageId}`, {
          message: messageText,
        });
        setMessages((previous) =>
          previous.map((item) => (item.id === messageId ? { ...item, ...response.data } : item))
        );
        return { ok: true, message: response.data };
      } catch (requestError) {
        const message = requestError?.response?.data?.error || 'Unable to edit message';
        setError(message);
        return { ok: false, error: message };
      }
    },
    [appointmentId]
  );

  const deleteMessage = useCallback(
    async (messageId) => {
      const socket = socketRef.current;
      if (!appointmentId || !messageId) {
        return { ok: false, error: 'Message not found' };
      }

      if (socket && socket.connected) {
        return new Promise((resolve) => {
          socket.emit('chat:message:delete', { messageId }, (response) => {
            if (!response?.ok) {
              const errorMessage = response?.error || 'Unable to delete message';
              setError(errorMessage);
              resolve({ ok: false, error: errorMessage });
              return;
            }
            resolve({ ok: true, message: response.message });
          });
        });
      }

      try {
        const response = await apiInstance.delete(`/api/chat/messages/${messageId}`);
        setMessages((previous) =>
          previous.map((item) => (item.id === messageId ? { ...item, ...response.data } : item))
        );
        return { ok: true, message: response.data };
      } catch (requestError) {
        const message = requestError?.response?.data?.error || 'Unable to delete message';
        setError(message);
        return { ok: false, error: message };
      }
    },
    [appointmentId]
  );

  const uploadFiles = useCallback(
    async ({ files, messageText }) => {
      if (!appointmentId) {
        return { ok: false, error: 'Appointment is required' };
      }

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        if (messageText) {
          formData.append('message', messageText);
        }

        const response = await apiInstance.post(
          `/api/chat/appointments/${appointmentId}/files`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );

        const message = response.data;
        setMessages((previous) => {
          if (!message || previous.some((item) => item.id === message.id)) {
            return previous;
          }
          return [...previous, message];
        });

        return { ok: true, message };
      } catch (requestError) {
        const message = requestError?.response?.data?.error || 'Unable to upload file(s)';
        setError(message);
        return { ok: false, error: message };
      }
    },
    [appointmentId]
  );

  const deleteFile = useCallback(async (fileId) => {
    try {
      const response = await apiInstance.delete(`/api/chat/files/${fileId}`);
      const deletedId = response.data?.id;

      setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          attachments: (message.attachments || []).filter((attachment) => attachment.id !== deletedId),
        }))
      );

      return { ok: true };
    } catch (requestError) {
      const message = requestError?.response?.data?.error || 'Unable to delete file';
      setError(message);
      return { ok: false, error: message };
    }
  }, []);

  const setTypingState = useCallback(
    (isTyping) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || !appointmentId) {
        return;
      }
      socket.emit('chat:typing', { appointmentId, isTyping: Boolean(isTyping) });
    },
    [appointmentId]
  );

  return useMemo(
    () => ({
      messages,
      error,
      isConnected,
      isLoadingHistory,
      sendMessage,
      editMessage,
      deleteMessage,
      uploadFiles,
      deleteFile,
      onlineUsers,
      typingUsers,
      setTypingState,
    }),
    [
      messages,
      error,
      isConnected,
      isLoadingHistory,
      sendMessage,
      editMessage,
      deleteMessage,
      uploadFiles,
      deleteFile,
      onlineUsers,
      typingUsers,
      setTypingState,
    ]
  );
};
