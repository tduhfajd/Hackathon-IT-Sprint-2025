import TelegramBot from 'node-telegram-bot-api';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { rabbitMQService } from './RabbitMQService';
import { ChatService } from './ChatService';

// Временное хранилище для данных пользователей
interface UserSession {
  waitingForMessage: boolean;
  categoryId?: string;
  categoryName?: string;
  appealId?: string; // ID активного обращения
}

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isInitialized: boolean = false;
  private userSessions: Map<number, UserSession> = new Map();

  async initialize(token: string): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Telegram Bot already initialized');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      console.log('✅ Telegram Bot initialized');

      // Обработчик команды /start
      this.bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userName = msg.from?.first_name || 'Гражданин';

        const welcomeMessage = `
👋 Здравствуйте, ${userName}!

Добро пожаловать в систему обращений Smart Support!

📝 Используйте кнопки ниже для управления обращениями.
        `;

        // Проверяем, есть ли активное обращение
        const activeAppeal = await this.findActiveAppeal(chatId);

        const keyboard = {
          keyboard: activeAppeal 
            ? [
                [{ text: '💬 Написать сообщение' }],
                [{ text: '✅ Завершить обращение' }, { text: '❌ Отменить обращение' }],
                [{ text: '❓ Помощь' }]
              ]
            : [
                [{ text: '📝 Создать обращение' }],
                [{ text: '❓ Помощь' }]
              ],
          resize_keyboard: true,
          one_time_keyboard: false
        };

        await this.bot!.sendMessage(chatId, welcomeMessage.trim(), {
          reply_markup: keyboard
        });
      });

      // Обработчик команды /new - начало создания обращения
      this.bot.onText(/\/new/, async (msg) => {
        const chatId = msg.chat.id;
        await this.showCategorySelection(chatId);
      });

      // Обработчик команды /done - завершение текущего обращения
      this.bot.onText(/\/done/, async (msg) => {
        const chatId = msg.chat.id;
        await this.handleDoneCommand(chatId);
      });

      // Обработчик команды /cancel - отмена текущего обращения
      this.bot.onText(/\/cancel/, async (msg) => {
        const chatId = msg.chat.id;
        await this.handleCancelCommand(chatId);
      });

      // Обработчик команды /help
      this.bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        await this.showHelp(chatId);
      });

      // Обработчик callback_query (нажатие на кнопки)
      this.bot.on('callback_query', async (query) => {
        await this.handleCallbackQuery(query);
      });

      // Обработчик всех текстовых сообщений
      this.bot.on('message', async (msg) => {
        // Пропускаем команды
        if (msg.text?.startsWith('/')) {
          return;
        }

        if (!msg.text) {
          const chatId = msg.chat.id;
          await this.bot!.sendMessage(
            chatId,
            '❌ Пожалуйста, отправьте текстовое сообщение с вашим обращением.'
          );
          return;
        }

        const chatId = msg.chat.id;
        const messageText = msg.text;

        // Обработка кнопок
        if (messageText === '📝 Создать обращение') {
          await this.showCategorySelection(chatId);
          return;
        }

        if (messageText === '✅ Завершить обращение') {
          await this.handleDoneCommand(chatId);
          return;
        }

        if (messageText === '❌ Отменить обращение') {
          await this.handleCancelCommand(chatId);
          return;
        }

        if (messageText === '❓ Помощь') {
          await this.showHelp(chatId);
          return;
        }

        if (messageText === '💬 Написать сообщение') {
          const activeAppeal = await this.findActiveAppeal(chatId);
          if (activeAppeal) {
            await this.bot!.sendMessage(
              chatId,
              '✍️ Напишите ваше сообщение, и оно будет отправлено оператору:'
            );
          } else {
            await this.bot!.sendMessage(
              chatId,
              '❌ У вас нет активных обращений. Создайте новое обращение, нажав кнопку "📝 Создать обращение".'
            );
          }
          return;
        }

        const session = this.userSessions.get(chatId);

        // Проверяем, есть ли активное обращение для этого пользователя
        if (session && session.appealId) {
          // Продолжаем диалог в существующем обращении
          await this.handleContinueDialog(msg, session.appealId);
        } else if (session && session.waitingForMessage) {
          // Первое сообщение после выбора категории - создаём обращение
          await this.handleUserMessage(msg, session.categoryId!, session.categoryName!);
        } else {
          // Проверяем, есть ли активное обращение в БД
          const existingAppeal = await this.findActiveAppeal(chatId);
          if (existingAppeal) {
            // Нашли активное обращение - продолжаем диалог
            this.userSessions.set(chatId, {
              waitingForMessage: false,
              appealId: existingAppeal.id,
              categoryId: existingAppeal.category_id,
              categoryName: existingAppeal.subject
            });
            await this.handleContinueDialog(msg, existingAppeal.id);
          } else {
            // Нет активного обращения - предлагаем создать новое
            await this.bot!.sendMessage(
              chatId,
              '📝 Чтобы отправить обращение, используйте команду /new и выберите категорию.'
            );
          }
        }
      });

      this.isInitialized = true;
      console.log('✅ Telegram Bot handlers registered');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram Bot:', error);
      throw error;
    }
  }

  private async showCategorySelection(chatId: number): Promise<void> {
    try {
      // Получаем категории из БД
      const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
      const categories = result.rows;

      // Создаём кнопки (по 2 в ряд)
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (let i = 0; i < categories.length; i += 2) {
        const row: TelegramBot.InlineKeyboardButton[] = [];
        row.push({
          text: categories[i].name,
          callback_data: `cat_${categories[i].id}`
        });
        if (i + 1 < categories.length) {
          row.push({
            text: categories[i + 1].name,
            callback_data: `cat_${categories[i + 1].id}`
          });
        }
        keyboard.push(row);
      }

      await this.bot!.sendMessage(
        chatId,
        '📋 Пожалуйста, выберите категорию вашего обращения:',
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    } catch (error) {
      console.error('❌ Error showing category selection:', error);
      await this.bot!.sendMessage(
        chatId,
        '❌ Произошла ошибка. Попробуйте позже.'
      );
    }
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    try {
      const chatId = query.message!.chat.id;
      const data = query.data;

      if (!data || !data.startsWith('cat_')) {
        return;
      }

      const categoryId = data.replace('cat_', '');

      // Получаем название категории
      const result = await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
      if (result.rows.length === 0) {
        await this.bot!.answerCallbackQuery(query.id, { text: '❌ Категория не найдена' });
        return;
      }

      const categoryName = result.rows[0].name;

      // Сохраняем выбор в сессии
      this.userSessions.set(chatId, {
        waitingForMessage: true,
        categoryId,
        categoryName
      });

      // Отвечаем на callback
      await this.bot!.answerCallbackQuery(query.id, { text: `✅ Выбрано: ${categoryName}` });

      // Удаляем сообщение с кнопками
      await this.bot!.deleteMessage(chatId, query.message!.message_id);

      // Просим пользователя описать проблему
      await this.bot!.sendMessage(
        chatId,
        `✅ Категория: <b>${categoryName}</b>\n\n📝 Теперь опишите вашу проблему или вопрос:`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('❌ Error handling callback query:', error);
    }
  }

  private async findActiveAppeal(chatId: number): Promise<any | null> {
    try {
      const result = await pool.query(
        `SELECT id, category_id, subject FROM appeals 
         WHERE telegram_chat_id = $1 AND status NOT IN ('completed')
         ORDER BY created_at DESC LIMIT 1`,
        [chatId.toString()]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('❌ Error finding active appeal:', error);
      return null;
    }
  }

  private async handleContinueDialog(msg: TelegramBot.Message, appealId: string): Promise<void> {
    try {
      const chatId = msg.chat.id;
      const messageText = msg.text!;
      const userName = msg.from?.first_name || 'Гражданин';

      console.log(`💬 Continue dialog for appeal ${appealId}: ${messageText}`);

      // Находим системного пользователя для Telegram сообщений
      const systemUserResult = await pool.query(
        `SELECT id FROM users WHERE email = 'system@smartsupport.ru' LIMIT 1`
      );

      if (!systemUserResult.rows[0]) {
        console.error('⚠️ System user not found');
        await this.bot!.sendMessage(chatId, '❌ Ошибка системы. Попробуйте позже.');
        return;
      }

      const systemUserId = systemUserResult.rows[0].id;

      // Сохраняем сообщение в чат
      const messageResult = await pool.query(
        `INSERT INTO chat_messages (appeal_id, sender_id, sender_type, message, created_at)
         VALUES ($1, $2, 'citizen', $3, NOW())
         RETURNING *`,
        [appealId, systemUserId, messageText]
      );

      console.log(`✅ Message saved to chat for appeal ${appealId}`);

      // Отправляем WebSocket событие оператору
      const io = ChatService.getIO();
      if (io) {
        const savedMessage = messageResult.rows[0];
        io.to(`appeal_${appealId}`).emit('new_message', {
          id: savedMessage.id,
          appeal_id: appealId,
          sender_id: systemUserId,
          sender_type: 'citizen',
          message_text: messageText,
          created_at: savedMessage.created_at
        });
        console.log(`📡 WebSocket event 'new_message' sent for appeal ${appealId}`);
        
        // Отправляем также событие обновления обращения
        io.emit('appeal_updated', { appealId, hasNewMessage: true });
      }

      // Обновляем счетчик непрочитанных и время последней активности
      await pool.query(
        `UPDATE appeals 
         SET unread_operator_count = unread_operator_count + 1,
             last_activity_at = NOW(),
             status = 'new'
         WHERE id = $1 AND status = 'in_progress'`,
        [appealId]
      );

      // Опционально: запускаем AI для контекстного ответа
      try {
        await rabbitMQService.enqueueContextualResponse(appealId);
      } catch (error) {
        console.warn('⚠️ Failed to enqueue contextual response:', error);
      }

      // Показываем кнопки управления диалогом
      const keyboard = {
        keyboard: [
          [{ text: '💬 Написать сообщение' }],
          [{ text: '✅ Завершить обращение' }, { text: '❌ Отменить обращение' }],
          [{ text: '❓ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      // Отправляем подтверждение с кнопками
      await this.bot!.sendMessage(
        chatId,
        '✅ Сообщение отправлено оператору. Ожидайте ответ...',
        {
          reply_markup: keyboard
        }
      );
    } catch (error) {
      console.error('❌ Error handling continue dialog:', error);
      await this.bot!.sendMessage(
        msg.chat.id,
        '❌ Произошла ошибка. Попробуйте позже.'
      );
    }
  }

  private async handleUserMessage(msg: TelegramBot.Message, categoryId: string, categoryName: string): Promise<void> {
    try {
      const chatId = msg.chat.id;
      const userName = msg.from?.first_name || 'Гражданин';
      const userLastName = msg.from?.last_name || '';
      const username = msg.from?.username;
      const messageText = msg.text!;

      console.log(`📨 Received message from Telegram user ${userName} (${chatId}): ${messageText} [Category: ${categoryName}]`);

      // Отправляем подтверждение пользователю
      await this.bot!.sendMessage(
        chatId,
        '⏳ Минуту, ожидайте ответ. Мы анализируем ваше обращение…'
      );

      // Создаем обращение в базе данных
      const appealId = uuidv4();
      const trackingNumber = `TEL-${Date.now()}`;

      // Сохраняем обращение в БД с выбранной категорией
      await pool.query(
        `INSERT INTO appeals (
          id, tracking_number, user_name, user_last_name, user_email, 
          subject, description, status, source, telegram_chat_id, telegram_username, category_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          appealId,
          trackingNumber,
          userName,
          userLastName,
          username ? `${username}@telegram` : null,
          categoryName,
          messageText,
          'new',
          'telegram',
          chatId.toString(),
          username || null,
          categoryId
        ]
      );

      console.log(`✅ Appeal created: ${appealId} [Category: ${categoryName}]`);

      // Сохраняем appealId в сессии для продолжения диалога
      this.userSessions.set(chatId, {
        waitingForMessage: false,
        appealId,
        categoryId,
        categoryName
      });

      // Отправляем задачу на анализ AI
      // Примечание: Сообщение пользователя будет сохранено в chat_messages 
      // автоматически в задаче generate_response
      await rabbitMQService.enqueueAppealAnalysis(appealId, categoryName, messageText);

      // Отправляем задачу на генерацию ответа AI
      await rabbitMQService.enqueueResponseGeneration(appealId, categoryName, messageText);

      console.log(`✅ AI tasks queued for appeal ${appealId}`);

      // Отправляем WebSocket событие оператору о новом обращении
      const io = ChatService.getIO();
      if (io) {
        io.emit('appeal_updated', { appealId, hasNewMessage: true });
        console.log(`📡 WebSocket event 'appeal_updated' sent for new appeal ${appealId}`);
      }

      // Показываем кнопки управления диалогом
      const keyboard = {
        keyboard: [
          [{ text: '💬 Написать сообщение' }],
          [{ text: '✅ Завершить обращение' }, { text: '❌ Отменить обращение' }],
          [{ text: '❓ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      await this.bot!.sendMessage(
        chatId,
        '✅ <b>Обращение создано!</b>\n\nВаше обращение передано оператору. Вы можете продолжить диалог, нажав кнопку "💬 Написать сообщение" или написав новое сообщение.\n\nДля завершения обращения нажмите "✅ Завершить обращение"',
        {
          parse_mode: 'HTML',
          reply_markup: keyboard
        }
      );
    } catch (error) {
      console.error('❌ Error handling user message:', error);
      // Уведомляем пользователя об ошибке
      const chatId = msg.chat.id;
      await this.bot!.sendMessage(
        chatId,
        '❌ Произошла ошибка при обработке вашего обращения. Пожалуйста, попробуйте позже.'
      );
    }
  }

  private async handleDoneCommand(chatId: number): Promise<void> {
    try {
      // Находим активное обращение
      const appeal = await this.findActiveAppeal(chatId);
      
      if (!appeal) {
        await this.bot!.sendMessage(
          chatId,
          '❌ У вас нет активных обращений.\n\nЧтобы создать новое, используйте /new'
        );
        return;
      }

      // Закрываем обращение
      await pool.query(
        `UPDATE appeals SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [appeal.id]
      );

      // Удаляем сессию
      this.userSessions.delete(chatId);

      // Показываем кнопки для нового обращения
      const keyboard = {
        keyboard: [
          [{ text: '📝 Создать обращение' }],
          [{ text: '❓ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      // Отправляем прощальное сообщение
      await this.bot!.sendMessage(
        chatId,
        `✅ <b>Обращение завершено!</b>\n\nБлагодарим за обращение в службу поддержки Smart Support.\n\nЕсли у вас возникнут новые вопросы, нажмите кнопку "📝 Создать обращение"\n\nХорошего дня! 👋`,
        { 
          parse_mode: 'HTML',
          reply_markup: keyboard
        }
      );

      console.log(`✅ Appeal ${appeal.id} marked as completed by user`);
    } catch (error) {
      console.error('❌ Error handling /done command:', error);
      await this.bot!.sendMessage(
        chatId,
        '❌ Произошла ошибка. Попробуйте позже.'
      );
    }
  }

  private async handleCancelCommand(chatId: number): Promise<void> {
    try {
      // Находим активное обращение
      const appeal = await this.findActiveAppeal(chatId);
      
      if (!appeal) {
        await this.bot!.sendMessage(
          chatId,
          '❌ У вас нет активных обращений.\n\nЧтобы создать новое, используйте /new'
        );
        return;
      }

      // Отменяем обращение (переводим в completed)
      await pool.query(
        `UPDATE appeals SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [appeal.id]
      );

      // Удаляем сессию
      this.userSessions.delete(chatId);

      // Показываем кнопки для нового обращения
      const keyboard = {
        keyboard: [
          [{ text: '📝 Создать обращение' }],
          [{ text: '❓ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      // Отправляем сообщение
      await this.bot!.sendMessage(
        chatId,
        `🚫 <b>Обращение отменено</b>\n\nВаше обращение было отменено и закрыто.\n\nЕсли передумаете, нажмите кнопку "📝 Создать обращение"`,
        { 
          parse_mode: 'HTML',
          reply_markup: keyboard
        }
      );

      console.log(`✅ Appeal ${appeal.id} cancelled by user`);
    } catch (error) {
      console.error('❌ Error handling /cancel command:', error);
      await this.bot!.sendMessage(
        chatId,
        '❌ Произошла ошибка. Попробуйте позже.'
      );
    }
  }

  async sendMessage(chatId: string, message: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram Bot not initialized');
    }

    try {
      // Показываем кнопки управления диалогом после ответа оператора
      const keyboard = {
        keyboard: [
          [{ text: '💬 Написать сообщение' }],
          [{ text: '✅ Завершить обращение' }, { text: '❌ Отменить обращение' }],
          [{ text: '❓ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      await this.bot.sendMessage(parseInt(chatId), message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      console.log(`✅ Message sent to Telegram chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send message to Telegram chat ${chatId}:`, error);
      throw error;
    }
  }

  private async showHelp(chatId: number): Promise<void> {
    const helpMessage = `
ℹ️ <b>Помощь по боту Smart Support</b>

<b>📝 Как отправить обращение:</b>
1. Нажмите кнопку "📝 Создать обращение"
2. Выберите категорию из списка
3. Опишите вашу проблему
4. Получите ответ от оператора

<b>💬 Диалог:</b>
• Вы можете продолжать писать сообщения
• Все они попадают в один чат с оператором
• Когда вопрос решен, нажмите "✅ Завершить обращение"

<b>📌 Категории обращений:</b>
Водоснабжение, Теплоснабжение, Электроснабжение, 
Благоустройство, Мусор, Плата за ЖКУ и другие.

<b>🔘 Кнопки управления:</b>
📝 Создать обращение - начать новое обращение
💬 Написать сообщение - продолжить диалог
✅ Завершить обращение - закрыть текущее обращение
❌ Отменить обращение - отменить обращение без решения

<i>Используйте кнопки ниже для удобной работы!</i>
    `;

    // Проверяем, есть ли активное обращение
    const activeAppeal = await this.findActiveAppeal(chatId);

    const keyboard = {
      keyboard: activeAppeal 
        ? [
            [{ text: '💬 Написать сообщение' }],
            [{ text: '✅ Завершить обращение' }, { text: '❌ Отменить обращение' }]
          ]
        : [
            [{ text: '📝 Создать обращение' }]
          ],
      resize_keyboard: true,
      one_time_keyboard: false
    };

    await this.bot!.sendMessage(chatId, helpMessage.trim(), {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  async notifyAppealCompleted(chatId: string, operatorName?: string): Promise<void> {
    if (!this.bot) {
      console.warn('Telegram Bot not initialized');
      return;
    }

    try {
      const message = operatorName 
        ? `✅ <b>Обращение завершено оператором ${operatorName}</b>\n\nБлагодарим за обращение! Если у вас возникнут новые вопросы, нажмите кнопку "📝 Создать обращение"\n\nХорошего дня! 👋`
        : `✅ <b>Обращение завершено</b>\n\nБлагодарим за обращение! Если у вас возникнут новые вопросы, нажмите кнопку "📝 Создать обращение"\n\nХорошего дня! 👋`;
      
      // Показываем кнопки после завершения
      const keyboard = {
        keyboard: [
          [{ text: '📝 Создать обращение' }],
          [{ text: '❓ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      await this.bot.sendMessage(parseInt(chatId), message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      console.log(`✅ Completion notification sent to Telegram chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send completion notification to Telegram chat ${chatId}:`, error);
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.bot !== null;
  }
}

export default new TelegramBotService();
