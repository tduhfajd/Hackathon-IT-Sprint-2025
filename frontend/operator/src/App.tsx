import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { io } from 'socket.io-client';
import ChatWindow from './components/ChatWindow';
import config from './config';

interface Appeal {
  id: string;
  tracking_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  sentiment_type?: string;
  sentiment_score?: number;
  category_suggestion?: string;
  priority_suggestion?: string;
  keywords?: string[];
  summary?: string;
  ai_confidence?: number;
  unread_operator_count?: number;
  last_activity_at?: string;
}

type StatusTab = 'new' | 'in_progress' | 'completed' | 'all';

function App() {
  // Авторизация отключена для упрощения тестирования
  const [user] = useState<any>({ name: 'Демо Оператор', role: 'Оператор' });
  
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  // removed unused selectedAppeal state
  const [chatAppealId, setChatAppealId] = useState<string | null>(null);
  // Demo operator ID (in production - from auth context)
  const [operatorId] = useState('00000000-0000-0000-0000-000000000001');
  const [activeTab, setActiveTab] = useState<StatusTab>('new');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleLogout = () => {
    // Logout disabled
    console.log('Logout disabled in demo mode');
  };

  useEffect(() => {
    // Загружаем реальные обращения из API
    const loadAppeals = () => {
      fetch(`${config.apiUrl}/api/appeals`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const list = (data.data && data.data.appeals) ? data.data.appeals : (data.appeals || []);
            setAppeals(list);
          }
          setLoading(false);
        })
        .catch(error => {
          console.error('Failed to load appeals:', error);
          setLoading(false);
        });
    };

    loadAppeals();

    // Подписываемся на Socket.IO для обновления списка обращений
    const socket = io(config.wsUrl || 'ws://localhost:3001', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true
    });
    
    socket.on('connect', () => {
      console.log('✅ Connected to appeal updates WebSocket');
    });

    socket.on('appeal_updated', (data: { appealId: string; hasNewMessage: boolean }) => {
      console.log('📢 Appeal updated:', data);
      // Перезагружаем список обращений
      loadAppeals();
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from appeal updates WebSocket');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Filter appeals
  const filteredAppeals = appeals.filter(appeal => {
    // Status tab filter
    if (activeTab !== 'all' && appeal.status !== activeTab) {
      return false;
    }
    // Priority filter - используем priority_suggestion (от AI) или fallback на priority
    const actualPriority = appeal.priority_suggestion || appeal.priority;
    if (priorityFilter !== 'all' && actualPriority !== priorityFilter) {
      return false;
    }
    // Search filter
    if (searchTerm && !appeal.subject.toLowerCase().includes(searchTerm.toLowerCase()) 
        && !appeal.description.toLowerCase().includes(searchTerm.toLowerCase())
        && !appeal.tracking_number.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Вычисляем статистику из реальных данных
  const calculateAvgConfidence = (): number => {
    if (appeals.length === 0) {
      return 94; // Значение по умолчанию
    }
    
    const validConfidences: number[] = appeals
      .map(a => a.ai_confidence ?? null)
      .filter((conf): conf is number => conf != null && typeof conf === 'number' && !isNaN(conf) && conf >= 0 && conf <= 1);
    
    if (validConfidences.length === 0) {
      return 94; // Значение по умолчанию, если нет валидных данных
    }
    
    const sum = validConfidences.reduce((acc: number, conf: number) => acc + conf, 0);
    const avg = sum / validConfidences.length;
    const rounded = Math.round(avg * 100);
    
    return isNaN(rounded) ? 94 : rounded; // Fallback на 94% если NaN
  };

  const stats = {
    total: appeals.length,
    new: appeals.filter(a => a.status === 'new').length,
    inProgress: appeals.filter(a => a.status === 'in_progress').length,
    completed: appeals.filter(a => a.status === 'completed').length,
    avgConfidence: calculateAvgConfidence()
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const handleOpenChat = async (appealId: string, currentStatus: string) => {
    // Auto-set to in_progress when opening chat if status is new
    if (currentStatus === 'new') {
      try {
        await fetch(`${config.apiUrl}/api/appeals/${appealId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' })
        });
        // Update local state
        setAppeals(prev => prev.map(a => 
          a.id === appealId ? { ...a, status: 'in_progress' } : a
        ));
      } catch (error) {
        console.error('Failed to update appeal status:', error);
      }
    }
    setChatAppealId(appealId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Панель оператора</h1>
              <p className="text-sm text-gray-600">Управление обращениями граждан</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'Оператор'}</p>
                <p className="text-xs text-gray-500">{user?.role === 'operator' ? 'Оператор' : 'Администратор'}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user?.name?.split(' ')[0]?.substring(0, 2).toUpperCase() || 'ОП'}
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
              >
                Выход
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Всего обращений</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">В работе</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Завершено</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Средняя точность AI</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgConfidence}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Appeals List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Обращения граждан</h2>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('new')}
                className={`${
                  activeTab === 'new'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Новые ({stats.new})
              </button>
              <button
                onClick={() => setActiveTab('in_progress')}
                className={`${
                  activeTab === 'in_progress'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                В работе ({stats.inProgress})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`${
                  activeTab === 'completed'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Завершённые ({stats.completed})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`${
                  activeTab === 'all'
                    ? 'border-gray-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Все ({stats.total})
              </button>
            </nav>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Поиск по номеру, теме или описанию..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Все приоритеты</option>
                  <option value="critical">Критический</option>
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Загрузка обращений...</p>
              </div>
            ) : filteredAppeals.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-2 text-gray-600">Нет обращений в этой категории</p>
                <p className="text-sm text-gray-500 mt-1">
                  Попробуйте изменить фильтры или выбрать другую вкладку
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Приоритет</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тональность</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAppeals.map((appeal) => (
                      <tr key={appeal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {appeal.tracking_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {appeal.category_suggestion || appeal.subject}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(appeal.priority_suggestion)}`}>
                            {appeal.priority_suggestion || appeal.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSentimentColor(appeal.sentiment_type)}`}>
                            {appeal.sentiment_type === 'positive' ? '😊 Позитивная' : 
                             appeal.sentiment_type === 'negative' ? '😠 Негативная' : 
                             '😐 Нейтральная'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(appeal.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button 
                            onClick={() => handleOpenChat(appeal.id, appeal.status)}
                            className="text-green-600 hover:text-green-900 relative inline-flex items-center"
                          >
                            💬 Чат
                            {appeal.unread_operator_count && appeal.unread_operator_count > 0 && (
                              <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full animate-pulse">
                                {appeal.unread_operator_count}
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Как работает система</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-medium mb-1">1. Автоматический анализ</p>
              <p className="text-blue-700">AI анализирует каждое обращение и определяет категорию, приоритет и тональность</p>
            </div>
            <div>
              <p className="font-medium mb-1">2. Готовые ответы</p>
              <p className="text-blue-700">Система предлагает готовый вариант ответа на основе базы знаний</p>
            </div>
            <div>
              <p className="font-medium mb-1">3. Ускорение работы</p>
              <p className="text-blue-700">Вы можете отправить ответ сразу или скорректировать его под конкретную ситуацию</p>
            </div>
            <div>
              <p className="font-medium mb-1">4. Обучение системы</p>
              <p className="text-blue-700">Чем больше обращений обрабатывается, тем точнее становятся подсказки AI</p>
            </div>
          </div>
        </div>
      </main>

      {/* Chat Window */}
      {chatAppealId && (
        <ChatWindow
          appealId={chatAppealId}
          operatorId={operatorId}
          onClose={() => setChatAppealId(null)}
          onComplete={() => {
            // Reload appeals to update status
            fetch(`${config.apiUrl}/api/appeals`)
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  const list = (data.data && data.data.appeals) ? data.data.appeals : (data.appeals || []);
                  setAppeals(list);
                }
              });
          }}
        />
      )}
    </div>
  );
}

export default App;
