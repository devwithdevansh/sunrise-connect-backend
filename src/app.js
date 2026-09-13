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
import expenseRoutes          from './routes/expense.routes.js';
import attendanceRoutes       from './routes/attendance.routes.js';
import academicMasterRoutes   from './routes/academic-master.routes.js';

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

// ─── Disable Caching for all API routes ───────────────────────────────────────
// Prevents Hostinger LiteSpeed (and any proxy/CDN) from caching dynamic API
// responses which would cause stale badge counts and outdated fee data in UI.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP', message: 'Sunrise Connect Backend is running' });
});

// ─── Android App Links ────────────────────────────────────────────────────────
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.status(200).json([
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.devwithdevansh.sunrise_connect",
        "sha256_cert_fingerprints": [
          "92:06:CA:FD:02:5A:D8:2D:8B:7E:3B:91:5A:A6:9C:44:F4:11:B4:D0:7B:06:12:0A:2C:1E:8C:DF:7E:6A:56:08",
          "6F:26:10:AD:E8:EA:B1:99:35:D6:4C:E3:73:34:2D:4F:69:EC:7C:C6:94:33:0D:9E:4E:21:97:8D:28:2A:30:53",
          "BF:E0:E8:56:D3:94:4B:F5:A6:05:0C:EF:EC:F2:85:99:95:43:C5:46:DC:E9:1F:AE:07:D1:EE:F1:9D:E2:E4:9F"
        ]
      }
    }
  ]);
});

import erpRoutes              from './routes/erp.routes.js';
import allocationRoutes       from './routes/allocation.routes.js';
import homeworkRoutes         from './routes/homework.routes.js';
import leaveRoutes            from './routes/leave.routes.js';
import examRoutes             from './routes/exam.routes.js';
import timetableRoutes        from './routes/timetable.routes.js';
import chatRoutes             from './routes/chat.routes.js';

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
app.use(`${V1}/expenses`,       expenseRoutes);
app.use(`${V1}/erp/allocations`, allocationRoutes); // Mount before erpRoutes
app.use(`${V1}/erp/homework`,   homeworkRoutes);
app.use(`${V1}/erp/leave`,      leaveRoutes);
app.use(`${V1}/erp/exams`,      examRoutes);
app.use(`${V1}/erp/timetable`,  timetableRoutes);
app.use(`${V1}/erp`,            erpRoutes);
app.use(`${V1}/attendance`,     attendanceRoutes);
app.use(`${V1}/academic-master`,academicMasterRoutes);
app.use(`${V1}/chat`,           chatRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.all('/{*splat}', (req, _res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
