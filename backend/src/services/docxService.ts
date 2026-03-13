import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { parseStringPromise, Builder } from 'xml2js';

/**
 * Detects field type from field label/key using keywords (English + Hungarian)
 */
export function detectFieldType(text: string): 'text' | 'email' | 'phone' | 'date' | 'number' | 'textarea' {
  const lower = text.toLowerCase();
  if (/date|datum|határidő|dátum/.test(lower)) return 'date';
  if (/amount|összeg|price|ár|díj|fee|total|cost/.test(lower)) return 'number';
  if (/email/.test(lower)) return 'email';
  if (/phone|telefon|tel\./.test(lower)) return 'phone';
  if (/address|cím|addresses/.test(lower)) return 'textarea';
  if (/description|leírás|scope|tárgy|details|notes/.test(lower)) return 'textarea';
  return 'text';
}

/**
 * Convert field text like "[CLIENT NAME]" to a readable label like "Client Name"
 */
export function fieldTextToLabel(text: string): string {
  return text
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert field text to a safe key like "client_name"
 */
export function fieldTextToKey(text: string): string {
  return text
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export interface ParsedField {
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'email' | 'phone' | 'date' | 'number' | 'textarea';
  originalText: string;
}

/**
 * Parse a DOCX file and extract all yellow-highlighted text segments as field definitions.
 * Yellow = Word highlight wdYellow or shd fill #FFFF00 / #ffff00 / yellow
 */
export async function parseDocxFields(filePath: string): Promise<ParsedField[]> {
  const zip = new AdmZip(filePath);
  const documentXml = zip.readAsText('word/document.xml');

  const parsed = await parseStringPromise(documentXml, { explicitArray: true });
  const fields: ParsedField[] = [];
  const seenKeys = new Set<string>();

  function walkNode(node: any): void {
    if (!node || typeof node !== 'object') return;

    // Check if this is a run (w:r) with highlight
    if (node['w:r']) {
      for (const run of node['w:r']) {
        if (isYellowRun(run)) {
          const text = extractRunText(run);
          if (text && text.trim()) {
            const key = fieldTextToKey(text.trim());
            if (!seenKeys.has(key) && key) {
              seenKeys.add(key);
              fields.push({
                fieldKey: text.trim(),
                label: fieldTextToLabel(text.trim()),
                fieldType: detectFieldType(text.trim()),
                originalText: text.trim(),
              });
            }
          }
        }
      }
    }

    // Recurse
    for (const key of Object.keys(node)) {
      if (key !== '$' && Array.isArray(node[key])) {
        for (const child of node[key]) {
          if (typeof child === 'object') walkNode(child);
        }
      }
    }
  }

  walkNode(parsed);
  return fields;
}

function isYellowRun(run: any): boolean {
  const rPr = run['w:rPr']?.[0];
  if (!rPr) return false;

  // Check highlight element: <w:highlight w:val="yellow"/>
  const highlight = rPr['w:highlight']?.[0];
  if (highlight) {
    const val = highlight['$']?.['w:val'];
    if (val === 'yellow') return true;
  }

  // Check shading: <w:shd w:fill="FFFF00"/>
  const shd = rPr['w:shd']?.[0];
  if (shd) {
    const fill = shd['$']?.['w:fill'];
    if (fill && fill.toLowerCase() === 'ffff00') return true;
  }

  return false;
}

function extractRunText(run: any): string {
  const texts = run['w:t'];
  if (!texts) return '';
  return texts.map((t: any) => (typeof t === 'string' ? t : t._ || t['_'] || '')).join('');
}

/**
 * Replace yellow-highlighted placeholders in a DOCX with user values.
 * Returns the path to the new DOCX file.
 */
export async function generateDocx(
  templatePath: string,
  fieldValues: Record<string, string>,
  outputPath: string
): Promise<void> {
  const zip = new AdmZip(templatePath);
  const documentXml = zip.readAsText('word/document.xml');

  const parsed = await parseStringPromise(documentXml, { explicitArray: true });

  function processNode(node: any): void {
    if (!node || typeof node !== 'object') return;

    if (node['w:r']) {
      for (const run of node['w:r']) {
        if (isYellowRun(run)) {
          const text = extractRunText(run);
          if (text && text.trim()) {
            const originalKey = text.trim();
            const value = fieldValues[originalKey];
            if (value !== undefined) {
              // Replace text
              if (run['w:t']) {
                run['w:t'] = [{ _: value, $: { 'xml:space': 'preserve' } }];
              }
              // Remove yellow highlight from rPr
              const rPr = run['w:rPr']?.[0];
              if (rPr) {
                delete rPr['w:highlight'];
                if (rPr['w:shd']) {
                  const shd = rPr['w:shd'][0];
                  if (shd['$']) {
                    delete shd['$']['w:fill'];
                    delete shd['$']['w:color'];
                  }
                  rPr['w:shd'] = [shd];
                }
              }
            }
          }
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key !== '$' && Array.isArray(node[key])) {
        for (const child of node[key]) {
          if (typeof child === 'object') processNode(child);
        }
      }
    }
  }

  processNode(parsed);

  const builder = new Builder();
  const newXml = builder.buildObject(parsed);

  zip.updateFile('word/document.xml', Buffer.from(newXml, 'utf-8'));

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  zip.writeZip(outputPath);
}
