// src/controllers/WhatsappController.js
import WhatsappService from '../services/WhatsappService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import mongoose from 'mongoose';

class WhatsappController {
  send = catchAsync(async (req, res) => {
    const { templateName, body, targetType, targetFilter, parentIds } = req.body;

    if (!body || !targetType) {
      throw new AppError('Body and targetType are required', 400);
    }

    if (targetType === 'PARENT' && (!parentIds || !parentIds.length || !mongoose.Types.ObjectId.isValid(parentIds[0]))) {
      throw new AppError('Valid Parent ID is required when targeting a specific parent', 400);
    }

    const payload = {
      templateName: templateName || 'custom_message',
      body,
      targetType,
      targetFilter,
      parentIds,
    };

    const msg = await WhatsappService.sendWhatsapp(req.user.id, payload);

    res.status(201).json({
      status: 'success',
      message: 'WhatsApp message queued for delivery',
      data: msg,
    });
  });

  list = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { messages, total } = await WhatsappService.listMessages(page, limit);

    res.status(200).json({
      status: 'success',
      data: messages,
      meta: {
        page,
        limit,
        total,
      },
    });
  });
}

export default new WhatsappController();
