// src/repositories/ledgerRepository.js
// Thin wrapper around the StudentFeeLedger Mongoose model.

import StudentFeeLedger from '../models/StudentFeeLedger.js';

const ledgerRepository = {
  async create(data, opts = {}) {
    const [doc] = await StudentFeeLedger.create([data], opts);
    return doc;
  },

  async findById(id, projection = null, opts = {}) {
    return StudentFeeLedger.findById(id, projection, opts).lean();
  },

  async findOne(filter, projection = null, opts = {}) {
    return StudentFeeLedger.findOne(filter, projection, opts).lean();
  },

  async find(filter = {}, projection = null, opts = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 }, session } = opts;
    return StudentFeeLedger.find(filter, projection, { limit, skip, sort, session }).lean();
  },

  async findDistinct(field, filter = {}) {
    return StudentFeeLedger.distinct(field, filter);
  },

  async updateOne(filter, update, opts = {}) {
    return StudentFeeLedger.updateOne(filter, update, opts);
  },

  async aggregate(pipeline, opts = {}) {
    return StudentFeeLedger.aggregate(pipeline, opts);
  },

  async countDocuments(filter = {}) {
    return StudentFeeLedger.countDocuments(filter);
  },

  async insertMany(docs, opts = {}) {
    return StudentFeeLedger.insertMany(docs, opts);
  },
};

export default ledgerRepository;
