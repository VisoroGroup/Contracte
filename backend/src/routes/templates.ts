import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { parseDocxFields } from '../services/docxService';

const router = Router();

const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = path.join(storagePath, 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      cb(null, tmpDir);
    },
    filename: (req, file, cb) => cb(null, `${uuidv4()}.docx`),
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed.'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// GET /api/templates
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, category, sort = 'newest', archived = '0' } = req.query;

    let query = db('templates as t')
      .leftJoin('template_categories as c', 't.category_id', 'c.id')
      .leftJoin('template_versions as tv', 't.current_version_id', 'tv.id')
      .where('t.archived', archived === '1' ? true : false)
      .select(
        't.id', 't.name', 't.archived', 't.use_count', 't.created_at', 't.updated_at',
        'c.name as category_name', 'c.id as category_id',
        'tv.id as version_id', 'tv.version_number', 'tv.uploaded_at'
      );

    if (search) {
      query = query.whereILike('t.name', `%${search}%`);
    }
    if (category) {
      query = query.where('t.category_id', category);
    }

    if (sort === 'newest') query = query.orderBy('t.created_at', 'desc');
    else if (sort === 'oldest') query = query.orderBy('t.created_at', 'asc');
    else if (sort === 'most_used') query = query.orderBy('t.use_count', 'desc');
    else if (sort === 'alphabetical') query = query.orderBy('t.name', 'asc');

    const templates = await query;

    // Get field counts
    for (const tpl of templates) {
      if (tpl.version_id) {
        const fieldCount = await db('template_fields').where({ template_version_id: tpl.version_id }).count('id as count').first();
        tpl.field_count = (fieldCount as any)?.count || 0;
      } else {
        tpl.field_count = 0;
      }
    }

    res.json({ success: true, data: templates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/templates/upload
router.post('/upload', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Bad Request', details: 'No file uploaded.' });
    return;
  }
  try {
    // Parse yellow fields
    let fields: any[] = [];
    try {
      fields = await parseDocxFields(req.file.path);
    } catch (parseErr: any) {
      fs.unlinkSync(req.file.path);
      res.status(422).json({
        success: false,
        error: 'Parse Error',
        details: 'Could not parse the DOCX file. It may be corrupted. Please re-upload.',
      });
      return;
    }

    const { name, category_id } = req.body;
    const templateId = uuidv4();
    const versionId = uuidv4();

    // Move file to permanent location
    const templateDir = path.join(storagePath, 'templates', templateId, '1');
    fs.mkdirSync(templateDir, { recursive: true });
    const permanentPath = path.join(templateDir, 'template.docx');
    fs.renameSync(req.file.path, permanentPath);

    await db('templates').insert({
      id: templateId,
      name: name || req.file.originalname.replace('.docx', ''),
      category_id: category_id || null,
      current_version_id: null,
      archived: false,
      use_count: 0,
    });

    await db('template_versions').insert({
      id: versionId,
      template_id: templateId,
      version_number: 1,
      file_path: permanentPath,
      original_filename: req.file.originalname,
    });

    await db('templates').where({ id: templateId }).update({ current_version_id: versionId });

    // Insert detected fields
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      await db('template_fields').insert({
        id: uuidv4(),
        template_version_id: versionId,
        field_key: f.fieldKey,
        label: f.label,
        field_type: f.fieldType,
        required: true,
        optional: false,
        default_value: null,
        group_name: 'General',
        order_index: i,
      });
    }

    const template = await db('templates').where({ id: templateId }).first();
    res.status(201).json({
      success: true,
      data: {
        template,
        version_id: versionId,
        detected_fields: fields,
        warning: fields.length === 0 ? 'No yellow-highlighted fields were found. Make sure fields are highlighted with yellow in Word.' : undefined,
      },
    });
  } catch (err: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/templates/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const template = await db('templates as t')
      .leftJoin('template_categories as c', 't.category_id', 'c.id')
      .leftJoin('template_versions as tv', 't.current_version_id', 'tv.id')
      .where('t.id', req.params.id)
      .select('t.*', 'c.name as category_name', 'tv.id as version_id', 'tv.version_number', 'tv.file_path', 'tv.uploaded_at')
      .first();

    if (!template) {
      res.status(404).json({ success: false, error: 'Not Found' });
      return;
    }

    const fields = await db('template_fields')
      .where({ template_version_id: template.version_id })
      .orderBy('order_index');

    res.json({ success: true, data: { ...template, fields } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// PUT /api/templates/:id
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, category_id, archived } = req.body;
    await db('templates').where({ id: req.params.id }).update({
      name,
      category_id: category_id || null,
      archived: archived !== undefined ? archived : false,
      updated_at: new Date().toISOString(),
    });
    const updated = await db('templates').where({ id: req.params.id }).first();
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// PUT /api/templates/:id/fields — update field config
router.put('/:id/fields', requireAdmin, async (req: Request, res: Response) => {
  try {
    const template = await db('templates').where({ id: req.params.id }).first();
    if (!template) { res.status(404).json({ success: false, error: 'Not Found' }); return; }

    const { fields } = req.body; // Array of field configs
    for (const f of fields) {
      await db('template_fields').where({ id: f.id }).update({
        label: f.label,
        field_type: f.field_type,
        required: f.required,
        optional: f.optional,
        default_value: f.default_value || null,
        description: f.description || null,
        group_name: f.group_name || 'General',
        order_index: f.order_index,
        max_length: f.max_length || null,
      });
    }
    await db('templates').where({ id: req.params.id }).update({ updated_at: new Date().toISOString() });

    const updatedFields = await db('template_fields')
      .where({ template_version_id: template.current_version_id })
      .orderBy('order_index');

    res.json({ success: true, data: updatedFields });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/templates/:id/version — upload a new version
router.post('/:id/version', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded.' }); return; }
  try {
    const template = await db('templates').where({ id: req.params.id }).first();
    if (!template) { res.status(404).json({ success: false, error: 'Not Found' }); return; }

    const lastVersion = await db('template_versions')
      .where({ template_id: req.params.id })
      .orderBy('version_number', 'desc')
      .first();
    const newVersionNum = (lastVersion?.version_number || 0) + 1;

    const versionId = uuidv4();
    const templateDir = path.join(storagePath, 'templates', req.params.id, String(newVersionNum));
    fs.mkdirSync(templateDir, { recursive: true });
    const permanentPath = path.join(templateDir, 'template.docx');
    fs.renameSync(req.file.path, permanentPath);

    await db('template_versions').insert({
      id: versionId,
      template_id: req.params.id,
      version_number: newVersionNum,
      file_path: permanentPath,
      original_filename: req.file.originalname,
    });

    const fields = await parseDocxFields(permanentPath);
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      await db('template_fields').insert({
        id: uuidv4(),
        template_version_id: versionId,
        field_key: f.fieldKey,
        label: f.label,
        field_type: f.fieldType,
        required: true,
        optional: false,
        group_name: 'General',
        order_index: i,
      });
    }

    await db('templates').where({ id: req.params.id }).update({
      current_version_id: versionId,
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, data: { version_id: versionId, version_number: newVersionNum, detected_fields: fields } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/templates/:id/versions
router.get('/:id/versions', requireAuth, async (req: Request, res: Response) => {
  try {
    const versions = await db('template_versions')
      .where({ template_id: req.params.id })
      .orderBy('version_number', 'desc');
    res.json({ success: true, data: versions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// DELETE /api/templates/:id (archive)
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db('templates').where({ id: req.params.id }).update({ archived: true, updated_at: new Date().toISOString() });
    res.json({ success: true, message: 'Template archived.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/templates/:id/duplicate
router.post('/:id/duplicate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const original = await db('templates as t')
      .leftJoin('template_versions as tv', 't.current_version_id', 'tv.id')
      .where('t.id', req.params.id)
      .select('t.*', 'tv.file_path', 'tv.original_filename')
      .first();

    if (!original) { res.status(404).json({ success: false, error: 'Not Found' }); return; }

    const newTemplateId = uuidv4();
    const newVersionId = uuidv4();

    // Copy file
    const templateDir = path.join(storagePath, 'templates', newTemplateId, '1');
    fs.mkdirSync(templateDir, { recursive: true });
    const newFilePath = path.join(templateDir, 'template.docx');
    fs.copyFileSync(original.file_path, newFilePath);

    await db('templates').insert({
      id: newTemplateId,
      name: `${original.name} (Copy)`,
      category_id: original.category_id,
      current_version_id: null,
      archived: false,
      use_count: 0,
    });

    await db('template_versions').insert({
      id: newVersionId,
      template_id: newTemplateId,
      version_number: 1,
      file_path: newFilePath,
      original_filename: original.original_filename,
    });

    await db('templates').where({ id: newTemplateId }).update({ current_version_id: newVersionId });

    // Copy fields
    const originalFields = await db('template_fields').where({ template_version_id: original.current_version_id });
    for (const f of originalFields) {
      await db('template_fields').insert({ ...f, id: uuidv4(), template_version_id: newVersionId });
    }

    res.json({ success: true, data: { id: newTemplateId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

export default router;
