import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import config from './config';
import ChatModal from './components/ChatModal';

interface AppealForm {
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  description: string;
}

function App() {
  const [form, setForm] = useState<AppealForm>({
    fullName: '',
    phone: '',
    email: '',
    subject: '',
    description: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [appealId, setAppealId] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [citizenUserId, setCitizenUserId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${config.apiUrl}/api/appeals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: form.fullName,
          phone: form.phone,
          email: form.email || null,
          subject: form.subject,
          description: form.description
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const tracking = data?.data?.tracking_number || data?.appeal?.tracking_number;
        const appeal = data?.data?.id || data?.appeal?.id;
        const citizenId = data?.data?.citizen_user_id || null;
        if (!tracking) throw new Error('No tracking number in response');
        if (!appeal) throw new Error('No appeal ID in response');
        setCitizenUserId(citizenId);
        setTrackingNumber(tracking);
        setAppealId(appeal);
        setSubmitted(true);
        // Автоматически открываем чат через небольшую задержку
        setTimeout(() => setChatOpen(true), 1000);
        toast.success('Обращение успешно отправлено!');
      } else {
        toast.error('Ошибка при отправке обращения');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ошибка подключения к серверу');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        {chatOpen && appealId && (
          <ChatModal
            appealId={appealId}
            citizenId={citizenUserId || `guest-${appealId}`}
            onClose={() => setChatOpen(false)}
          />
        )}
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Обращение отправлено!</h2>
            <p className="text-gray-600 mb-4">Ваш номер для отслеживания:</p>
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-2xl font-mono font-bold text-blue-600">{trackingNumber}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                💬 Вы можете продолжить общение с оператором в чате
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Сохраните номер для проверки статуса вашего обращения
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setChatOpen(true)}
                className="w-full bg-green-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {chatOpen ? 'Чат открыт' : 'Открыть чат с оператором'}
              </button>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setChatOpen(false);
                  setAppealId('');
                  setForm({
                    fullName: '',
                    phone: '',
                    email: '',
                    subject: '',
                    description: ''
                  });
                }}
                className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-700 transition-colors"
              >
                Создать новое обращение
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">Подать обращение</h1>
            <p className="text-blue-100 mt-2">Умный помощник для обработки обращений граждан</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                ФИО
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Иванов Иван Иванович"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Телефон
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email (необязательно)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="email@example.com"
              />
            </div>

            {/* Subject as select (fixed categories) */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Категория обращения <span className="text-red-500">*</span>
              </label>
              <select
                id="subject"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              >
                <option value="" disabled>Выберите категорию</option>
                <option value="Благоустройство">Благоустройство</option>
                <option value="Дворы и территории общего пользования">Дворы и территории общего пользования</option>
                <option value="Многоквартирные дома">Многоквартирные дома</option>
                <option value="Мусор">Мусор</option>
                <option value="Плата за ЖКУ">Плата за ЖКУ</option>
                <option value="Водоснабжение">Водоснабжение</option>
                <option value="Теплоснабжение">Теплоснабжение</option>
                <option value="Электроснабжение">Электроснабжение</option>
                <option value="Парки культуры и отдыха">Парки культуры и отдыха</option>
                <option value="Социальная газификация">Социальная газификация</option>
                <option value="Иное">Иное</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Описание проблемы <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Подробно опишите вашу проблему или вопрос..."
              />
              <p className="mt-2 text-sm text-gray-500">
                Чем подробнее вы опишете проблему, тем быстрее мы сможем помочь
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-6 py-4 font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Отправить обращение
              </button>
            </div>
          </form>
        </div>

        {/* Info Block */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">ℹ️ Что происходит после отправки?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">1.</span>
              <span>Система автоматически проанализирует ваше обращение</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">2.</span>
              <span>Определит категорию, приоритет и тональность</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">3.</span>
              <span>Оператор получит готовый вариант ответа на основе базы знаний</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">4.</span>
              <span>Вы получите ответ в кратчайшие сроки</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;

