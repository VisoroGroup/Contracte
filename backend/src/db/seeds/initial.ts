import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

// Inline DOCX creator to avoid tsx cross-file import issues
async function createSampleDocx(outputPath: string): Promise<void> {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const relsMain = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

  function yr(t: string) { return `<w:r><w:rPr><w:highlight w:val="yellow"/><w:b/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`; }
  function nr(t: string) { return `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`; }
  function p(c: string) { return `<w:p>${c}</w:p>`; }

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${p(`<w:pPr><w:jc w:val="center"/></w:pPr>${nr('SERVICE AGREEMENT')}`)}
    ${p('')}
    ${p(nr('This Agreement is entered into as of ') + yr('[CONTRACT START DATE]') + nr(' between:'))}
    ${p(nr('Client Name: ') + yr('[CLIENT NAME]'))}
    ${p(nr('Client Email: ') + yr('[CLIENT EMAIL]'))}
    ${p(nr('Client Address: ') + yr('[CLIENT ADDRESS]'))}
    ${p('')}
    ${p(nr('1. SERVICES'))}
    ${p(yr('[SERVICE DESCRIPTION]'))}
    ${p('')}
    ${p(nr('2. TERM: Start ') + yr('[CONTRACT START DATE]') + nr(' End ') + yr('[CONTRACT END DATE]'))}
    ${p('')}
    ${p(nr('3. AMOUNT: ') + yr('[TOTAL AMOUNT]') + nr(' EUR | Payment Terms: ') + yr('[PAYMENT TERMS]'))}
    ${p('')}
    ${p(nr('4. This Agreement is governed by Romanian Law.'))}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(relsMain, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(document, 'utf-8'));
  zip.addFile('word/styles.xml', Buffer.from(styles, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.writeZip(outputPath);
}


export async function seed(knex: Knex): Promise<void> {
  // Clean up in order
  await knex('contract_files').delete();
  await knex('contract_fields').delete();
  await knex('contracts').delete();
  await knex('template_fields').delete();
  await knex('template_versions').delete();
  await knex.raw('UPDATE templates SET current_version_id = NULL');
  await knex('templates').delete();
  await knex('template_categories').delete();
  await knex('users').delete();
  await knex('company_settings').delete();

  // Users
  const adminId = uuidv4();
  const alisaId = uuidv4();

  await knex('users').insert([
    {
      id: adminId,
      email: 'admin@company.com',
      password_hash: await bcrypt.hash('Admin1234!', 10),
      name: 'Administrator',
      role: 'admin',
      active: true,
    },
    {
      id: alisaId,
      email: 'alisa@company.com',
      password_hash: await bcrypt.hash('User1234!', 10),
      name: 'Alisa',
      role: 'user',
      active: true,
    },
  ]);

  // Company settings
  await knex('company_settings').insert([
    { key: 'company_name', value: 'Acme Corp SRL', updated_at: new Date().toISOString() },
    { key: 'company_address', value: 'Str. Exemplu nr. 1, București', updated_at: new Date().toISOString() },
    { key: 'company_registration', value: 'J40/1234/2020', updated_at: new Date().toISOString() },
    { key: 'company_email', value: 'office@acmecorp.ro', updated_at: new Date().toISOString() },
    { key: 'company_phone', value: '+40 721 000 000', updated_at: new Date().toISOString() },
    { key: 'logo_path', value: '', updated_at: new Date().toISOString() },
    { key: 'default_payment_terms', value: '30 days', updated_at: new Date().toISOString() },
    { key: 'default_governing_law', value: 'Romanian Law', updated_at: new Date().toISOString() },
    { key: 'sent_reminder_days', value: '7', updated_at: new Date().toISOString() },
  ]);

  // Template category
  const categoryId = uuidv4();
  await knex('template_categories').insert([
    { id: categoryId, name: 'Service Agreement' },
    { id: uuidv4(), name: 'Web Design' },
    { id: uuidv4(), name: 'Consulting' },
    { id: uuidv4(), name: 'Maintenance' },
  ]);

  // Sample template
  const templateId = uuidv4();
  const versionId = uuidv4();

  // Create storage directories
  const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage');
  const templateDir = path.join(storagePath, 'templates', templateId, '1');
  fs.mkdirSync(templateDir, { recursive: true });

  // Generate sample DOCX
  const docxPath = path.join(templateDir, 'template.docx');
  await createSampleDocx(docxPath);

  await knex('templates').insert({
    id: templateId,
    name: 'Service Agreement Template',
    category_id: categoryId,
    current_version_id: null,
    archived: false,
    use_count: 0,
  });

  await knex('template_versions').insert({
    id: versionId,
    template_id: templateId,
    version_number: 1,
    file_path: docxPath,
    original_filename: 'service_agreement_template.docx',
  });

  await knex('templates').where({ id: templateId }).update({ current_version_id: versionId });

  // Template fields
  const fields = [
    { key: '[CLIENT NAME]', label: 'Client Name', type: 'text', required: true, group: 'Client Information', order: 0 },
    { key: '[CLIENT EMAIL]', label: 'Client Email', type: 'email', required: true, group: 'Client Information', order: 1 },
    { key: '[CLIENT ADDRESS]', label: 'Client Address', type: 'textarea', required: false, group: 'Client Information', order: 2 },
    { key: '[SERVICE DESCRIPTION]', label: 'Service Description', type: 'textarea', required: true, group: 'Contract Terms', order: 3 },
    { key: '[CONTRACT START DATE]', label: 'Contract Start Date', type: 'date', required: true, group: 'Contract Terms', order: 4 },
    { key: '[CONTRACT END DATE]', label: 'Contract End Date', type: 'date', required: false, group: 'Contract Terms', order: 5 },
    { key: '[TOTAL AMOUNT]', label: 'Total Amount', type: 'number', required: true, group: 'Payment', order: 6 },
    { key: '[PAYMENT TERMS]', label: 'Payment Terms', type: 'text', required: false, group: 'Payment', order: 7, default_value: '30 days' },
  ];

  for (const f of fields) {
    await knex('template_fields').insert({
      id: uuidv4(),
      template_version_id: versionId,
      field_key: f.key,
      label: f.label,
      field_type: f.type,
      required: f.required,
      optional: !f.required,
      default_value: (f as any).default_value || null,
      group_name: f.group,
      order_index: f.order,
    });
  }

  // Example draft contract
  const contractId = uuidv4();
  await knex('contracts').insert({
    id: contractId,
    template_version_id: versionId,
    created_by: alisaId,
    name: 'Service Agreement - Draft Client - 2024-01-01',
    status: 'draft',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await knex('contract_fields').insert([
    { id: uuidv4(), contract_id: contractId, field_key: '[CLIENT NAME]', value: 'Draft Client SRL' },
    { id: uuidv4(), contract_id: contractId, field_key: '[CLIENT EMAIL]', value: 'client@example.com' },
  ]);

  console.log('✅ Database seeded successfully!');
  console.log('   Admin: admin@company.com / Admin1234!');
  console.log('   User:  alisa@company.com / User1234!');
}
