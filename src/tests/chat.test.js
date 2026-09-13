import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import ChatController from '../controllers/ChatController.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Parent from '../models/Parent.js';

let mongoServer;

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function callController(fn, req) {
  const res = mockRes();
  let caughtError = null;
  const next = (err) => { caughtError = err; };
  await fn(req, res, next);
  if (caughtError) throw caughtError;
  return res;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await User.deleteMany({});
  await Parent.deleteMany({});
});

describe('Chat: conversation lifecycle and authorization boundaries', () => {
  test('parent can create a conversation with a specific teacher, send a message, and the teacher can read it', async () => {
    const teacher = await User.create({ name: 'Mrs. Mehta', passwordHash: 'x', role: 'TEACHER' });
    const parent = await Parent.create({ parentName: 'P1', primaryMobileNumber: '9000000010', passwordHash: 'x' });

    const createRes = await callController(ChatController.createConversation, {
      user: { id: parent._id.toString(), role: 'parent' },
      body: { staffId: teacher._id.toString(), subject: 'Class Teacher' },
    });
    expect(createRes.statusCode).toBe(201);
    const conversationId = createRes.body.data._id.toString();

    // Parent sends a message
    const sendRes = await callController(ChatController.sendMessage, {
      user: { id: parent._id.toString(), role: 'parent' },
      params: { id: conversationId },
      body: { text: 'Hello teacher!' },
    });
    expect(sendRes.statusCode).toBe(201);

    const convoAfterSend = await Conversation.findById(conversationId);
    expect(convoAfterSend.unreadCountStaff).toBe(1);
    expect(convoAfterSend.lastMessagePreview).toBe('Hello teacher!');

    // Teacher lists their conversations and sees it
    const listRes = await callController(ChatController.listConversations, {
      user: { id: teacher._id.toString(), role: 'TEACHER' },
    });
    expect(listRes.body.data).toHaveLength(1);

    // Teacher reads the messages
    const messagesRes = await callController(ChatController.listMessages, {
      user: { id: teacher._id.toString(), role: 'TEACHER' },
      params: { id: conversationId },
      query: {},
    });
    expect(messagesRes.body.data).toHaveLength(1);
    expect(messagesRes.body.data[0].text).toBe('Hello teacher!');

    // Teacher replies
    await callController(ChatController.sendMessage, {
      user: { id: teacher._id.toString(), role: 'TEACHER' },
      params: { id: conversationId },
      body: { text: 'Hi! Thanks for reaching out.' },
    });
    const convoAfterReply = await Conversation.findById(conversationId);
    expect(convoAfterReply.unreadCountParent).toBe(1);
    expect(convoAfterReply.lastSenderRole).toBe('staff');

    // Parent marks read
    await callController(ChatController.markRead, {
      user: { id: parent._id.toString(), role: 'parent' },
      params: { id: conversationId },
    });
    const convoAfterRead = await Conversation.findById(conversationId);
    expect(convoAfterRead.unreadCountParent).toBe(0);
  });

  test('an unrelated teacher cannot read a conversation addressed to a different teacher', async () => {
    const assignedTeacher = await User.create({ name: 'Assigned', passwordHash: 'x', role: 'TEACHER', contactNo1: '9100000001' });
    const otherTeacher = await User.create({ name: 'Other', passwordHash: 'x', role: 'TEACHER', contactNo1: '9100000002' });
    const parent = await Parent.create({ parentName: 'P2', primaryMobileNumber: '9000000011', passwordHash: 'x' });

    const conversation = await Conversation.create({ parentId: parent._id, staffId: assignedTeacher._id });

    await expect(
      callController(ChatController.listMessages, {
        user: { id: otherTeacher._id.toString(), role: 'TEACHER' },
        params: { id: conversation._id.toString() },
        query: {},
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('a parent cannot read another parent\'s conversation', async () => {
    const staff = await User.create({ name: 'Office', passwordHash: 'x', role: 'STAFF' });
    const parentA = await Parent.create({ parentName: 'PA', primaryMobileNumber: '9000000012', passwordHash: 'x' });
    const parentB = await Parent.create({ parentName: 'PB', primaryMobileNumber: '9000000013', passwordHash: 'x' });

    const conversation = await Conversation.create({ parentId: parentA._id, staffId: staff._id });

    await expect(
      callController(ChatController.listMessages, {
        user: { id: parentB._id.toString(), role: 'parent' },
        params: { id: conversation._id.toString() },
        query: {},
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('an unassigned "office" conversation is visible to STAFF but not to an unrelated TEACHER, and ADMIN sees everything', async () => {
    const parent = await Parent.create({ parentName: 'P3', primaryMobileNumber: '9000000014', passwordHash: 'x' });
    const staff = await User.create({ name: 'Front Office', passwordHash: 'x', role: 'STAFF', contactNo1: '9100000003' });
    const teacher = await User.create({ name: 'Some Teacher', passwordHash: 'x', role: 'TEACHER', contactNo1: '9100000004' });
    const admin = await User.create({ name: 'Admin', passwordHash: 'x', role: 'ADMIN', contactNo1: '9100000005' });

    await Conversation.create({ parentId: parent._id, staffId: null, subject: 'School Office' });

    const staffList = await callController(ChatController.listConversations, { user: { id: staff._id.toString(), role: 'STAFF' } });
    expect(staffList.body.data).toHaveLength(1);

    const teacherList = await callController(ChatController.listConversations, { user: { id: teacher._id.toString(), role: 'TEACHER' } });
    expect(teacherList.body.data).toHaveLength(0);

    const adminList = await callController(ChatController.listConversations, { user: { id: admin._id.toString(), role: 'ADMIN' } });
    expect(adminList.body.data).toHaveLength(1);
  });

  test('a staff reply to an unassigned "office" thread claims it for that staff member', async () => {
    const parent = await Parent.create({ parentName: 'P4', primaryMobileNumber: '9000000015', passwordHash: 'x' });
    const staff = await User.create({ name: 'Front Office 2', passwordHash: 'x', role: 'STAFF' });

    const conversation = await Conversation.create({ parentId: parent._id, staffId: null });

    await callController(ChatController.sendMessage, {
      user: { id: staff._id.toString(), role: 'STAFF' },
      params: { id: conversation._id.toString() },
      body: { text: 'I can help with that.' },
    });

    const updated = await Conversation.findById(conversation._id);
    expect(updated.staffId?.toString()).toBe(staff._id.toString());
  });

  test('creating a conversation for the same (parent, staff, student) reuses the existing thread instead of duplicating', async () => {
    const teacher = await User.create({ name: 'Teacher', passwordHash: 'x', role: 'TEACHER' });
    const parent = await Parent.create({ parentName: 'P5', primaryMobileNumber: '9000000016', passwordHash: 'x' });

    const first = await callController(ChatController.createConversation, {
      user: { id: parent._id.toString(), role: 'parent' },
      body: { staffId: teacher._id.toString() },
    });
    const second = await callController(ChatController.createConversation, {
      user: { id: parent._id.toString(), role: 'parent' },
      body: { staffId: teacher._id.toString() },
    });

    expect(first.body.data._id.toString()).toBe(second.body.data._id.toString());
    const count = await Conversation.countDocuments({});
    expect(count).toBe(1);
  });
});
