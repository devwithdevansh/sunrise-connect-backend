// src/repositories/studentRepository.js
// Thin wrapper around the Student Mongoose model.

import Student from '../models/Student.js';

const studentRepository = {
  async create(data, opts = {}) {
    const [doc] = await Student.create([data], opts);
    return doc;
  },

  async findById(id, projection = null, opts = {}) {
    return Student.findById(id, projection, opts).populate('parentId').lean();
  },

  async findOne(filter, projection = null, opts = {}) {
    return Student.findOne(filter, projection, opts).populate('parentId').lean();
  },

  async find(filter = {}, projection = null, opts = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 }, session } = opts;
    return Student.find(filter, projection, { limit, skip, sort, session }).populate('parentId').lean();
  },

  async findDistinct(field, filter = {}) {
    return Student.distinct(field, filter);
  },

  async updateOne(filter, update, opts = {}) {
    return Student.updateOne(filter, update, opts);
  },

  async deleteOne(filter, opts = {}) {
    return Student.deleteOne(filter, opts);
  },

  async countDocuments(filter = {}) {
    return Student.countDocuments(filter);
  },

  async insertMany(docs, opts = {}) {
    return Student.insertMany(docs, opts);
  },
};

export default studentRepository;
