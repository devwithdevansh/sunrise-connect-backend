// src/repositories/auditRepository.js
// Thin wrapper around the AuditLog Mongoose model.
// AuditService.log() passes session as second argument directly.

import AuditLog from '../models/AuditLog.js';

const auditRepository = {
  /** Create an audit entry. session can be a Mongoose ClientSession or null. */
  async create(data, session = null) {
    const opts = session ? { session } : {};
    const [doc] = await AuditLog.create([data], opts);
    return doc;
  },

  async findById(id) {
    return AuditLog.findById(id).lean();
  },

  async find(filter = {}, opts = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = opts;
    return AuditLog.find(filter, null, { limit, skip, sort })
      .populate({ path: 'performedBy', select: 'name role email', model: 'User' })
      .lean();
  },
};

export default auditRepository;
