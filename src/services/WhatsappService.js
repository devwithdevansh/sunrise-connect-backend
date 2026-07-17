// src/services/WhatsappService.js
import WhatsappMessage from '../models/WhatsappMessage.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import StudentFeeLedger from '../models/StudentFeeLedger.js';
import logger from '../config/logger.js';
import env from '../config/env.js';
import auditRepository from '../repositories/auditRepository.js';
import AppError from '../utils/AppError.js';

class WhatsappService {
  /**
   * Queue and send a WhatsApp message to parents based on target criteria.
   */
  async sendWhatsapp(senderId, payload) {
    const { templateName, body, targetType, targetFilter, parentIds, language } = payload;

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
    } else if (targetType === 'PARENT' || targetType === 'STUDENT') {
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
        let lastError = null;

        const parentDocs = await Parent.find({ _id: { $in: targetParentIds } }).select('primaryMobileNumber');

        for (const parent of parentDocs) {
          if (!parent.primaryMobileNumber) continue;

          let phone = parent.primaryMobileNumber;
          // Ensure it has country code, assuming India +91 if length is 10
          if (phone.length === 10) {
            phone = '91' + phone;
          }

          let payloadsToSend = [];

          if (templateName === 'custom_message') {
            // Send a free-form text message
            // Note: This requires the recipient to have messaged the business within the last 24 hours.
            payloadsToSend.push({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: phone,
              type: 'text',
              text: {
                preview_url: false,
                body: body || 'Empty message'
              }
            });
          } else if (templateName.startsWith('fee_reminder')) {
            // 1. Fetch active students for this parent. If targetType is STUDENT, only fetch that one.
            let studentQuery = { parentId: parent._id, isActive: true };
            if (targetType === 'STUDENT' && targetFilter && targetFilter.student) {
              studentQuery._id = targetFilter.student;
            }
            if (targetType === 'CLASS' && targetFilter && targetFilter.standard) {
              studentQuery.standard = targetFilter.standard;
              if (targetFilter.medium) {
                studentQuery.medium = targetFilter.medium;
              }
            }
            const students = await Student.find(studentQuery);

            for (const st of students) {
              const ledgers = await StudentFeeLedger.find({
                studentId: st._id,
                status: { $in: ['PENDING', 'PARTIAL'] },
                feeType: { $in: ['EDUCATION', 'TERM', 'TRANSPORT'] }
              });

              let eduTotal = 0;
              let transportTotal = 0;
              const eduPeriods = new Set();
              const transportPeriods = new Set();
              
              const currentMonthValue = new Date().getMonth();
              const currentAcademicMonthIndex = currentMonthValue >= 5 ? currentMonthValue - 5 : currentMonthValue + 7;
              const periodOrder = {
                'term 1': 0, 'june': 0, 'july': 1, 'august': 2, 'september': 3,
                'term 2': 4, 'october': 4, 'november': 5, 'december': 6,
                'january': 7, 'february': 8, 'march': 9, 'april': 10, 'may': 11
              };

              for (const l of ledgers) {
                let isDue = true;
                if (l.feePeriod) {
                  const pName = l.feePeriod.toLowerCase().trim();
                  if (periodOrder[pName] !== undefined && periodOrder[pName] > currentAcademicMonthIndex) {
                    isDue = false;
                  }
                }

                if (isDue) {
                  if (l.feeType === 'TRANSPORT') {
                    transportTotal += (l.remainingAmount || 0);
                    if (l.feePeriod) transportPeriods.add(l.feePeriod);
                  } else {
                    eduTotal += (l.remainingAmount || 0);
                    if (l.feePeriod) eduPeriods.add(l.feePeriod);
                  }
                }
              }

              const feeDue = eduTotal + transportTotal;
              if (feeDue <= 0) {
                logger.info(`Skipping ${templateName} for student ${st._id} (parent ${parent._id}) as feeDue is ${feeDue}`);
                continue;
              }

              const formatPeriods = (periodSet) => {
                if (periodSet.size === 0) return '-';
                const periodsArr = Array.from(periodSet);
                const terms = periodsArr.filter(p => p.toLowerCase().includes('term'));
                const others = periodsArr.filter(p => !p.toLowerCase().includes('term') && p !== 'One-time');
                const monthsOrder = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
                others.sort((a, b) => monthsOrder.indexOf(a) - monthsOrder.indexOf(b));
                let parts = [];
                if (terms.length > 0) parts.push(terms.join(', '));
                if (others.length > 0) {
                  parts.push(others.length === 1 ? others[0] : `${others[0]} to ${others[others.length - 1]}`);
                }
                return parts.join(' + ');
              };

              let finalTemplateName = templateName;
              let templateParameters = [];

              if (templateName === 'fee_reminder') {
                const hasTransport = transportTotal > 0;
                const hasEdu = eduTotal > 0;

                if (hasTransport) {
                  // Use the new transport template (4 variables)
                  finalTemplateName = language === 'gu' ? 'fees_gujarati_transport' : 'fees_english_transport';
                  
                  const eduStr = hasEdu ? `${formatPeriods(eduPeriods)} (₹${eduTotal})` : 'None (₹0)';
                  const transportStr = `${formatPeriods(transportPeriods)} (₹${transportTotal})`;
                  
                  templateParameters = [
                    { type: 'text', text: st.studentName },
                    { type: 'text', text: eduStr },
                    { type: 'text', text: transportStr },
                    { type: 'text', text: feeDue.toString() }
                  ];
                } else {
                  // Use the original template (3 variables)
                  finalTemplateName = language === 'gu' ? 'fees_gujarati' : 'fees_english';
                  
                  const eduStr = `${formatPeriods(eduPeriods)} (₹${eduTotal})`;
                  
                  templateParameters = [
                    { type: 'text', text: st.studentName },
                    { type: 'text', text: eduStr },
                    { type: 'text', text: feeDue.toString() }
                  ];
                }
              }

              // Meta requires the EXACT language code that the template was created with.
              let languageCode = 'en'; // fallback
              if (finalTemplateName === 'fees_english') {
                languageCode = 'en_US'; 
              } else if (finalTemplateName === 'fees_english_transport' || finalTemplateName === 'fees_gujarati' || finalTemplateName === 'fees_gujarati_transport') {
                languageCode = 'en'; // because it was created as English in Meta
              } else if (language === 'gu') {
                languageCode = 'gu';
              }

              payloadsToSend.push({
                messaging_product: 'whatsapp',
                to: phone,
                type: 'template',
                template: {
                  name: finalTemplateName,
                  language: { code: languageCode },
                  components: [
                    {
                      type: 'body',
                      parameters: templateParameters
                    }
                  ]
                }
              });
            }
          } else {
            // Generic template message
            const languageCode = language === 'gu' ? 'gu' : 'en_US'; // Keep en_US default for other generic templates if not specified
            let payload = {
              messaging_product: 'whatsapp',
              to: phone,
              type: 'template',
              template: {
                name: templateName,
                language: { code: languageCode }
              }
            };

            if (body) {
              payload.template.components = [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: body }
                  ]
                }
              ];
            }
            
