import { useState } from 'react';
import { apiInstance } from '@/library/apiClient';

const AIAgentSidebar = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I can help with provider availability and booking guidance.',
    },
  ]);

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    const nextUserMessage = { role: 'user', text: input.trim() };
    setMessages((current) => [...current, nextUserMessage]);
    setInput('');

    try {
      const response = await apiInstance.post('/api/ai/chat', {
        message: nextUserMessage.text,
      });

      setMessages((current) => [
        ...current,
        { role: 'assistant', text: response.data?.reply || 'I could not process that request.' },
      ]);
    } catch (_error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: 'Yukon is temporarily unavailable.' },
      ]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow"
      >
        {open ? 'Close Yukon' : 'Yukon'}
      </button>

      {open && (
        <aside className="fixed right-4 top-20 z-40 flex h-[70vh] w-full max-w-sm flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
          <header className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Yukon</h3>
            <p className="text-xs text-slate-600">Yelp and availability guidance</p>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-slate-200 p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  sendMessage();
                }
              }}
              placeholder="Ask about booking..."
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={sendMessage}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Send
            </button>
          </div>
        </aside>
      )}
    </>
  );
};

export default AIAgentSidebar;
