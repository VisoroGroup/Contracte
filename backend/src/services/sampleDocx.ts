import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

/**
 * Creates a sample DOCX file with yellow-highlighted placeholder fields.
 * These are created using raw XML so no Word is needed.
 */
export async function createSampleDocx(outputPath: string): Promise<void> {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Minimal DOCX structure
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

  const relsMain = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
</w:styles>`;

  // Helper: yellow-highlighted run
  function yellowRun(text: string): string {
    return `<w:r>
      <w:rPr>
        <w:highlight w:val="yellow"/>
        <w:b/>
      </w:rPr>
      <w:t xml:space="preserve">${text}</w:t>
    </w:r>`;
  }

  // Helper: normal run
  function normalRun(text: string, bold = false): string {
    return `<w:r>
      ${bold ? '<w:rPr><w:b/></w:rPr>' : ''}
      <w:t xml:space="preserve">${text}</w:t>
    </w:r>`;
  }

  // Helper: paragraph
  function para(content: string, align = ''): string {
    const pPr = align ? `<w:pPr><w:jc w:val="${align}"/></w:pPr>` : '';
    return `<w:p>${pPr}${content}</w:p>`;
  }

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${para(normalRun('SERVICE AGREEMENT', true), 'center')}
    ${para('')}
    ${para(normalRun('This Service Agreement ("Agreement") is entered into as of ', false) + normalRun(' ') + yellowRun('[CONTRACT START DATE]') + normalRun(' between:'))}
    ${para('')}
    ${para(normalRun('Client: ', true) + yellowRun('[CLIENT NAME]'))}
    ${para(normalRun('Client Email: ', true) + yellowRun('[CLIENT EMAIL]'))}
    ${para(normalRun('Client Address: ', true) + yellowRun('[CLIENT ADDRESS]'))}
    ${para('')}
    ${para(normalRun('and the Service Provider (Company Name: ACME Corp SRL, hereinafter "Provider").'))}
    ${para('')}
    ${para(normalRun('1. SERVICES', true))}
    ${para(normalRun('The Provider agrees to perform the following services:'))}
    ${para('')}
    ${para(yellowRun('[SERVICE DESCRIPTION]'))}
    ${para('')}
    ${para(normalRun('2. TERM', true))}
    ${para(normalRun('This Agreement shall commence on ') + yellowRun('[CONTRACT START DATE]') + normalRun(' and shall continue until ') + yellowRun('[CONTRACT END DATE]') + normalRun(' unless terminated earlier.'))}
    ${para('')}
    ${para(normalRun('3. COMPENSATION', true))}
    ${para(normalRun('The Client agrees to compensate the Provider in the total amount of ') + yellowRun('[TOTAL AMOUNT]') + normalRun(' EUR.'))}
    ${para(normalRun('Payment Terms: ') + yellowRun('[PAYMENT TERMS]'))}
    ${para('')}
    ${para(normalRun('4. GOVERNING LAW', true))}
    ${para(normalRun('This Agreement shall be governed by and construed in accordance with the laws of Romania.'))}
    ${para('')}
    ${para(normalRun('5. SIGNATURES', true))}
    ${para('')}
    ${para(normalRun('CLIENT:                                    PROVIDER:'))}
    ${para('')}
    ${para(normalRun('_______________________                    _______________________'))}
    ${para(normalRun('Signature                                  Signature'))}
    ${para('')}
    ${para(normalRun('_______________________                    _______________________'))}
    ${para(normalRun('Date                                       Date'))}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(relsMain, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(document, 'utf-8'));
  zip.addFile('word/styles.xml', Buffer.from(styles, 'utf-8'));
  zip.addFile('word/settings.xml', Buffer.from(settings, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.writeZip(outputPath);
}
