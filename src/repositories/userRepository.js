// src/repositories/userRepository.js
// Thin wrapper around the User Mongoose model (admin/staff only).

import User from '../models/User.js';

const userRepository = {
  async create(data, opts = {}) {
    const [doc] = await User.create([data], opts);
    return doc;
  },

  async findById(id, projection = null, opts = {}) {
    return User.findById(id, projection, opts).lean();
  },

  /** Find by email including passwordHash (select: false override) */
  async findByEmailWithPassword(email) {
    return User.findOne({ email }).select('+passwordHash').lean();
  },

  /** Find by id including refreshTokens */
  async findByIdWithTokens(id) {
    return User.findById(id).select('+refreshTokens').lean();
  },

  async findOne(filter, projection = null, opts = {}) {
    return User.findOne(filter, projection, opts).lean();
  },

  async find(filter = {}, projection = null, opts = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 }, session } = opts;
    return User.find(filter, projection, { limit, skip, sort, session }).lean();
  },

  async updateOne(filter, update, opts = {}) {
    return User.updateOne(filter, update, opts);
  },

  /** Push a refresh token hash to the user's refreshTokens array */
  async addRefreshToken(id, tokenHash, expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
    return User.updateOne(
      { _id: id },
      { $push: { refreshTokens: { tokenHash, expiresAt } } }
    );
  },

  async deleteOne(filter, opts = {}) {
    return User.deleteOne(filter, opts);
  },

  async countDocuments(filter = {}) {
    return User.countDocuments(filter);
  },
};

export default userRepository;
