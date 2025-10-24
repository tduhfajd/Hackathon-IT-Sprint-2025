import { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import LoginForm from './components/LoginForm';
import config from './config';

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category_id?: string;
  category_name?: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category_id: '',
    tags: [] as string[],
    is_active: true
  });

  // Проверка авторизации при загрузке
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      fetch(`${config.apiUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.user.role === 'admin') {
          setUser(JSON.parse(savedUser));
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        }
        setAuthLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setAuthLoading(false);
      });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const handleLoginSuccess = (_token: string, userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Load articles
  useEffect(() => {
    loadArticles();
    loadCategories();
  }, []);

  const loadArticles = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/knowledge-base`);
      const data = await response.json();
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (error) {
      console.error('Failed to load articles:', error);
      toast.error('Не удалось загрузить статьи');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/knowledge-base/meta/categories`);
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadArticles();
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/knowledge-base/search/query?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Ошибка поиска');
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Заполните название и содержание');
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/knowledge-base`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Статья создана!');
        loadArticles();
        resetForm();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to create article:', error);
      toast.error('Ошибка создания статьи');
    }
  };

  const handleUpdate = async () => {
    if (!selectedArticle) return;

    try {
      const response = await fetch(`${config.apiUrl}/api/knowledge-base/${selectedArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Статья обновлена!');
        loadArticles();
        resetForm();
        setIsEditing(false);
        setSelectedArticle(null);
      }
    } catch (error) {
      console.error('Failed to update article:', error);
      toast.error('Ошибка обновления статьи');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту статью?')) return;

    try {
      const response = await fetch(`${config.apiUrl}/api/knowledge-base/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Статья удалена');
        loadArticles();
      }
    } catch (error) {
      console.error('Failed to delete article:', error);
      toast.error('Ошибка удаления статьи');
    }
  };

  const handleEdit = (article: KnowledgeBaseArticle) => {
    setSelectedArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      category_id: article.category_id || '',
      tags: article.tags || [],
      is_active: article.is_active
    });
    setIsEditing(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category_id: '',
      tags: [],
      is_active: true
    });
    setSelectedArticle(null);
  };

  const stats = {
    total: articles.length,
    active: articles.filter(a => a.is_active).length,
    inactive: articles.filter(a => !a.is_active).length
  };

  // Показываем форму входа, если не авторизован
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div>
                <h1 className="text-3xl font-bold text-white">База знаний</h1>
                <p className="text-purple-100 mt-1">Управление статьями и категориями</p>
              </div>
              <div className="text-purple-100 text-sm">
                <p className="font-medium">{user?.name}</p>
                <p className="text-xs opacity-90">Администратор</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => { setIsEditing(true); resetForm(); }}
                className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-purple-50 transition"
              >
                ➕ Создать статью
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-white hover:bg-purple-700 rounded-lg transition-colors border border-purple-400"
              >
                Выход
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                📚
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Всего статей</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                ✅
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Активных</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gray-100 rounded-md p-3">
                ❌
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Неактивных</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск по названию, содержанию или тегам..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSearch}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              🔍 Найти
            </button>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); loadArticles(); }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Articles Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Теги</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Обновлено</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Загрузка...
                  </td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Нет статей
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{article.title}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {article.content.substring(0, 100)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {article.category_name || 'Без категории'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(article.tags || []).slice(0, 3).map((tag, i) => (
                          <span key={i} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        article.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {article.is_active ? 'Активна' : 'Неактивна'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(article.updated_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(article)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        ✏️ Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(article.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Edit/Create Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-5/6 overflow-y-auto p-8">
            <h3 className="text-2xl font-bold mb-6">
              {selectedArticle ? 'Редактировать статью' : 'Создать новую статью'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Введите название статьи"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Выберите категорию</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Содержание (Markdown)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={15}
                  placeholder="Введите содержание статьи в формате Markdown..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Теги (через запятую)</label>
                <input
                  type="text"
                  value={(formData.tags || []).join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                  })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="например: ЖКХ, отопление, тарифы"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Статья активна
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => { setIsEditing(false); resetForm(); }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
              >
                Отмена
              </button>
              <button
                onClick={selectedArticle ? handleUpdate : handleCreate}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
              >
                {selectedArticle ? 'Обновить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
