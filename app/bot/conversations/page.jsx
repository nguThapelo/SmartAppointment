'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  MessageSquare, Search, Phone, Bot, ChevronRight,
  Send, User, Clock, Filter,
} from 'lucide-react';
import { apiGet } from '../../lib/api.js';

// ── Conversation List Item ────────────────────────────────────────────────────

function ConvItem({ conv, active, onClick }) {
  const lastMsg = conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : '';
  return (
    <button
      onClick={() => onClick(conv)}
      className={[
        'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50',
        active ? 'bg-whatsapp-green/5 border-l-2 border-l-whatsapp-green' : '',
      ].join(' ')}
    >
      <div className="w-10 h-10 rounded-full bg-whatsapp-green/10 flex items-center justify-center text-sm font-bold text-whatsapp-green flex-shrink-0">
        {(conv.customer_name || conv.customer_phone)?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 truncate">
            {conv.customer_name || conv.customer_phone}
          </p>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{lastMsg}</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 truncate">Step: {conv.current_step}</p>
          <span className={`ml-2 flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${conv.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {conv.status}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound';
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isOut && (
        <div className="w-7 h-7 rounded-full bg-whatsapp-green/10 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <User size={12} className="text-whatsapp-green" />
        </div>
      )}
      <div className={`max-w-[75%] ${isOut ? 'bubble-out' : 'bubble-in'}`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message_text}</p>
        <p className={`text-[10px] mt-1 ${isOut ? 'text-gray-500 text-right' : 'text-gray-400'}`}>
          {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
        </p>
      </div>
      {isOut && (
        <div className="w-7 h-7 rounded-full bg-whatsapp-green flex items-center justify-center ml-2 flex-shrink-0 mt-1">
          <Bot size={12} className="text-white" />
        </div>
      )}
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ conv, onClose }) {
  const messagesEndRef = useRef(null);

  const { data: messages = [], isPending } = useQuery({
    queryKey: ['conv-messages', conv.id],
    queryFn:  () => apiGet(`/api/bot-conversations/${conv.id}/messages`),
    refetchInterval: 5000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-whatsapp-bg">
      {/* Chat header */}
      <div className="bg-whatsapp-dark px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
          {(conv.customer_name || conv.customer_phone)?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {conv.customer_name || conv.customer_phone}
          </p>
          <p className="text-white/60 text-xs truncate">
            {conv.customer_email || conv.customer_phone} · Step: {conv.current_step}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${conv.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60'}`}>
            {conv.status}
          </span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors text-lg leading-none">&times;</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
           style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='50' cy='50' r='1' fill='%23d0d0d0' fill-opacity='0.3'/%3E%3C/svg%3E\")" }}>
        {isPending ? (
          <p className="text-center text-sm text-gray-400 py-10">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">No messages in this conversation</p>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Info bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Clock size={11} /> Started {conv.created_at ? format(new Date(conv.created_at), 'MMM d, HH:mm') : '—'}</span>
        <span className="flex items-center gap-1"><MessageSquare size={11} /> Read-only (bot handles replies automatically)</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [selected,     setSelected]     = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSvc,    setFilterSvc]    = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['bot-services'],
    queryFn:  () => apiGet('/api/bot-services'),
  });

  const { data: conversations = [], isPending } = useQuery({
    queryKey: ['bot-conversations', filterStatus, filterSvc, search],
    queryFn:  () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status',    filterStatus);
      if (filterSvc)    params.set('serviceId', filterSvc);
      if (search)       params.set('search',    search);
      params.set('limit', '100');
      return apiGet(`/api/bot-conversations?${params}`);
    },
    refetchInterval: 10_000,
  });

  return (
    <div className="h-[calc(100vh-120px)] flex gap-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Left panel: conversation list */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 xl:w-96 border-r border-gray-100 flex-shrink-0`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Conversations</h2>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 text-sm py-1.5"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="input text-xs py-1 flex-1"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <select
              className="input text-xs py-1 flex-1"
              value={filterSvc}
              onChange={(e) => setFilterSvc(e.target.value)}
            >
              <option value="">All services</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-300 mt-1">Messages will appear when customers WhatsApp your bots</p>
            </div>
          ) : (
            conversations.map((c) => (
              <ConvItem
                key={c.id}
                conv={c}
                active={selected?.id === c.id}
                onClick={setSelected}
              />
            ))
          )}
        </div>

        {/* Count */}
        <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Right panel: chat view */}
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selected ? (
          <ChatPanel conv={selected} onClose={() => setSelected(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-whatsapp-bg">
            <div className="w-20 h-20 rounded-full bg-whatsapp-green/10 flex items-center justify-center mb-4">
              <MessageSquare size={36} className="text-whatsapp-green" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">Select a conversation</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              Click on a conversation from the list to view the WhatsApp chat history
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
