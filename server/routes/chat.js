const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getUserRole } = require('../middleware/role');
const { getAuthorizedAppointment } = require('../services/chatAccess');
const {
  ensureAppointmentChatTable,
  isMissingChatTableError,
  listAppointmentChatMessages,
  insertAppointmentChatMessage,
  getAppointmentChatMessageById,
  updateAppointmentChatMessage,
  softDeleteAppointmentChatMessage,
  createChatFileAttachments,
  getChatAttachmentById,
  deleteChatAttachmentById,
} = require('../services/ensureChatTable');

const router = express.Router();

// Mock data for offline mode
const mockChatMessages = [
  {
    id: 'msg-1',
    appointment_id: 'appointment-1',
    sender_id: 'provider-1',
    sender_role: 'provider',
    sender_name: 'John Doe',
    message_text: 'Hello! I\'m looking forward to our appointment tomorrow.',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
    is_deleted: false,
    attachments: []
  },
  {
    id: 'msg-2',
    appointment_id: 'appointment-1',
    sender_id: 'client-1',
    sender_role: 'client',
    sender_name: 'Jane Smith',
    message_text: 'Thank you! I have some questions about the procedure.',
    created_at: '2024-01-15T09:05:00Z',
    updated_at: '2024-01-15T09:05:00Z',
    is_deleted: false,
    attachments: []
  },
  {
    id: 'msg-3',
    appointment_id: 'appointment-2',
    sender_id: 'provider-2',
    sender_role: 'provider',
    sender_name: 'Mike Johnson',
    message_text: 'Please arrive 15 minutes early for paperwork.',
    created_at: '2024-01-16T08:30:00Z',
    updated_at: '2024-01-16T08:30:00Z',
    is_deleted: false,
    attachments: []
  }
];

const createSenderName = (user) => {
  const firstName = user?.user_metadata?.firstName || '';
  const lastName = user?.user_metadata?.lastName || '';
  const combined = `${firstName} ${lastName}`.trim();
  return combined || user?.email || 'User';
};

const chatUploadsRoot = path.join(process.cwd(), 'public', 'chat_uploads');
if (!fs.existsSync(chatUploadsRoot)) {
  fs.mkdirSync(chatUploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const appointmentId = req.params.appointmentId;
    const uploadPath = path.join(chatUploadsRoot, appointmentId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5,
  },
});

router.get('/appointments/:appointmentId/messages', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;
    const role = getUserRole(req.user);

    const access = await getAuthorizedAppointment({
      appointmentId,
      userId,
      role,
    });

    if (!access.appointment) {
      return res.status(access.status).json({ error: access.error });
    }

    await ensureAppointmentChatTable();

    const { data, error } = await listAppointmentChatMessages(appointmentId);

    if (error) {
      if (isMissingChatTableError(error)) {
        // Return mock data when chat table is not ready
        const filteredMessages = mockChatMessages.filter(msg => msg.appointment_id === appointmentId);
        return res.status(200).json(filteredMessages);
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (_error) {
    // Return mock data when database connection fails
    const { appointmentId } = req.params;
    const filteredMessages = mockChatMessages.filter(msg => msg.appointment_id === appointmentId);
    return res.status(200).json(filteredMessages);
  }
});

router.post('/appointments/:appointmentId/messages', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;
    const role = getUserRole(req.user);
    const messageText = String(req.body?.message || '').trim();

    if (!messageText) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (messageText.length > 1000) {
      return res.status(400).json({ error: 'Message cannot exceed 1000 characters' });
    }

    const access = await getAuthorizedAppointment({ appointmentId, userId, role });
    if (!access.appointment) {
      return res.status(access.status).json({ error: access.error });
    }

    await ensureAppointmentChatTable();

    const { data, error } = await insertAppointmentChatMessage({
      appointment_id: appointmentId,
      sender_id: userId,
      sender_role: role,
      sender_name: createSenderName(req.user),
      message_text: messageText,
    });

    if (error) {
      if (isMissingChatTableError(error)) {
        return res.status(503).json({ error: 'Chat storage is not ready. Ensure the appointment chat migration has been applied.' });
      }
      return res.status(500).json({ error: error.message || 'Unable to send message' });
    }

    return res.status(200).json(data);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

router.patch('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    const role = getUserRole(req.user);
    const messageText = String(req.body?.message || '').trim();

    if (!messageText) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const existing = await getAppointmentChatMessageById(messageId);
    if (existing.error || !existing.data) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (role !== 'admin' && existing.data.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const updated = await updateAppointmentChatMessage({ messageId, messageText });
    if (updated.error) {
      return res.status(500).json({ error: updated.error.message || 'Unable to update message' });
    }

    return res.status(200).json(updated.data);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to update message' });
  }
});

router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    const role = getUserRole(req.user);

    const existing = await getAppointmentChatMessageById(messageId);
    if (existing.error || !existing.data) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (role !== 'admin' && existing.data.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    const deleted = await softDeleteAppointmentChatMessage({ messageId, deletedBy: userId });
    if (deleted.error) {
      return res.status(500).json({ error: deleted.error.message || 'Unable to delete message' });
    }

    return res.status(200).json(deleted.data);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.post('/appointments/:appointmentId/files', upload.array('files', 5), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id;
    const role = getUserRole(req.user);
    const messageText = String(req.body?.message || '').trim();
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const access = await getAuthorizedAppointment({ appointmentId, userId, role });
    if (!access.appointment) {
      return res.status(access.status).json({ error: access.error });
    }

    await ensureAppointmentChatTable();

    const created = await insertAppointmentChatMessage({
      appointment_id: appointmentId,
      sender_id: userId,
      sender_role: role,
      sender_name: createSenderName(req.user),
      message_text: messageText || 'Shared file(s)',
    });

    if (created.error || !created.data?.id) {
      return res.status(500).json({ error: created.error?.message || 'Unable to create file message' });
    }

    const mappedFiles = files.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/chat_uploads/${appointmentId}/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
    }));

    const attached = await createChatFileAttachments({
      messageId: created.data.id,
      appointmentId,
      userId,
      files: mappedFiles,
    });

    if (attached.error) {
      return res.status(500).json({ error: attached.error.message || 'Unable to attach files' });
    }

    const message = await getAppointmentChatMessageById(created.data.id);
    if (message.error) {
      return res.status(500).json({ error: message.error.message || 'Unable to load uploaded files' });
    }

    return res.status(200).json(message.data);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to upload files' });
  }
});

router.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;
    const role = getUserRole(req.user);

    const fileRecord = await getChatAttachmentById(fileId);
    if (fileRecord.error || !fileRecord.data) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (role !== 'admin' && fileRecord.data.uploaded_by !== userId && fileRecord.data.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own files' });
    }

    const deleted = await deleteChatAttachmentById(fileId);
    if (deleted.error) {
      return res.status(500).json({ error: deleted.error.message || 'Unable to delete file' });
    }

    if (deleted.data?.file_url) {
      const relativePath = deleted.data.file_url.replace(/^\//, '').replace(/\//g, path.sep);
      const absolutePath = path.join(process.cwd(), 'public', relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    return res.status(200).json({ ok: true, id: fileId, messageId: deleted.data?.message_id });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