            payloadsToSend.push(payload);
          }
          for (const payload of payloadsToSend) {
            try {
              const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
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
                lastError = JSON.stringify(errJson);
                logger.error(`WhatsApp send failed to ${phone}: ${lastError}`);
                failureCount++;
              } else {
                successCount++;
              }
            } catch (fetchErr) {
              lastError = fetchErr.toString();
              logger.error(`WhatsApp network error to ${phone}: ${fetchErr}`);
              failureCount++;
            }
          }
        }

        await WhatsappMessage.findByIdAndUpdate(msgRecord._id, {
          successCount,
          failureCount,
          deliveryStatus: failureCount > 0 ? (successCount > 0 ? 'PARTIAL_FAIL' : 'FAILED') : 'SENT',
          body: lastError ? `${body}\n\nMeta Error: ${lastError}` : body
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

  /**
   * Process incoming webhook events from Meta (messages, statuses)
   */
  async deleteMessage(adminId, messageId) {
    const message = await WhatsappMessage.findById(messageId);
    if (!message) {
      throw new AppError('Message not found', 404);
    }
    await WhatsappMessage.findByIdAndDelete(messageId);

    await auditRepository.create({
      action: 'WHATSAPP_MESSAGE_DELETED',
      performedBy: adminId,
      details: {
        templateName: message.templateName,
        body: message.body,
        targetType: message.targetType,
        deliveryStatus: message.deliveryStatus
      }
    });

    return true;
  }

  async processWebhookEvent(payload) {
    if (payload.statuses) {
      // It's a delivery status update
      for (const status of payload.statuses) {
        logger.info(`[WhatsApp Webhook] Status update: Message ID ${status.id} is now ${status.status}`);

        if (status.status === 'failed') {
          const errorCode = status.errors ? status.errors[0].code : 'Unknown';
          const errorMsg = status.errors ? status.errors[0].title : 'Unknown';
          logger.error(`[WhatsApp Webhook] Message ${status.id} failed to deliver. Error ${errorCode}: ${errorMsg}`);
          // TODO: In the future, we could query the database by tracking wamid (status.id)
          // and updating individual recipient delivery status.
        }
      }
    }

    if (payload.messages) {
      // It's an incoming message from a parent
      for (const msg of payload.messages) {
        const fromNumber = msg.from; // Sender's phone number

        if (msg.type === 'text') {
          const textBody = msg.text.body;
          logger.info(`[WhatsApp Webhook] Incoming text from ${fromNumber}: ${textBody}`);
        } else {
          logger.info(`[WhatsApp Webhook] Incoming message of type ${msg.type} from ${fromNumber}`);
        }

        // TODO: In the future, we could save this message to a database table to show a live chat UI.
      }
    }
  }
}

export default new WhatsappService();
