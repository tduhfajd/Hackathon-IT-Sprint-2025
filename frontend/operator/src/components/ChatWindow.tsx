import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL, API_URL } from '../config';

interface Message {
  id: string;
  appeal_id: string;
  sender_id: string;
  sender_type: 'citizen' | 'operator' | 'system';
  message_text: string;
  created_at: string;
}

interface AIResponse {
  suggested_text: string;
  confidence: number;
  category_suggestion?: string;
  priority_suggestion?: string;
}

interface ChatWindowProps {
  appealId: string;
  operatorId: string;
  onClose: () => void;
  onComplete?: () => void;
}

const QUICK_REPLIES = [
  'Спасибо за обращение!',
  'Благодарю за информацию.',
  'Были рады вам помочь.',
  'До свидания!',
  'Хорошего дня!',
];

const ChatWindow: React.FC<ChatWindowProps> = ({ appealId, operatorId, onClose, onComplete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [citizenTyping, setCitizenTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [completing, setCompleting] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка AI ответа
  useEffect(() => {
    const fetchAIResponse = async () => {
      try {
        setAiLoading(true);
        const response = await fetch(`${API_URL}/api/appeals/${appealId}/ai-response`);
        const data = await response.json();
        
        if (data.success && data.data) {
          setAiResponse({
            suggested_text: data.data.suggested_text,
            confidence: data.data.confidence,
            category_suggestion: data.data.category_suggestion,
            priority_suggestion: data.data.priority_suggestion
          });
        }
      } catch (error) {
        console.error('Failed to load AI response:', error);
      } finally {
        setAiLoading(false);
      }
    };

    fetchAIResponse();
  }, [appealId]);

  useEffect(() => {
    // Подключение к WebSocket
    const socket = io(WS_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    // События подключения
    socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      setConnected(true);
      
      // Присоединяемся к комнате обращения
      socket.emit('join_appeal', {
        appealId,
        userId: operatorId,
        userType: 'operator'
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
      setConnected(false);
    });

    // История чата
    socket.on('chat_history', (history: Message[]) => {
      console.log('📜 Received chat history:', history.length, 'messages');
      setMessages(history);
    });

    // Новое сообщение
    socket.on('new_message', (message: Message) => {
      console.log('💬 New message:', message);
      setMessages(prev => [...prev, message]);
    });

    // Индикатор печати
    socket.on('user_typing', (data: { userId: string; userType: string; isTyping: boolean }) => {
      if (data.userType === 'citizen') {
        setCitizenTyping(data.isTyping);
      }
    });

    // Пользователь присоединился
    socket.on('user_joined', (data: { userId: string; userType: string }) => {
      console.log('👋 User joined:', data);
    });

    // Пользователь покинул
    socket.on('user_left', (data: { userId: string }) => {
      console.log('👋 User left:', data);
    });

    // Ошибка
    socket.on('error', (error: { message: string }) => {
      console.error('❌ Chat error:', error);
      alert('Ошибка чата: ' + error.message);
    });

    // Очистка при размонтировании
    return () => {
      if (socket) {
        socket.emit('leave_appeal', { appealId, userId: operatorId });
        socket.disconnect();
      }
    };
  }, [appealId, operatorId]);

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socketRef.current) return;

    // Отправка сообщения
    socketRef.current.emit('send_message', {
      appealId,
      senderId: operatorId,
      senderType: 'operator',
      message: newMessage.trim()
    });

    setNewMessage('');
    setIsTyping(false);
    
    // Отправка индикатора печати (не печатаем)
    socketRef.current.emit('typing', {
      appealId,
      userId: operatorId,
      userType: 'operator',
      isTyping: false
    });
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (!socketRef.current) return;

    // Отправка индикатора печати
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current.emit('typing', {
        appealId,
        userId: operatorId,
        userType: 'operator',
        isTyping: true
      });
    }

    // Сброс таймера
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Через 2 секунды отправляем что перестали печатать
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socketRef.current) {
        socketRef.current.emit('typing', {
          appealId,
          userId: operatorId,
          userType: 'operator',
          isTyping: false
        });
      }
    }, 2000);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const handleUseAIResponse = () => {
    if (aiResponse) {
      setNewMessage(aiResponse.suggested_text);
    }
  };

  const handleQuickReply = (text: string) => {
    setNewMessage(prev => prev ? `${prev} ${text}` : text);
    setShowQuickReplies(false);
  };

  const handleCompleteAppeal = async () => {
    if (!window.confirm('Завершить это обращение? Оно будет перемещено в "Завершённые".')) {
      return;
    }

    setCompleting(true);
    try {
      const response = await fetch(`${API_URL}/api/appeals/${appealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });

      if (response.ok) {
        alert('✅ Обращение завершено!');
        if (onComplete) {
          onComplete();
        }
        onClose();
      } else {
        alert('❌ Ошибка при завершении обращения');
      }
    } catch (error) {
      console.error('Failed to complete appeal:', error);
      alert('❌ Ошибка подключения');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-5/6 flex flex-col">
        {/* Заголовок */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Чат по обращению</h3>
            <p className="text-sm opacity-90">ID: {appealId.substring(0, 8)}...</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm">{connected ? 'Подключено' : 'Отключено'}</span>
            <button
              onClick={handleCompleteAppeal}
              disabled={completing}
              className="ml-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold disabled:bg-gray-400 transition"
            >
              {completing ? 'Завершаю...' : '✓ Завершить'}
            </button>
            <button
              onClick={onClose}
              className="ml-2 text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Область сообщений */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
              <p>Пока нет сообщений</p>
              <p className="text-sm mt-2">Начните диалог с гражданином</p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`mb-4 flex ${
                msg.sender_type === 'operator' 
                  ? 'justify-end' 
                  : msg.sender_type === 'system' 
                  ? 'justify-center' 
                  : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.sender_type === 'operator'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : msg.sender_type === 'system'
                    ? 'bg-gray-200 text-gray-700 italic text-sm'
                    : 'bg-white text-gray-800 rounded-bl-none shadow'
                }`}
              >
                {msg.sender_type !== 'system' && (
                  <p className="text-sm font-semibold mb-1">
                    {msg.sender_type === 'operator' ? 'Вы (Оператор)' : 'Гражданин'}
                  </p>
                )}
                <p className="break-words">{msg.message_text}</p>
                {msg.sender_type !== 'system' && (
                  <p className={`text-xs mt-1 ${msg.sender_type === 'operator' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Индикатор печати */}
          {citizenTyping && (
            <div className="mb-4 flex justify-start">
              <div className="bg-white text-gray-800 px-4 py-2 rounded-lg shadow">
                <p className="text-sm">Гражданин печатает...</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* AI Suggested Response */}
        {aiResponse && (
          <div className={`p-4 border-t ${
            aiResponse.confidence < 0.5 
              ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200' 
              : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${
                  aiResponse.confidence < 0.5 ? 'text-orange-600' : 'text-purple-600'
                }`}>
                  {aiResponse.confidence < 0.5 ? '⚠️ AI (требуется уточнение):' : '🤖 AI предлагает:'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  aiResponse.confidence < 0.5 
                    ? 'bg-orange-200 text-orange-800' 
                    : 'bg-purple-200 text-purple-800'
                }`}>
                  Уверенность: {Math.round(aiResponse.confidence * 100)}%
                </span>
              </div>
              <button
                onClick={handleUseAIResponse}
                className={`text-xs text-white px-3 py-1 rounded transition ${
                  aiResponse.confidence < 0.5
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                Использовать ответ
              </button>
            </div>
            {aiResponse.confidence < 0.5 && (
              <div className="mb-2 p-2 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800">
                <strong>⚠️ ВНИМАНИЕ:</strong> В базе знаний нет информации по этой теме. Рекомендуется уточнить информацию вручную или добавить статью в базу знаний.
              </div>
            )}
            <p className={`text-sm text-gray-700 bg-white p-3 rounded whitespace-pre-wrap ${
              aiResponse.confidence < 0.5 ? 'border border-orange-200' : 'border border-purple-200'
            }`}>
              {aiResponse.suggested_text}
            </p>
          </div>
        )}

        {aiLoading && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              <span>Загрузка AI рекомендаций...</span>
            </div>
          </div>
        )}

        {/* Quick Replies */}
        <div className="px-4 pt-2 bg-white border-t border-gray-200">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showQuickReplies ? '▼' : '▶'} Быстрые ответы
          </button>
          {showQuickReplies && (
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {QUICK_REPLIES.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickReply(reply)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full border border-gray-300 transition"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Форма ввода */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white rounded-b-lg">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Введите сообщение... (Enter - отправить, Shift+Enter - новая строка)"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              disabled={!connected}
            />
            <button
              type="submit"
              disabled={!connected || !newMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 h-fit"
            >
              Отправить
            </button>
          </div>
          {isTyping && (
            <p className="text-xs text-gray-500 mt-2">Печатаете...</p>
          )}
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;

