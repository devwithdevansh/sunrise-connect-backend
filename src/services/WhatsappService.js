// src/services/WhatsappService.js
import WhatsappMessage from '../models/WhatsappMessage.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import logger from '../config/logger.js';

class WhatsappService {
  /**
   * Queue and send a WhatsApp message to parents based on target criteria.
   */
  async sendWhatsapp(senderId, payload) {
    const { templateName, body, targetType, targetFilter, parentIds } = payload;

    let targetParentIds = [];

    // 1. Resolve audience
    if (targetType === 'ALL') {
      const allParents = await Parent.find({ primaryMobileNumber: { $exists: true, $ne: '' } }).select('_id');
      targetParentIds = allParents.map((p) => p._id);
    } else if (targetType === 'CLASS') {
      const students = await Student.find({
        standard: targetFilter.standard,
        medium: targetFilter.medium,
        isActive: true
      }).select('parentId');
      
      const pIds = students.map(s => s.parentId).filter(Boolean);
      
      // Filter out parents without a mobile number
      const parents = await Parent.find({
        _id: { $in: pIds },
        primaryMobileNumber: { $exists: true, $ne: '' }
      }).select('_id');
      
      targetParentIds = parents.map((p) => p._id);
    } else if (targetType === 'PARENT') {
      targetParentIds = parentIds || [];
    }

    if (targetParentIds.length === 0) {
      // Save a failed record
      const noNumMsg = await WhatsappMessage.create({
        sentBy: senderId,
        templateName,
        body,
        targetType,
        targetFilter,
        targetParentIds: [],
        deliveryStatus: 'NO_NUMBERS',
      });
      return noNumMsg;
    }

    // 2. Create the WhatsApp message record as PENDING
    const msgRecord = await WhatsappMessage.create({
      sentBy: senderId,
      templateName,
      body,
      targetType,
      targetFilter,
      targetParentIds,
      deliveryStatus: 'PENDING',
    });

    // 3. (Mock) Dispatch to WhatsApp provider
    // In a real implementation, you would loop through targetParentIds, fetch their phone numbers,
    // and call Twilio / Meta API. We simulate a successful delivery here.
    
    setTimeout(async () => {
      try {
        // Simulate some failures randomly or just say all succeed
        const successCount = targetParentIds.length;
        const failureCount = 0;

        await WhatsappMessage.findByIdAndUpdate(msgRecord._id, {
          successCount,
          failureCount,
          deliveryStatus: failureCount > 0 ? (successCount > 0 ? 'PARTIAL_FAIL' : 'FAILED') : 'SENT',
        });
        logger.info(`WhatsApp message ${msgRecord._id} sent. Success: ${successCount}`);
      } catch (e) {
        logger.error(`Error simulating WhatsApp send: ${e}`);
      }
    }, 2000);

    return msgRecord;
  }

  /**
   * List all sent WhatsApp messages (Admin only)
   */
  async listMessages(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      WhatsappMessage.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sentBy', 'name role')
        .lean(),
      WhatsappMessage.countDocuments(),
    ]);

    return { messages, total };
  }
}

export default new WhatsappService();
