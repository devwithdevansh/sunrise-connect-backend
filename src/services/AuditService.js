// src/services/AuditService.js
import auditRepository from '../repositories/auditRepository.js';
import AppError from '../utils/AppError.js';

/**
 * AuditService – all write operations participate in the caller's transaction.
 * Pagination uses skip/limit with default 20, max 100.
 */
class AuditService {
  /**
   * Log an audit entry.
   * @param {Object} param0
   * @param {string|ObjectId} param0.performedBy   - ID of the actor performing the action
   * @param {string} param0.action                 - Action name (e.g., 'PARENT_CREATED')
   * @param {Object} [param0.details={}]           - Arbitrary details, must not contain sensitive data
   * @param {mongoose.ClientSession} [session]     - Optional session to participate in
   */
  static async log({ performedBy, targetParentId, targetStudentId, targetLedgerId, action, details = {} }, session = null) {
    const entry = {
      performedBy,
      targetParentId,
      targetStudentId,
      targetLedgerId,
      action,
      details,
    };
    try {
      await auditRepository.create(entry, session);
    } catch (err) {
      throw new AppError('Failed to write audit log', 500);
    }
    return entry;
  }

  /**
   * Search audit logs with pagination.
   */
  static async search(filter = {}, options = {}) {
    const limit = Math.min(options.limit || 20, 100);
    const skip = options.skip || 0;
    return auditRepository.find(filter, { skip, limit, sort: { createdAt: -1 } });
  }

  /**
   * Find a single audit log by its ID.
   */
  static async findById(id) {
    const doc = await auditRepository.findById(id);
    if (!doc) throw new AppError('Audit log not found', 404);
    return doc;
  }
}

export default AuditService;
