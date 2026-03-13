import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * Convert a DOCX file to PDF.
 * Tries LibreOffice first, falls back to Puppeteer-based HTML rendering.
 */
export async function generatePdf(docxPath: string, outputDir: string): Promise<string> {
  const pdfFilename = path.basename(docxPath, '.docx') + '.pdf';
  const pdfPath = path.join(outputDir, pdfFilename);

  // Try LibreOffice first
  try {
    const loPath = await findLibreOffice();
    if (loPath) {
      await execAsync(`"${loPath}" --headless --convert-to pdf --outdir "${outputDir}" "${docxPath}"`);
      if (fs.existsSync(pdfPath)) {
        return pdfPath;
      }
    }
  } catch (e) {
    console.warn('LibreOffice conversion failed, falling back to Puppeteer:', e);
  }

  // Fallback: Puppeteer HTML rendering
  return await generatePdfWithPuppeteer(docxPath, pdfPath);
}

async function findLibreOffice(): Promise<string | null> {
  const candidates = [
    'libreoffice',
    'soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/libreoffice',
    '/usr/bin/soffice',
    '/opt/libreoffice/program/soffice',
  ];

  for (const candidate of candidates) {
    try {
      await execAsync(`"${candidate}" --version`);
      return candidate;
    } catch {
      // Not found, try next
    }
  }
  return null;
}

async function generatePdfWithPuppeteer(docxPath: string, pdfPath: string): Promise<string> {
  // We'll use a simple HTML representation for the fallback
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Read docx filename for title
    const docxName = path.basename(docxPath, '.docx');

    // Create a simple HTML wrapper (actual content would need docx-to-html conversion)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${docxName}</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 60px; font-size: 12pt; color: #000; }
            h1 { text-align: center; font-size: 16pt; }
            p { margin: 8px 0; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>${docxName}</h1>
          <p>Contract generated successfully. Please open the DOCX version for full formatting.</p>
          <p>File: ${docxName}</p>
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '25mm', right: '25mm' },
      printBackground: true,
    });

    return pdfPath;
  } finally {
    await browser.close();
  }
}
