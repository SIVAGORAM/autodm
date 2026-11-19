// src/routes/index.ts
import { Application, Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { authLimiter, apiLimiter, webhookLimiter } from '../middlewares/rateLimiter';
import { authController } from '../controllers/auth.controller';
import { campaignController } from '../controllers/campaign.controller';
import { instagramController } from '../controllers/instagram.controller';
import { paymentController } from '../controllers/payment.controller';
import { notificationController } from '../controllers/notification.controller';
import { dashboardController } from '../controllers/dashboard.controller';
import { userController } from '../controllers/user.controller';
import { verifyWebhook, handleWebhook } from '../webhooks/instagram.webhook';
import { notFoundHandler } from '../middlewares/errorHandler';
import { feedbackController } from '../controllers/feedback.controller';
import { supportController } from '../controllers/support.controller';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export function setupRoutes(app: Application): void {
  // ─── Health check ──────────────────────────────────────────────
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

  // ─── Auth routes ───────────────────────────────────────────────
  const authRouter = Router();
  authRouter.post('/signup', authLimiter, authController.signup);
  authRouter.post('/login', authLimiter, authController.login);
  authRouter.post('/refresh', authController.refresh);
  authRouter.post('/logout', authenticate, authController.logout);
  authRouter.get('/me', authenticate, authController.me);
  authRouter.post('/verify-otp', authenticate, authController.verifyOtp);
  authRouter.post('/forgot-password', authController.forgotPassword);
  authRouter.post('/reset-password', authController.resetPassword);
  app.use('/api/auth', authRouter);

  // ─── Instagram routes ──────────────────────────────────────────
  const igRouter = Router();
  igRouter.use(authenticate, apiLimiter);
  igRouter.get('/auth-url', instagramController.getAuthUrl);
  igRouter.get('/callback', instagramController.handleCallback);
  igRouter.get('/account', instagramController.getAccount);
  igRouter.delete('/account', instagramController.disconnect);
  igRouter.get('/media', instagramController.getMedia);
  igRouter.post('/posts', instagramController.addPostToCampaign);
  app.use('/api/instagram', igRouter);

  // ─── User Profile Routes ─────────────────────────────────────────
  const userRouter = Router();
  userRouter.use(authenticate, apiLimiter);
  userRouter.put('/profile', userController.updateProfile);
  userRouter.post('/profile/picture', upload.single('image'), userController.uploadPicture);
  userRouter.delete('/profile/picture', userController.removePicture);
  userRouter.put('/profile/password', userController.changePassword);
  app.use('/api/users', userRouter);

  // ─── Campaign routes ───────────────────────────────────────────
  const campaignRouter = Router();
  campaignRouter.use(authenticate, apiLimiter);
  campaignRouter.post('/', campaignController.create);
  campaignRouter.get('/', campaignController.list);
  campaignRouter.get('/:id', campaignController.get);
  campaignRouter.patch('/:id', campaignController.update);
  campaignRouter.delete('/:id', campaignController.delete);
  campaignRouter.get('/:id/analytics', campaignController.getAnalytics);
  app.use('/api/campaigns', campaignRouter);
  
  // ─── Dashboard Stats routes ───────────────────────────────────
  const dashboardRouter = Router();
  dashboardRouter.use(authenticate, apiLimiter);
  dashboardRouter.get('/stats', dashboardController.getStats);
  app.use('/api/dashboard', dashboardRouter);

  // ─── Notification routes ──────────────────────────────────────
  const notifRouter = Router();
  notifRouter.use(authenticate, apiLimiter);
  notifRouter.get('/', notificationController.list);
  notifRouter.post('/read-all', notificationController.markAllRead);
  notifRouter.patch('/:id/read', notificationController.markRead);
  app.use('/api/notifications', notifRouter);

  // ─── Payment / subscription routes ────────────────────────────
  const paymentRouter = Router();
  paymentRouter.get('/plans', paymentController.getPlans);
  paymentRouter.use(authenticate, apiLimiter);
  paymentRouter.post('/subscribe', paymentController.createSubscription);
  paymentRouter.get('/subscription', paymentController.getMySubscription);
  paymentRouter.post('/cancel', paymentController.cancelSubscription);
  app.use('/api/payments', paymentRouter);

  // ─── Webhooks (raw body, no auth) ─────────────────────────────
  const webhookRouter = Router();
  webhookRouter.get('/instagram', webhookLimiter, verifyWebhook);
  webhookRouter.post('/instagram', webhookLimiter, handleWebhook);
  webhookRouter.post('/razorpay', webhookLimiter, paymentController.handleWebhook);
  app.use('/webhooks', webhookRouter);

  // ─── Admin routes ──────────────────────────────────────────────
  const adminRouter = Router();
  adminRouter.use(authenticate, authorize('ADMIN'));

  adminRouter.get('/users', async (req, res, next) => {
    try {
      const { page = '1', limit = '20' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const { prisma } = await import('../lib/prisma');
      const [users, total] = await Promise.all([
        prisma.user.findMany({ skip, take: parseInt(limit as string), orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, createdAt: true, subscription: { select: { status: true, plan: { select: { name: true } } } } } }),
        prisma.user.count(),
      ]);
      res.json({ success: true, data: { users, total, page: parseInt(page as string) } });
    } catch (err) { next(err); }
  });

  adminRouter.get('/stats', async (req, res, next) => {
    try {
      const { prisma } = await import('../lib/prisma');
      const { dmQueue } = await import('../queues');
      const [users, campaigns, dmsSent, queueStats] = await Promise.all([
        prisma.user.count(),
        prisma.campaign.count({ where: { status: 'ACTIVE' } }),
        prisma.dmLog.count({ where: { status: 'SENT' } }),
        dmQueue.getJobCounts('waiting', 'active', 'failed', 'completed'),
      ]);
      res.json({ success: true, data: { users, activeCampaigns: campaigns, totalDmsSent: dmsSent, queue: queueStats } });
    } catch (err) { next(err); }
  });

  app.use('/api/admin', adminRouter);

  // ─── Feedback & Support Routes ────────────────────────────────────
  const feedbackRouter = Router();
  feedbackRouter.use(authenticate, apiLimiter);
  feedbackRouter.post('/', upload.single('attachment'), feedbackController.submitFeedback);
  app.use('/api/feedback', feedbackRouter);

  const supportRouter = Router();
  supportRouter.use(authenticate, apiLimiter);
  supportRouter.post('/', upload.single('attachment'), supportController.submitTicket);
  app.use('/api/support', supportRouter);

  // ─── 404 ───────────────────────────────────────────────────────
  app.use(notFoundHandler);
}
