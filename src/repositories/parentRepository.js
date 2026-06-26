// src/repositories/parentRepository.js
// Thin wrapper around the Parent Mongoose model.
// All write methods accept an optional { session } option for transaction participation.

import Parent from '../models/Parent.js';

const parentRepository = {
  /** Insert a single document */
  async create(data, opts = {}) {
    const [doc] = await Parent.create([data], opts);
    return doc;
  },

  /** Find by primary key */
  async findById(id, projection = null, opts = {}) {
    return Parent.findById(id, projection, opts).lean();
  },

  /** Find one by arbitrary filter */
  async findOne(filter, projection = null, opts = {}) {
    return Parent.findOne(filter, projection, opts).lean();
  },

  /** Find one and select passwordHash (select: false override) */
  async findOneWithPassword(filter) {
    return Parent.findOne(filter).select('+passwordHash').lean();
  },

  /** Find one by id and select refreshTokens (select: false override) */
  async findByIdWithTokens(id) {
    return Parent.findById(id).select('+refreshTokens').lean();
  },

  /** Find multiple documents */
  async find(filter = {}, projection = null, opts = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 }, session } = opts;
    return Parent.find(filter, projection, { limit, skip, sort, session }).lean();
  },

  /** Atomic update – returns Mongoose UpdateResult { modifiedCount, ... } */
  async updateOne(filter, update, opts = {}) {
    return Parent.updateOne(filter, update, opts);
  },

  /** Add a refresh token entry */
  async addRefreshToken(id, tokenHash, expiresAt) {
    return Parent.updateOne(
      { _id: id },
      { $push: { refreshTokens: { tokenHash, expiresAt } } }
    );
  },

  /** Soft or hard delete */
  async deleteOne(filter, opts = {}) {
    return Parent.deleteOne(filter, opts);
  },

  /** Count matching documents */
  async countDocuments(filter = {}) {
    return Parent.countDocuments(filter);
  },

  /** Bulk insert (migration) */
  async insertMany(docs, opts = {}) {
    return Parent.insertMany(docs, opts);
  },
};

export default parentRepository;
