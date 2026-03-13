import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { generateDocx } from '../services/docxService';
import { generatePdf } from '../services/pdfGenerator';

const router = Router();
const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage');

// GET /api/contracts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, status, template_id, date_from, date_to } = req.query;

    let query = db('contracts as c')
      .join('template_versions as tv', 'c.template_version_id', 'tv.id')
      .join('templates as t', 'tv.template_id', 't.id')
      .join('users as u', 'c.created_by', 'u.id')
      .select('c.*', 't.name as template_name', 'u.name as created_by_name', 'tv.version_number');

    // Non-admin users only see their own contracts
    if (req.user!.role !== 'admin') {
      query = query.where('c.created_by', req.user!.id);
    }
    if (search) query = query.whereILike('c.name', `%${search}%`);
    if (status) query = query.where('c.status', status);
    if (template_id) query = query.where('tv.template_id', template_id);
    if (date_from) query = query.where('c.created_at', '>=', date_from);
    if (date_to) query = query.where('c.created_at', '<=', date_to);

    const contracts = await query.orderBy('c.updated_at', 'desc');
    res.json({ success: true, data: contracts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/contracts/export/csv
router.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    let query = db('contracts as c')
      .join('template_versions as tv', 'c.template_version_id', 'tv.id')
      .join('templates as t', 'tv.template_id', 't.id')
      .join('users as u', 'c.created_by', 'u.id')
      .select('c.name', 'c.status', 'c.created_at', 'c.updated_at', 't.name as template_name', 'u.name as created_by_name');

    if (req.user!.role !== 'admin') {
      query = query.where('c.created_by', req.user!.id);
    }
    const contracts = await query.orderBy('c.created_at', 'desc');

    const headers = ['Name', 'Template', 'Status', 'Created By', 'Created At', 'Updated At'];
    const rows = contracts.map((c: any) => [
      `"${c.name}"`, `"${c.template_name}"`, c.status, `"${c.created_by_name}"`, c.created_at, c.updated_at
    ]);

    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contracts.csv');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/contracts
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { template_version_id, fields, status = 'draft', notes } = req.body;

    if (!template_version_id) {
      res.status(400).json({ success: false, error: 'Bad Request', details: 'template_version_id is required.' });
      return;
    }

    const version = await db('template_versions as tv')
      .join('templates as t', 'tv.template_id', 't.id')
      .where('tv.id', template_version_id)
      .select('tv.*', 't.name as template_name')
      .first();

    if (!version) {
      res.status(404).json({ success: false, error: 'Template version not found.' });
      return;
    }

    // Auto-fill company settings fields
    const settings = await db('company_settings').select('key', 'value');
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value || '';

    const enrichedFields: Record<string, string> = { ...fields };
    const fieldKeyMap: Record<string, string> = {
      '[COMPANY NAME]': settingsMap.company_name || '',
      '[COMPANY ADDRESS]': settingsMap.company_address || '',
      '[COMPANY REGISTRATION]': settingsMap.company_registration || '',
      '[COMPANY EMAIL]': settingsMap.company_email || '',
    };
    for (const [fk, sv] of Object.entries(fieldKeyMap)) {
      if (!enrichedFields[fk] && sv) enrichedFields[fk] = sv;
    }

    // Only validate if status is 'generated'
    if (status === 'generated') {
      const templateFields = await db('template_fields')
        .where({ template_version_id, required: true, optional: false });
      const missing: string[] = [];
      for (const tf of templateFields) {
        if (!enrichedFields[tf.field_key] || enrichedFields[tf.field_key].trim() === '') {
          missing.push(tf.label);
        }
      }
      if (missing.length > 0) {
        res.status(422).json({
          success: false,
          error: 'Validation Error',
          details: `Required fields are missing: ${missing.join(', ')}`,
          missing_fields: missing,
        });
        return;
      }
    }

    // Build contract name
    const clientName = enrichedFields['[CLIENT NAME]'] || enrichedFields['client_name'] || 'Unknown Client';
    const today = new Date().toISOString().split('T')[0];
    const contractName = `${version.template_name} - ${clientName} - ${today}`;

    const contractId = uuidv4();
    await db('contracts').insert({
      id: contractId,
      template_version_id,
      created_by: req.user!.id,
      name: contractName,
      status,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Store field values
    for (const [key, value] of Object.entries(enrichedFields)) {
      await db('contract_fields').insert({
        id: uuidv4(),
        contract_id: contractId,
        field_key: key,
        value: value || null,
      });
    }

    if (status === 'generated') {
      await db('templates')
        .join('template_versions as tv', 'templates.id', 'tv.template_id')
        .where('tv.id', template_version_id)
        .increment('use_count', 1);
    }

    res.status(201).json({ success: true, data: { id: contractId, name: contractName } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/contracts/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const contract = await db('contracts as c')
      .join('template_versions as tv', 'c.template_version_id', 'tv.id')
      .join('templates as t', 'tv.template_id', 't.id')
      .join('users as u', 'c.created_by', 'u.id')
      .where('c.id', req.params.id)
      .select('c.*', 't.name as template_name', 't.id as template_id', 'u.name as created_by_name', 'tv.version_number', 'tv.file_path')
      .first();

    if (!contract) { res.status(404).json({ success: false, error: 'Not Found' }); return; }
    if (req.user!.role !== 'admin' && contract.created_by !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }

    const fields = await db('contract_fields').where({ contract_id: req.params.id });
    const templateFields = await db('template_fields').where({ template_version_id: contract.template_version_id }).orderBy('order_index');
    const files = await db('contract_files').where({ contract_id: req.params.id });

    res.json({ success: true, data: { ...contract, field_values: fields, template_fields: templateFields, files } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// PUT /api/contracts/:id (update draft / status / notes)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const contract = await db('contracts').where({ id: req.params.id }).first();
    if (!contract) { res.status(404).json({ success: false, error: 'Not Found' }); return; }
    if (req.user!.role !== 'admin' && contract.created_by !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }

    const { fields, status, notes } = req.body;

    if (fields) {
      // Upsert fields
      await db('contract_fields').where({ contract_id: req.params.id }).delete();
      for (const [key, value] of Object.entries(fields)) {
        await db('contract_fields').insert({
          id: uuidv4(),
          contract_id: req.params.id,
          field_key: key,
          value: value as string || null,
        });
      }
    }

    const update: any = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    await db('contracts').where({ id: req.params.id }).update(update);

    res.json({ success: true, message: 'Contract updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/contracts/:id/generate/docx
router.post('/:id/generate/docx', requireAuth, async (req: Request, res: Response) => {
  try {
    const contract = await db('contracts as c')
      .join('template_versions as tv', 'c.template_version_id', 'tv.id')
      .where('c.id', req.params.id)
      .select('c.*', 'tv.file_path')
      .first();

    if (!contract) { res.status(404).json({ success: false, error: 'Not Found' }); return; }
    if (req.user!.role !== 'admin' && contract.created_by !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }

    // Validate required fields
    const templateFields = await db('template_fields')
      .where({ template_version_id: contract.template_version_id, required: true });
    const fieldValues = await db('contract_fields').where({ contract_id: req.params.id });
    const valuesMap: Record<string, string> = {};
    for (const fv of fieldValues) valuesMap[fv.field_key] = fv.value || '';

    const missing: string[] = [];
    for (const tf of templateFields) {
      if (!valuesMap[tf.field_key]?.trim()) missing.push(tf.label);
    }
    if (missing.length > 0) {
      res.status(422).json({
        success: false, error: 'Validation Error',
        details: `Required fields are missing: ${missing.join(', ')}`,
        missing_fields: missing,
      });
      return;
    }

    // Generate DOCX
    const outputDir = path.join(storagePath, 'contracts', req.params.id);
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `contract_${Date.now()}.docx`);

    await generateDocx(contract.file_path, valuesMap, outputPath);

    // Save file record
    const fileId = uuidv4();
    await db('contract_files').insert({
      id: fileId,
      contract_id: req.params.id,
      file_type: 'docx',
      file_path: outputPath,
      generated_at: new Date().toISOString(),
    });

    await db('contracts').where({ id: req.params.id }).update({
      status: 'generated',
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, data: { file_id: fileId, download_url: `/api/contracts/${req.params.id}/download/${fileId}` } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/contracts/:id/generate/pdf
router.post('/:id/generate/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const contract = await db('contracts as c')
      .join('template_versions as tv', 'c.template_version_id', 'tv.id')
      .where('c.id', req.params.id)
      .select('c.*', 'tv.file_path')
      .first();

    if (!contract) { res.status(404).json({ success: false, error: 'Not Found' }); return; }
    if (req.user!.role !== 'admin' && contract.created_by !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }

    const templateFields = await db('template_fields')
      .where({ template_version_id: contract.template_version_id, required: true });
    const fieldValues = await db('contract_fields').where({ contract_id: req.params.id });
    const valuesMap: Record<string, string> = {};
    for (const fv of fieldValues) valuesMap[fv.field_key] = fv.value || '';

    const missing: string[] = [];
    for (const tf of templateFields) {
      if (!valuesMap[tf.field_key]?.trim()) missing.push(tf.label);
    }
    if (missing.length > 0) {
      res.status(422).json({ success: false, error: 'Validation Error', missing_fields: missing });
      return;
    }

    const outputDir = path.join(storagePath, 'contracts', req.params.id);
    fs.mkdirSync(outputDir, { recursive: true });
    const docxPath = path.join(outputDir, `contract_${Date.now()}.docx`);

    await generateDocx(contract.file_path, valuesMap, docxPath);

    let pdfPath: string;
    try {
      pdfPath = await generatePdf(docxPath, outputDir);
    } catch (pdfErr: any) {
      console.error('PDF generation failed:', pdfErr);
      // Fall back to offering DOCX
      const fileId = uuidv4();
      await db('contract_files').insert({
        id: fileId, contract_id: req.params.id, file_type: 'docx',
        file_path: docxPath, generated_at: new Date().toISOString(),
      });
      res.status(500).json({
        success: false, error: 'PDF generation failed. DOCX is available instead.',
        fallback_url: `/api/contracts/${req.params.id}/download/${fileId}`,
      });
      return;
    }

    const fileId = uuidv4();
    await db('contract_files').insert({
      id: fileId, contract_id: req.params.id, file_type: 'pdf',
      file_path: pdfPath, generated_at: new Date().toISOString(),
    });

    await db('contracts').where({ id: req.params.id }).update({
      status: 'generated', updated_at: new Date().toISOString(),
    });

    res.json({ success: true, data: { file_id: fileId, download_url: `/api/contracts/${req.params.id}/download/${fileId}` } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// GET /api/contracts/:id/download/:fileId
router.get('/:id/download/:fileId', requireAuth, async (req: Request, res: Response) => {
  try {
    const file = await db('contract_files')
      .where({ id: req.params.fileId, contract_id: req.params.id })
      .first();

    if (!file) { res.status(404).json({ success: false, error: 'File not found.' }); return; }

    const contract = await db('contracts').where({ id: req.params.id }).first();
    if (req.user!.role !== 'admin' && contract.created_by !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }

    if (!fs.existsSync(file.file_path)) {
      res.status(404).json({ success: false, error: 'File no longer exists on disk.' }); return;
    }

    const contentType = file.file_type === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const ext = file.file_type === 'pdf' ? 'pdf' : 'docx';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="contract.${ext}"`);
    fs.createReadStream(file.file_path).pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

// POST /api/contracts/:id/duplicate
router.post('/:id/duplicate', requireAuth, async (req: Request, res: Response) => {
  try {
    const contract = await db('contracts').where({ id: req.params.id }).first();
    if (!contract) { res.status(404).json({ success: false, error: 'Not Found' }); return; }

    const fields = await db('contract_fields').where({ contract_id: req.params.id });
    const newId = uuidv4();
    const today = new Date().toISOString().split('T')[0];

    await db('contracts').insert({
      id: newId,
      template_version_id: contract.template_version_id,
      created_by: req.user!.id,
      name: `${contract.name} (Copy ${today})`,
      status: 'draft',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    for (const f of fields) {
      await db('contract_fields').insert({ id: uuidv4(), contract_id: newId, field_key: f.field_key, value: f.value });
    }

    res.json({ success: true, data: { id: newId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Server Error', details: err.message });
  }
});

export default router;
