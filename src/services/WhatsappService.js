// src/services/WhatsappService.js
import WhatsappMessage from '../models/WhatsappMessage.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import logger from '../config/logger.js';
import env from '../config/env.js';

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

    // 3. Dispatch to WhatsApp provider
    setImmediate(async () => {
      try {
        let successCount = 0;
        let failureCount = 0;

        const parentDocs = await Parent.find({ _id: { $in: targetParentIds } }).select('primaryMobileNumber');
        
        for (const parent of parentDocs) {
          if (!parent.primaryMobileNumber) continue;
          
          let phone = parent.primaryMobileNumber;
          // Ensure it has country code, assuming India +91 if length is 10
          if (phone.length === 10) {
            phone = '91' + phone;
          }

          let payload;

          if (templateName === 'custom_message') {
            // Send a free-form text message
            // Note: This requires the recipient to have messaged the business within the last 24 hours.
            payload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: phone,
              type: 'text',
              text: { 
                preview_url: false,
                body: body || 'Empty message'
              }
            };
          } else {
            // Send a template message
            payload = {
              messaging_product: 'whatsapp',
              to: phone,
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'en_US' }
              }
            };

            if (body && templateName !== 'jaspers_market_plain_text_v1' && templateName !== 'hello_world') {
              payload.template.components = [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: body }
                  ]
                }
              ];
            }
          }

          try {
            const url = `https://graph.facebook.com/v25.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.WHATSAPP_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              const errJson = await response.json();
              logger.error(`WhatsApp send failed to ${phone}: ${JSON.stringify(errJson)}`);
              failureCount++;
            } else {
              successCount++;
            }
          } catch (fetchErr) {
            logger.error(`WhatsApp network error to ${phone}: ${fetchErr}`);
            failureCount++;
          }
        }

        await WhatsappMessage.findByIdAndUpdate(msgRecord._id, {
          successCount,
          failureCount,
          deliveryStatus: failureCount > 0 ? (successCount > 0 ? 'PARTIAL_FAIL' : 'FAILED') : 'SENT',
        });
        logger.info(`WhatsApp message ${msgRecord._id} processed. Success: ${successCount}, Fail: ${failureCount}`);
      } catch (e) {
        logger.error(`Error processing WhatsApp send: ${e}`);
        await WhatsappMessage.findByIdAndUpdate(msgRecord._id, { deliveryStatus: 'FAILED' });
      }
    });

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
