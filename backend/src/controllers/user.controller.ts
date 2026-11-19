// src/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { cloudinary } from '../lib/cloudinary';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import bcrypt from 'bcryptjs';

const updateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
});

export const userController = {
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateProfileSchema.parse(req.body);
      
      const updatedUser = await prisma.user.update({
        where: { id: req.user!.userId },
        data,
        select: { id: true, name: true, email: true, role: true, profilePicUrl: true }
      });

      res.json({ success: true, data: { user: updatedUser }, message: 'Profile updated successfully' });
    } catch (err) { next(err); }
  },

  async uploadPicture(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'No image file provided' });
      }

      // Convert buffer to Data URI for Cloudinary
      const base64 = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: 'profile_pictures',
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
      });

      const updatedUser = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { profilePicUrl: uploadResult.secure_url },
        select: { id: true, name: true, email: true, profilePicUrl: true }
      });

      res.json({
        success: true,
        data: { profilePicUrl: uploadResult.secure_url, user: updatedUser },
        message: 'Profile picture uploaded successfully'
      });
    } catch (err) { next(err); }
  },

  async removePicture(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { profilePicUrl: null },
      });

      res.json({ success: true, message: 'Profile picture removed successfully' });
    } catch (err) { next(err); }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) throw new AppError('Incorrect current password', 400, 'BAD_REQUEST');

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      });

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) { next(err); }
  }
};
