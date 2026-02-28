import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useAppointmentChat } from '@/hooks/useAppointmentChat';
import { apiInstance } from '@/library/apiClient';
import AppSelectField from '@/components/General/AppSelectField';
import LoadingScreen from '@/components/General/LoadingScreen';
import {
  PencilSquareIcon,
  TrashIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

const AppointmentChatPanel = ({ appointments = [], role, userId }) => {
  const validAppointments = useMemo(
    () =>
      appointments.filter(
        (item) => item?.id && item?.client_id && item?.provider_id && item?.status === 'approved'
      ),
    [appointments]
  );

  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState('');
  const [editMessageId, setEditMessageId] = useState('');
  const [editMessageText, setEditMessageText] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!selectedAppointmentId && validAppointments.length > 0) {
      setSelectedAppointmentId(validAppointments[0].id);
    }
  }, [selectedAppointmentId, validAppointments]);

  const selectedAppointment = validAppointments.find((item) => item.id === selectedAppointmentId);
  const {
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
  } = useAppointmentChat(selectedAppointmentId);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSendError('');
    setIsSending(true);

    const cleanMessage = message.trim();
    if (!cleanMessage) {
      setIsSending(false);
      return;
    }

    const response = await sendMessage(cleanMessage);
    setIsSending(false);
    if (!response.ok) {
      setSendError(response.error || 'Unable to send message');
      return;
    }

    setMessage('');
    setTypingState(false);
  };

  const onSelectFiles = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    setPendingFiles((previous) => [...previous, ...nextFiles].slice(0, 5));
    event.target.value = '';
  };

  const removePendingFile = (index) => {
    setPendingFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const onUploadFiles = async () => {
    if (!pendingFiles.length) {
      return;
    }

    setIsSending(true);
    const response = await uploadFiles({ files: pendingFiles, messageText: message.trim() });
    setIsSending(false);
    if (!response.ok) {
      setSendError(response.error || 'Unable to upload files');
      return;
    }

    setPendingFiles([]);
    setMessage('');
  };

  const handleCloseChat = async (appointmentId) => {
    if (!confirm('Are you sure you want to close this chat? This will mark the appointment as completed.')) {
      return;
    }

    try {
      const response = await apiInstance.put(`/api/appointments/${appointmentId}/complete`);
      if (response.status === 200) {
        // Refresh appointments data
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to close chat. Please try again.');
    }
  };

  const onSaveEdit = async () => {
    if (!editMessageId || !editMessageText.trim()) {
      return;
    }

    const response = await editMessage({ messageId: editMessageId, messageText: editMessageText.trim() });
    if (!response.ok) {
      setSendError(response.error || 'Unable to edit message');
      return;
    }

    setEditMessageId('');
    setEditMessageText('');
  };

  const onStartEdit = (chatMessage) => {
    setEditMessageId(chatMessage.id);
    setEditMessageText(chatMessage.message_text);
  };

  const onDeleteMessage = async (messageId) => {
    const response = await deleteMessage(messageId);
    if (!response.ok) {
      setSendError(response.error || 'Unable to delete message');
    }
  };

  const onDeleteFile = async (fileId) => {
    const response = await deleteFile(fileId);
    if (!response.ok) {
      setSendError(response.error || 'Unable to delete file');
    }
  };

  const onlineSummary = onlineUsers.length
    ? `${onlineUsers.length} online: ${onlineUsers.map((user) => user.name).join(', ')}`
    : 'No users currently online';

  const typingSummary = typingUsers.length
    ? `${typingUsers.map((user) => user.name).join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing...`
    : '';

  if (validAppointments.length === 0) {
    return (
      <section className="flex h-full flex-col bg-gray-50">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Active Chats</h3>
            <p className="text-gray-500 text-sm max-w-sm">
              {role === 'client'
                ? 'Chat will be available once your appointment is approved by a provider.'
                : 'Chat becomes available when you approve client appointments.'
              }
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-gray-50">
      {/* WhatsApp-like Header */}
      <div className="bg-green-600 text-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Appointment Chat</h3>
              <p className="text-xs opacity-90">
                {selectedAppointment ? `${selectedAppointment.title} (${selectedAppointment.appointment_number})` : 'Select appointment'}
              </p>
            </div>
          </div>
          {role === 'provider' && selectedAppointment?.status === 'approved' && (
            <button
              type="button"
              onClick={() => handleCloseChat(selectedAppointment.id)}
              className="text-xs px-3 py-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              Close Chat
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={`font-medium ${isConnected ? 'text-green-200' : 'text-yellow-200'}`}>
            {isConnected ? '● Connected' : '● Reconnecting'}
          </span>
          <div className="text-right">
            <p className="opacity-90">{onlineSummary}</p>
            {typingSummary && <p className="text-green-200 font-medium">{typingSummary}</p>}
          </div>
        </div>
      </div>

      {/* Appointment Selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <AppSelectField
          label=""
          value={selectedAppointmentId}
          onChange={setSelectedAppointmentId}
          options={validAppointments.map((item) => ({
            value: item.id,
            label: `${item.title} (${item.appointment_number})`,
          }))}
          className="w-full"
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 bg-opacity-50">
        {isLoadingHistory && (
          <LoadingScreen message="Loading messages..." size="small" />
        )}
        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
            </div>
          </div>
        )}

        {messages.map((chatMessage) => {
          const mine = chatMessage.sender_id === userId;
          const isDeleted = Boolean(chatMessage.deleted_at);
          const canManage = mine && !isDeleted;

          return (
            <div key={chatMessage.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className={`max-w-[75%] ${mine ? 'order-2' : 'order-1'}`}>
                {/* Sender name for received messages */}
                {!mine && (
                  <div className="text-xs text-gray-500 mb-1 px-3">
                    {chatMessage.sender_name || 'User'}
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`relative px-4 py-2 rounded-2xl shadow-sm ${
                  mine
                    ? 'bg-green-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                }`}>
                  {editMessageId === chatMessage.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editMessageText}
                        onChange={(event) => setEditMessageText(event.target.value)}
                        className="w-full rounded border border-gray-300 p-2 text-sm bg-white text-gray-800"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                          onClick={onSaveEdit}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded bg-gray-500 px-3 py-1 text-xs text-white hover:bg-gray-600"
                          onClick={() => {
                            setEditMessageId('');
                            setEditMessageText('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed break-words">
                      {isDeleted ? (
                        <span className="italic text-gray-400">This message was deleted</span>
                      ) : (
                        chatMessage.message_text
                      )}
                    </p>
                  )}

                  {/* Attachments */}
                  {(chatMessage.attachments || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {chatMessage.attachments.map((attachment) => (
                        <div key={attachment.id} className={`flex items-center gap-2 rounded-lg p-2 ${
                          mine ? 'bg-green-700' : 'bg-gray-100'
                        }`}>
                          <PaperClipIcon className="h-4 w-4 flex-shrink-0" />
                          <a
                            href={attachment.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-xs underline flex-1 truncate ${
                              mine ? 'text-green-100' : 'text-blue-600'
                            }`}
                          >
                            {attachment.file_name}
                          </a>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => onDeleteFile(attachment.id)}
                              className="text-red-400 hover:text-red-300 flex-shrink-0"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Actions */}
                  {canManage && editMessageId !== chatMessage.id && !isDeleted && (
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => onStartEdit(chatMessage)}
                        className="text-xs opacity-70 hover:opacity-100 transition-opacity"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(chatMessage.id)}
                        className="text-xs opacity-70 hover:opacity-100 transition-opacity text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className={`text-xs text-gray-500 mt-1 px-1 ${mine ? 'text-right' : 'text-left'}`}>
                  {dayjs(chatMessage.created_at).format('h:mm A')}
                  {chatMessage.edited_at && <span className="ml-1">(edited)</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {(error || sendError) && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error || sendError}</p>
          </div>
        )}

        {/* Pending Files */}
        {pendingFiles.length > 0 && (
          <div className="mb-3 space-y-2">
            {pendingFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <PaperClipIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Message Input */}
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setTypingState(Boolean(event.target.value.trim()));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (pendingFiles.length > 0) {
                    onUploadFiles();
                  } else {
                    onSubmit(event);
                  }
                }
              }}
              placeholder="Type a message..."
              className="w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 pr-12 text-sm bg-gray-50 focus:bg-white focus:border-green-500 focus:outline-none transition-colors"
              rows={1}
              maxLength={1000}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <label className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
              <ArrowUpTrayIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
              <input type="file" multiple className="hidden" onChange={onSelectFiles} />
            </label>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (pendingFiles.length > 0) {
                await onUploadFiles();
              } else {
                await onSubmit({ preventDefault: () => {} });
              }
            }}
            className="flex-shrink-0 w-11 h-11 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSending || (!message.trim() && pendingFiles.length === 0)}
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.409l-7-14z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

export default AppointmentChatPanel;
