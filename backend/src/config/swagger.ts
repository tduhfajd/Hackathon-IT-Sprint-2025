import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SmartSupport API',
      version: '1.0.0',
      description: `
        # SmartSupport - Интеллектуальный помощник по работе с обращениями
        
        Система обработки обращений граждан с использованием искусственного интеллекта.
        
        **Разработано командой "Имени товарища Вертера" (КИТВ)**  
        От Школы 21 для участия в кейс-чемпионате Белгородской области  
        в сфере информационных технологий **(ИТ-Спринт 2025)**
        
        ## Возможности
        
        - 🤖 **ИИ-анализ обращений** (приоритет, тональность)
        - 💡 **AI-рекомендации ответов** на основе базы знаний
        - 🔍 **Поиск в базе знаний** с ранжированием по релевантности
        - 💬 **Чат в реальном времени** через WebSocket
        - 📱 **Telegram бот** для приёма обращений
        - 📚 **Управление базой знаний** через админ-панель
        - 📊 **Автоматическое управление статусами** обращений
        
        ## Технологии
        
        - Backend: Node.js 18, Express, TypeScript
        - База данных: PostgreSQL 15, Redis 7
        - Очереди: RabbitMQ 3.12, Celery (Python)
        - ИИ: GigaChat API (РФ)
        - WebSocket: Socket.io
        - Telegram: Telegram Bot API
        
        ## Демо-доступы
        
        **Оператор:**
        - Логин: \`demo\`
        - Пароль: \`demo\`
        
        **Администратор:**
        - Логин: \`admin\`
        - Пароль: \`admin\`
      `,
      contact: {
        name: 'Команда КИТВ',
        url: 'https://smartsupport.vadimevgrafov.ru'
      },
      license: {
        name: 'Educational',
        url: 'https://smartsupport.vadimevgrafov.ru'
      }
    },
    servers: [
      {
        url: 'https://api-smartsupport.vadimevgrafov.ru',
        description: 'Production сервер'
      },
      {
        url: 'http://localhost:3001',
        description: 'Development сервер'
      }
    ],
    tags: [
      {
        name: 'Appeals',
        description: 'Управление обращениями граждан'
      },
      {
        name: 'Authentication',
        description: 'Авторизация и аутентификация'
      },
      {
        name: 'Knowledge Base',
        description: 'Управление базой знаний'
      },
      {
        name: 'Categories',
        description: 'Управление категориями'
      },
      {
        name: 'AI',
        description: 'ИИ-анализ и генерация ответов'
      },
      {
        name: 'Chat',
        description: 'Чат в реальном времени (WebSocket)'
      },
      {
        name: 'System',
        description: 'Системные endpoints'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT токен полученный через /api/auth/demo-login'
        }
      },
      schemas: {
        Appeal: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Уникальный идентификатор обращения'
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID пользователя (автоматически создается)'
            },
            tracking_number: {
              type: 'string',
              description: 'Номер для отслеживания обращения',
              example: 'APMH3W41J61OMDG9'
            },
            subject: {
              type: 'string',
              description: 'Тема обращения (категория)',
              example: 'Теплоснабжение'
            },
            description: {
              type: 'string',
              description: 'Описание проблемы',
              example: 'В квартире холодно, температура 16 градусов'
            },
            status: {
              type: 'string',
              enum: ['new', 'in_progress', 'completed'],
              description: 'Статус обращения'
            },
            source: {
              type: 'string',
              enum: ['web', 'telegram'],
              description: 'Источник обращения'
            },
            telegram_chat_id: {
              type: 'string',
              description: 'Telegram Chat ID (если источник telegram)'
            },
            telegram_username: {
              type: 'string',
              description: 'Telegram username (если источник telegram)'
            },
            user_name: {
              type: 'string',
              description: 'Имя пользователя'
            },
            user_last_name: {
              type: 'string',
              description: 'Фамилия пользователя'
            },
            unread_operator_count: {
              type: 'integer',
              description: 'Количество непрочитанных сообщений для оператора',
              default: 0
            },
            last_activity_at: {
              type: 'string',
              format: 'date-time',
              description: 'Время последней активности'
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID категории обращения'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Приоритет обращения'
            },
            category_suggestion: {
              type: 'string',
              description: 'Категория предложенная ИИ'
            },
            priority_suggestion: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Приоритет предложенный ИИ'
            },
            sentiment_type: {
              type: 'string',
              enum: ['positive', 'neutral', 'negative'],
              description: 'Тональность обращения'
            },
            sentiment_score: {
              type: 'number',
              format: 'float',
              description: 'Оценка тональности (0.0 - 1.0)'
            },
            keywords: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Ключевые слова извлеченные ИИ'
            },
            ai_confidence: {
              type: 'number',
              format: 'float',
              description: 'Уверенность ИИ в анализе (0.0 - 1.0)'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        CreateAppealRequest: {
          type: 'object',
          required: ['full_name', 'phone', 'subject', 'description'],
          properties: {
            full_name: {
              type: 'string',
              description: 'Полное имя гражданина',
              example: 'Иванов Иван Иванович'
            },
            phone: {
              type: 'string',
              description: 'Телефон',
              example: '+79991234567'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email (опционально)',
              example: 'ivanov@test.ru'
            },
            subject: {
              type: 'string',
              description: 'Категория обращения',
              example: 'Теплоснабжение'
            },
            description: {
              type: 'string',
              description: 'Описание проблемы',
              example: 'В квартире холодно, температура 16 градусов'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Логин пользователя',
              example: 'demo'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Пароль',
              example: 'demo'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'JWT токен'
                },
                user: {
                  type: 'object',
                  properties: {
                    username: {
                      type: 'string',
                      example: 'demo'
                    },
                    role: {
                      type: 'string',
                      enum: ['operator', 'admin'],
                      example: 'operator'
                    },
                    name: {
                      type: 'string',
                      example: 'Демо Оператор'
                    }
                  }
                }
              }
            }
          }
        },
        KnowledgeBaseArticle: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string',
              description: 'Заголовок статьи',
              example: 'Теплоснабжение и отопительный сезон'
            },
            content: {
              type: 'string',
              description: 'Содержание статьи (Markdown)'
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID категории'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Теги статьи',
              example: ['отопление', 'температура', 'батареи']
            },
            is_active: {
              type: 'boolean',
              description: 'Активна ли статья',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Сообщение об ошибке'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string'
                  },
                  message: {
                    type: 'string'
                  }
                }
              },
              description: 'Детали ошибок валидации'
            }
          }
        }
      }
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Проверка здоровья системы',
          description: 'Проверяет доступность API и подключение к базе данных',
          responses: {
            '200': {
              description: 'Система работает',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'healthy'
                      },
                      timestamp: {
                        type: 'string',
                        format: 'date-time'
                      },
                      uptime: {
                        type: 'number',
                        description: 'Uptime в секундах'
                      },
                      services: {
                        type: 'object',
                        properties: {
                          database: {
                            type: 'string',
                            example: 'connected'
                          },
                          api: {
                            type: 'string',
                            example: 'running'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/demo-login': {
        post: {
          tags: ['Authentication'],
          summary: 'Вход в систему',
          description: 'Демо-авторизация для операторов и администраторов',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginRequest'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Успешный вход',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/LoginResponse'
                  }
                }
              }
            },
            '401': {
              description: 'Неверные учётные данные',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/verify': {
        post: {
          tags: ['Authentication'],
          summary: 'Проверка токена',
          description: 'Проверяет валидность JWT токена',
          security: [
            {
              BearerAuth: []
            }
          ],
          responses: {
            '200': {
              description: 'Токен валиден',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'object',
                        properties: {
                          user: {
                            type: 'object',
                            properties: {
                              username: {
                                type: 'string'
                              },
                              role: {
                                type: 'string'
                              },
                              name: {
                                type: 'string'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Недействительный токен',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/appeals': {
        post: {
          tags: ['Appeals'],
          summary: 'Создать обращение',
          description: 'Создаёт новое обращение от гражданина. Автоматически запускается ИИ-анализ.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateAppealRequest'
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Обращение создано',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        $ref: '#/components/schemas/Appeal'
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Ошибка валидации',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        },
        get: {
          tags: ['Appeals'],
          summary: 'Получить список обращений',
          description: 'Возвращает список обращений с возможностью фильтрации',
          parameters: [
            {
              name: 'status',
              in: 'query',
              description: 'Фильтр по статусу',
              schema: {
                type: 'string',
                enum: ['new', 'in_progress', 'completed']
              }
            },
            {
              name: 'priority',
              in: 'query',
              description: 'Фильтр по приоритету',
              schema: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical']
              }
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Количество записей',
              schema: {
                type: 'integer',
                default: 20,
                minimum: 1,
                maximum: 100
              }
            },
            {
              name: 'offset',
              in: 'query',
              description: 'Смещение',
              schema: {
                type: 'integer',
                default: 0,
                minimum: 0
              }
            }
          ],
          responses: {
            '200': {
              description: 'Список обращений',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'object',
                        properties: {
                          appeals: {
                            type: 'array',
                            items: {
                              $ref: '#/components/schemas/Appeal'
                            }
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              total: {
                                type: 'integer'
                              },
                              limit: {
                                type: 'integer'
                              },
                              offset: {
                                type: 'integer'
                              },
                              pages: {
                                type: 'integer'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/appeals/{id}': {
        get: {
          tags: ['Appeals'],
          summary: 'Получить обращение по ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'ID обращения',
              schema: {
                type: 'string',
                format: 'uuid'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Детали обращения',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        $ref: '#/components/schemas/Appeal'
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'Обращение не найдено',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        },
        patch: {
          tags: ['Appeals'],
          summary: 'Обновить обращение',
          description: 'Обновляет статус или другие поля обращения',
          security: [
            {
              BearerAuth: []
            }
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'ID обращения',
              schema: {
                type: 'string',
                format: 'uuid'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['in_progress', 'completed'],
                      description: 'Новый статус'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Обращение обновлено',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        $ref: '#/components/schemas/Appeal'
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Не авторизован',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '404': {
              description: 'Обращение не найдено',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/appeals/{id}/ai-response': {
        get: {
          tags: ['AI'],
          summary: 'Получить ИИ-ответ для обращения',
          description: 'Возвращает предложенный ИИ ответ для оператора',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'ID обращения',
              schema: {
                type: 'string',
                format: 'uuid'
              }
            }
          ],
          responses: {
            '200': {
              description: 'ИИ-ответ',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'object',
                        properties: {
                          suggested_text: {
                            type: 'string',
                            description: 'Предложенный текст ответа'
                          },
                          confidence: {
                            type: 'number',
                            format: 'float',
                            description: 'Уверенность ИИ (0.0 - 1.0)',
                            example: 0.85
                          },
                          sources: {
                            type: 'array',
                            items: {
                              type: 'string'
                            },
                            description: 'Источники из базы знаний'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'ИИ-ответ не найден',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/knowledge-base': {
        get: {
          tags: ['Knowledge Base'],
          summary: 'Получить список статей',
          description: 'Возвращает все статьи базы знаний',
          responses: {
            '200': {
              description: 'Список статей',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/KnowledgeBaseArticle'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Knowledge Base'],
          summary: 'Создать статью',
          description: 'Создаёт новую статью в базе знаний (требуется роль admin)',
          security: [
            {
              BearerAuth: []
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'content'],
                  properties: {
                    title: {
                      type: 'string',
                      example: 'Водоснабжение и водоотведение'
                    },
                    content: {
                      type: 'string',
                      description: 'Содержание (Markdown)',
                      example: '# Водоснабжение\n\nИнформация о водоснабжении...'
                    },
                    category_id: {
                      type: 'string',
                      format: 'uuid'
                    },
                    tags: {
                      type: 'array',
                      items: {
                        type: 'string'
                      },
                      example: ['вода', 'водопровод']
                    },
                    is_active: {
                      type: 'boolean',
                      default: true
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Статья создана',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        $ref: '#/components/schemas/KnowledgeBaseArticle'
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Не авторизован',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operators/categories': {
        get: {
          tags: ['Categories'],
          summary: 'Получить список категорий',
          description: 'Возвращает все доступные категории обращений',
          responses: {
            '200': {
              description: 'Список категорий',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string',
                              format: 'uuid'
                            },
                            name: {
                              type: 'string',
                              example: 'Водоснабжение'
                            },
                            description: {
                              type: 'string'
                            },
                            is_active: {
                              type: 'boolean'
                            },
                            created_at: {
                              type: 'string',
                              format: 'date-time'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Categories'],
          summary: 'Создать категорию',
          description: 'Создаёт новую категорию обращений (требуется роль admin)',
          security: [
            {
              BearerAuth: []
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: {
                      type: 'string',
                      example: 'Электроснабжение'
                    },
                    description: {
                      type: 'string',
                      example: 'Вопросы по электроснабжению'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Категория создана'
            },
            '401': {
              description: 'Не авторизован'
            }
          }
        }
      },
      '/api/appeals/tracking/{trackingNumber}': {
        get: {
          tags: ['Appeals'],
          summary: 'Получить обращение по номеру отслеживания',
          description: 'Позволяет гражданину отследить своё обращение по номеру',
          parameters: [
            {
              name: 'trackingNumber',
              in: 'path',
              required: true,
              description: 'Номер отслеживания обращения',
              schema: {
                type: 'string',
                example: 'APMH3W41J61OMDG9'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Информация об обращении',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        $ref: '#/components/schemas/Appeal'
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'Обращение не найдено'
            }
          }
        }
      }
    }
  },
  apis: []
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
