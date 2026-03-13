import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/categories
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const categories = await db('template_categories').orderBy('name');
    res.json({ success: true, data: categories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/categories
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) { res.status(400).json({ success: false, error: 'Name is required.' }); return; }
    const existing = await db('template_categories').where({ name }).first();
    if (existing) { res.status(409).json({ success: false, error: 'Category already exists.' }); return; }
    const id = uuidv4();
    await db('template_categories').insert({ id, name });
    res.status(201).json({ success: true, data: { id, name } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    await db('template_categories').where({ id: req.params.id }).update({ name });
    res.json({ success: true, message: 'Category updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db('template_categories').where({ id: req.params.id }).delete();
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

export default router;
