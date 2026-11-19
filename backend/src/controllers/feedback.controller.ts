import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { mailer } from '../utils/mailer';

const createFeedbackSchema = z.object({
  rating: z.string().min(1),
  category: z.string().min(1),
  urgency: z.string().min(1),
  message: z.string().min(1),
});

export const feedbackController = {
  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { rating, category, urgency, message } = createFeedbackSchema.parse(req.body);
      const feedback = await prisma.feedback.create({
        data: {
          userId: req.user!.userId,
          rating,
          category,
          urgency,
          message,
        }
      });

      // Email Admin with Premium template
      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #090810; color: #ffffff; padding: 30px; border-radius: 20px; max-width: 500px; margin: 20px auto; border: 1px solid rgba(168, 85, 247, 0.15); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 10px; font-weight: 900; letter-spacing: 3px; color: #a855f7; text-transform: uppercase; background: rgba(168, 85, 247, 0.08); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(168, 85, 247, 0.2);">New Feedback</span>
          </div>
          <h2 style="text-align: center; font-size: 22px; font-weight: 300; margin-bottom: 25px; letter-spacing: -0.5px;">A user shared their thoughts.</h2>
          
          <div style="background: #121020; padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 20px;">
            <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 8px;">
              <p style="font-size: 11px; color: #55536a; font-weight: 700; text-transform: uppercase; margin: 0;">Rating</p>
              <p style="font-size: 15px; font-weight: 600; color: #e879f9; margin: 4px 0 0;">${rating}</p>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 8px;">
              <p style="font-size: 11px; color: #55536a; font-weight: 700; text-transform: uppercase; margin: 0;">Category</p>
              <p style="font-size: 14px; font-weight: 500; color: #ffffff; margin: 4px 0 0;">${category}</p>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 8px;">
              <p style="font-size: 11px; color: #55536a; font-weight: 700; text-transform: uppercase; margin: 0;">Urgency</p>
              <p style="font-size: 13px; font-weight: 600; color: ${urgency === 'High Priority' ? '#f87171' : '#fb923c'}; margin: 4px 0 0;">${urgency}</p>
            </div>
            <div>
              <p style="font-size: 11px; color: #55536a; font-weight: 700; text-transform: uppercase; margin: 0;">Message</p>
              <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin: 6px 0 0; background: #0a0a14; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.02);">${message}</p>
            </div>
          </div>

          <div style="text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.05); pt: 15px;">
            <p style="margin: 0;">Submitted by <b style="color: #ffffff;">${req.user!.email}</b></p>
          </div>
        </div>
      `;

      const file = req.file;

      await mailer.sendEmail({
        to: process.env.SMTP_USER || 'mrsivagoram@gmail.com',
        subject: `[Feedback] - [${rating}] ${category}`,
        html,
        attachments: file ? [{
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype
        }] : []
      });

      res.json({ success: true, data: feedback, message: 'Feedback submitted successfully' });
    } catch (err) { next(err); }
  }
};
