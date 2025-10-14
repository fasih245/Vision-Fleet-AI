import { useState, useEffect, useRef } from 'react';
import { supabase, dbOperations } from '@/lib/supabase';
import { sendChatMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Chat = ({ conversationId }: { conversationId: string }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await dbOperations.getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const startTime = Date.now();

    try {
      // Call RAG backend
      const response = await sendChatMessage(userMessage);
      const responseTime = Date.now() - startTime;

      // Save to database (both user message and bot response in one row)
      await dbOperations.saveMessage(
        conversationId,
        userMessage,
        response.answer,
        response.sources,
        responseTime,
        'mixtral-8x7b-32768'
      );

      // Reload messages from database
      await loadMessages();

      // Update conversation timestamp
      await dbOperations.updateConversation(conversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[70%] rounded-lg p-3 bg-blue-500 text-white">
                <p className="whitespace-pre-wrap">{msg.user_message}</p>
              </div>
            </div>

            {/* Bot response */}
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-lg p-3 bg-gray-200 text-black">
                <p className="whitespace-pre-wrap">{msg.bot_response}</p>
                
                {/* Show sources */}
                {msg.retrieved_chunks && (
                  <div className="mt-2 text-xs opacity-70">
                    <p>Sources: {msg.retrieved_chunks.length} chunks retrieved</p>
                    <p>Response time: {msg.response_time_ms}ms</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSend()}
          placeholder="Ask a question..."
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
};