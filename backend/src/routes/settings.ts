import { Router, Request, Response } from 'express';
import db from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage');

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(storagePath, 'logos');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `logo_${uuidv4()}${path.extname(file.originalname)}`),
  }),
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpg|jpeg|gif|svg\+xml|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// GET /api/settings
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db('company_settings').select('key', 'value');
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value || '';
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// PUT /api/settings
router.put('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      const exists = await db('company_settings').where({ key }).first();
      if (exists) {
        await db('company_settings').where({ key }).update({ value, updated_at: new Date().toISOString() });
      } else {
        await db('company_settings').insert({ key, value, updated_at: new Date().toISOString() });
      }
    }
    res.json({ success: true, message: 'Settings updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/settings/logo
router.post('/logo', requireAdmin, logoUpload.single('logo'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded.' }); return; }
  try {
    const logoPath = `/api/settings/logo/${req.file.filename}`;
    await db('company_settings').where({ key: 'logo_path' })
      .update({ value: logoPath, updated_at: new Date().toISOString() });
    res.json({ success: true, data: { logo_path: logoPath } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/settings/logo/:filename
router.get('/logo/:filename', async (req: Request, res: Response) => {
  const filePath = path.join(storagePath, 'logos', req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, error: 'Not Found' }); return; }
  res.sendFile(filePath);
});

export default router;
