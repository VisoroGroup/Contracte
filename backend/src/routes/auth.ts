import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { generateToken } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Bad Request', details: 'Email and password are required.' });
      return;
    }

    const user = await db('users').where({ email: email.toLowerCase(), active: true }).first();
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized', details: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Unauthorized', details: 'Invalid email or password.' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await db('users').where({ id: req.user!.id }).first();
    if (!user) {
      res.status(404).json({ success: false, error: 'Not Found' });
      return;
    }
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

export default router;
