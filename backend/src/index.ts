import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import { ChatService } from './services/ChatService';
import { rabbitMQService } from './services/RabbitMQService';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env['PORT'] || 3001;

// Behind reverse proxy (nginx-proxy) for correct rate limiter and IPs
app.set('trust proxy', 1);

// Initialize WebSocket chat service
let chatService: ChatService;
try {
  chatService = new ChatService(httpServer);
  console.log('💬 WebSocket chat service initialized');
} catch (error) {
  console.error('❌ Failed to initialize WebSocket:', error);
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGINS']?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3005',
    'http://localhost:3006',
    'http://localhost:3007',
    'https://user-smartsupport.vadimevgrafov.ru',
    'https://operator-smartsupport.vadimevgrafov.ru',
    'https://admin-smartsupport.vadimevgrafov.ru'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Swagger UI - API Documentation
// Настраиваем helmet для работы со Swagger UI
app.use('/api-docs', (req, res, next) => {
  // Временно отключаем некоторые security headers для Swagger UI
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://validator.swagger.io");
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SmartSupport API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }
}));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    // Try to check database connection
    const { pool } = require('./config/database');
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        database: 'disconnected',
        api: 'running'
      }
    });
  }
});

// Basic API endpoint
app.get('/api/status', (_req, res) => {
  res.json({
    message: 'Smart Assistant API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development',
    endpoints: {
      health: '/health',
      status: '/api/status',
      auth: '/api/auth/*',
      appeals: '/api/appeals/*',
      ai: '/api/ai/*',
      chat: '/api/chat/*',
      operators: '/api/operators/*',
      admin: '/api/admin/*',
      files: '/api/files/*'
    }
  });
});

// Placeholder routes - будем подключать постепенно
app.get('/api/test', (_req, res) => {
  res.json({
    message: 'Test endpoint works!',
    host: _req.get('host'),
    timestamp: new Date().toISOString()
  });
});

// Auth placeholder
app.get('/api/auth/test', (_req, res) => {
  res.json({ message: 'Auth endpoint placeholder' });
});


// Appeals placeholder (для совместимости)
app.get('/api/appeals/test', (_req, res) => {
  res.json({ message: 'Appeals endpoint placeholder - use GET /api/appeals for real data' });
});

// AI test endpoint - создание тестового обращения и анализ
app.post('/api/test/appeal-with-analysis', async (req, res) => {
  try {
    const { subject, description } = req.body;
    
    if (!subject || !description) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['subject', 'description']
      });
    }

    // Импортируем необходимые модули
    const { pool } = require('./config/database');
    const { v4: uuidv4 } = require('uuid');
    const { GigaChatService } = require('./services/GigaChatService');
    const { AppealAnalysisModel } = require('./models/AppealAnalysis');
    
    // Создаем модель анализа
    const analysisModel = new AppealAnalysisModel(pool);
    const gigaChatService = new GigaChatService(analysisModel);
    
    // Генерируем tracking number
    const trackingNumber = `AP${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
    const appealId = uuidv4();
    
    // Создаем обращение
    const appealQuery = `
      INSERT INTO appeals (id, tracking_number, subject, description, status, priority, submitted_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'new', 'medium', NOW(), NOW(), NOW())
      RETURNING *
    `;
    
    const appealResult = await pool.query(appealQuery, [
      appealId,
      trackingNumber,
      subject,
      description
    ]);
    
    const appeal = appealResult.rows[0];
    
    // Запускаем AI анализ
    console.log('🤖 Starting GigaChat analysis...');
    const analysisResult = await gigaChatService.analyzeAppeal(
      appealId,
      subject,
      description
    );
    
    // Генерируем ответ на основе базы знаний
    console.log('💡 Generating AI response...');
    const responseResult = await gigaChatService.generateResponse(
      appealId,
      `Обращение: ${subject}. ${description}`
    );
    
    res.json({
      success: true,
      appeal: {
        id: appeal.id,
        tracking_number: appeal.tracking_number,
        subject: appeal.subject,
        description: appeal.description,
        status: appeal.status,
        created_at: appeal.created_at
      },
      analysis: analysisResult.success ? analysisResult.analysis : { error: analysisResult.error },
      suggested_response: responseResult.success ? responseResult.response : { error: responseResult.error }
    });
    
  } catch (error) {
    console.error('❌ Error in test endpoint:', error);
    res.status(500).json({
      error: 'Failed to process appeal',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI placeholder
app.get('/api/ai/test', (_req, res) => {
  res.json({ message: 'AI endpoint placeholder - use POST /api/test/appeal-with-analysis for testing' });
});

// Chat placeholder
app.get('/api/chat/test', (_req, res) => {
  res.json({ message: 'Chat endpoint placeholder' });
});

// Operators placeholder
app.get('/api/operators/test', (_req, res) => {
  res.json({ message: 'Operators endpoint placeholder' });
});

// Admin placeholder
app.get('/api/admin/test', (_req, res) => {
  res.json({ message: 'Admin endpoint placeholder' });
});

// Import all routes
import knowledgeBaseRoutes from './routes/knowledgeBase';
import appealsRoutes from './routes/appeals';
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
// import chatRoutes from './routes/chat';  // kept disabled until chat API is aligned
import operatorsRoutes from './routes/operators';
import adminRoutes from './routes/admin';
import filesRoutes from './routes/files';

// Mount routes
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/appeals', appealsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
// app.use('/api/chat', chatRoutes);  // TEMPORARILY DISABLED
app.use('/api/operators', operatorsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes);

console.log('⚠️  CHAT ROUTES TEMPORARILY DISABLED until API alignment');

// Files placeholder
app.get('/api/files/test', (_req, res) => {
  res.json({ message: 'Files endpoint placeholder' });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env['NODE_ENV'] === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server (use httpServer instead of app.listen to support WebSocket)
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API status: http://localhost:${PORT}/api/status`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`💬 WebSocket: ws://localhost:${PORT}`);
  console.log(`\n📚 Available endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - Status: http://localhost:${PORT}/api/status`);
  console.log(`   - API Docs: http://localhost:${PORT}/api-docs 🌟`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth/test`);
  console.log(`   - Appeals: http://localhost:${PORT}/api/appeals/test`);
  console.log(`   - AI: http://localhost:${PORT}/api/ai/test`);
  console.log(`   - Chat: http://localhost:${PORT}/api/chat/test (WebSocket enabled)`);
  console.log(`   - Operators: http://localhost:${PORT}/api/operators/test`);
  console.log(`   - Admin: http://localhost:${PORT}/api/admin/test`);
  console.log(`   - Files: http://localhost:${PORT}/api/files/test`);
  console.log(`\n🌐 Environment: ${process.env['NODE_ENV'] || 'development'}`);
  
  // Initialize RabbitMQ connection
  try {
    await rabbitMQService.connect();
    console.log('✅ RabbitMQ connected for task queueing');
  } catch (error: any) {
    console.error('❌ RabbitMQ connection failed:', error.message);
    console.error('   AI processing will not work until RabbitMQ is available');
  }
});

