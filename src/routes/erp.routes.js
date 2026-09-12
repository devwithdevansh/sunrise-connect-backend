import express from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import { requireSuperAdmin } from '../middlewares/superAdmin.middleware.js';

const router = express.Router();

// -------------------------------------------------------------
// ERP ROUTES (SUPER ADMIN ONLY for now)
// -------------------------------------------------------------
router.use(authenticate);
router.use(authorize('ADMIN')); // Must be at least ADMIN
router.use(requireSuperAdmin);   // Must specifically be devansh@gmail.com

// Attendance Stubs
router.get('/attendance', (req, res) => res.json({ status: 'success', data: { message: 'Attendance route scaffolded' } }));
router.post('/attendance', (req, res) => res.json({ status: 'success', data: { message: 'Attendance posted' } }));

// Leave Stubs
router.get('/leave', (req, res) => res.json({ status: 'success', data: { message: 'Leave route scaffolded' } }));
router.post('/leave', (req, res) => res.json({ status: 'success', data: { message: 'Leave posted' } }));

// Timetable Stubs
router.get('/timetable', (req, res) => res.json({ status: 'success', data: { message: 'Timetable route scaffolded' } }));
router.post('/timetable', (req, res) => res.json({ status: 'success', data: { message: 'Timetable posted' } }));

// Results Stubs
router.get('/results', (req, res) => res.json({ status: 'success', data: { message: 'Results route scaffolded' } }));
router.post('/results', (req, res) => res.json({ status: 'success', data: { message: 'Results posted' } }));

// New Admission Stubs
router.post('/admission', (req, res) => res.json({ status: 'success', data: { message: 'Admission created' } }));

export default router;
