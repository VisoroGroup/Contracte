import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/users
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await db('users').select('id', 'email', 'name', 'role', 'active', 'created_at').orderBy('created_at', 'desc');
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/users
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'user' } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: 'email, password, name are required.' }); return;
    }
    const existing = await db('users').where({ email: email.toLowerCase() }).first();
    if (existing) { res.status(409).json({ success: false, error: 'Email already in use.' }); return; }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);
    await db('users').insert({ id, email: email.toLowerCase(), password_hash, name, role, active: true });
    res.status(201).json({ success: true, data: { id, email: email.toLowerCase(), name, role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, role, active, password } = req.body;
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (role !== undefined) update.role = role;
    if (active !== undefined) update.active = active;
    if (password) update.password_hash = await bcrypt.hash(password, 10);

    await db('users').where({ id: req.params.id }).update(update);
    res.json({ success: true, message: 'User updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// DELETE /api/users/:id (deactivate)
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db('users').where({ id: req.params.id }).update({ active: false });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

export default router;
