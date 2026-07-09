// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import logger from './config/logger.js';
import AppError from './utils/AppError.js';
import { globalErrorHandler } from './middlewares/error.middleware.js';

// Route imports
import authRoutes      from './routes/auth.routes.js';
import parentRoutes    from './routes/parent.routes.js';
import studentRoutes   from './routes/student.routes.js';
import ledgerRoutes    from './routes/ledger.routes.js';
import paymentRoutes   from './routes/payment.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import migrationRoutes from './routes/migration.routes.js';
import auditRoutes     from './routes/audit.routes.js';
import feeStructureRoutes from './routes/fee-structure.routes.js';
import feeCategoryRoutes from './routes/fee-category.routes.js';
import academicYearRoutes from './routes/academic-year.routes.js';
import userRoutes             from './routes/user.routes.js';
import reportRoutes           from './routes/report.routes.js';
import notificationRoutes     from './routes/notification.routes.js';
import whatsappRoutes         from './routes/whatsapp.routes.js';

const app = express();

app.set('trust proxy', true);

// ─── Global Middleware ────────────────────────────────────────────────────────
// Security headers (XSS, clickjacking, content-type sniffing, etc.)
app.use(helmet());

app.use(cors({
  origin: true,
  credentials: true,
}));

// Limit body size to prevent memory-exhaustion attacks
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP', message: 'Sunrise Connect Backend is running' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const V1 = '/api/v1';
app.use(`${V1}/auth`,       authRoutes);
app.use(`${V1}/parents`,    parentRoutes);
app.use(`${V1}/students`,   studentRoutes);
app.use(`${V1}/ledgers`,    ledgerRoutes);
app.use(`${V1}/payments`,   paymentRoutes);
app.use(`${V1}/dashboard`,  dashboardRoutes);
app.use(`${V1}/migration`,  migrationRoutes);
app.use(`${V1}/audit`,      auditRoutes);
app.use(`${V1}/fee-structures`, feeStructureRoutes);
app.use(`${V1}/fee-categories`, feeCategoryRoutes);
app.use(`${V1}/academic-years`, academicYearRoutes);
app.use(`${V1}/users`,          userRoutes);
app.use(`${V1}/reports`,        reportRoutes);
app.use(`${V1}/notifications`,  notificationRoutes);
app.use(`${V1}/whatsapp`,       whatsappRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.all('/{*splat}', (req, _res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
