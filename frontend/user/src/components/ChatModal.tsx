import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config';

interface Message {
  id?: string;
  appeal_id: string;
  sender_id: string;
  sender_type: 'citizen' | 'operator' | 'system';
  message_text?: string; // for compatibility with operator
  message?: string; // for backend ChatService.saveMessage expects 'message'
  created_at?: string;
}

interface ChatModalProps {
  appealId: string;
  citizenId: string;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ appealId, citizenId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      const joinData = { appealId, userId: citizenId, userType: 'citizen' };
      console.log('📍 Joining appeal:', joinData);
      socket.emit('join_appeal', joinData);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('chat_history', (history: Message[]) => {
      setMessages(history || []);
    });

    socket.on('new_message', (msg: any) => {
      const normalized: Message = {
        appeal_id: msg.appeal_id || appealId,
        sender_id: msg.sender_id || citizenId,
        sender_type: msg.sender_type || 'citizen',
        message_text: msg.message_text || msg.message,
        message: msg.message || msg.message_text,
        created_at: msg.created_at
      };
      
      // Избегаем дублирования - не добавляем свои сообщения повторно
      setMessages(prev => {
        // Если это мое сообщение и оно уже есть (оптимистичное), пропускаем
        if (normalized.sender_id === citizenId && normalized.sender_type === 'citizen') {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && 
              lastMessage.message_text === normalized.message_text && 
              lastMessage.sender_type === 'citizen') {
            return prev; // Уже есть
          }
        }
        return [...prev, normalized];
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_appeal', { appealId, userId: citizenId });
        socketRef.current.disconnect();
      }
    };
  }, [appealId, citizenId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !socketRef.current) return;
    
    const messageText = text.trim();
    
    console.log('📤 Sending message:', { appealId, citizenId, messageText, connected });
    
    // Оптимистичное обновление UI - сразу показываем сообщение
    const optimisticMessage: Message = {
      appeal_id: appealId,
      sender_id: citizenId,
      sender_type: 'citizen',
      message_text: messageText,
      message: messageText,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setText('');
    
    // Отправляем на сервер
    const messageData = {
      appealId,
      senderId: citizenId,
      senderType: 'citizen',
      message: messageText
    };
    console.log('📡 Emitting send_message:', messageData);
    socketRef.current.emit('send_message', messageData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <h3 className="font-semibold">Чат по обращению</h3>
            <span className="text-sm text-gray-500">ID: {appealId.slice(0, 8)}...</span>
          </div>
          <button onClick={onClose} className="text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">Сообщений пока нет</div>
          )}
          {messages.map((m, idx) => (
            <div key={idx} className={`mb-3 flex ${m.sender_type === 'citizen' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-3 py-2 rounded-lg ${m.sender_type === 'citizen' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none shadow'}`}>
                <div className="text-xs opacity-80 mb-1">{m.sender_type === 'citizen' ? 'Вы' : 'Оператор'}</div>
                <div>{m.message_text || m.message}</div>
                {m.created_at && (
                  <div className={`text-[10px] mt-1 ${m.sender_type === 'citizen' ? 'text-blue-100' : 'text-gray-500'}`}>{new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={sendMessage} className="p-3 border-t bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!connected}
            />
            <button type="submit" disabled={!connected || !text.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400">Отправить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
