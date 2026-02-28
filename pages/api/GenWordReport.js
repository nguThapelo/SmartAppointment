import path from 'path';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import libre from 'libreoffice-convert'; 
import { promisify } from 'util';

const libreConvert = promisify(libre.convert);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userData, Type } = req.body;

  try {
    const templatePath = path.resolve(process.cwd(), 'public/Templates', 'Temp11.docx');
    const content = fs.readFileSync(templatePath, 'binary');

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render({
      Name: userData.user,
      Age: userData.age,
      Transactions: userData.transactions,
      TotalAmount: userData.totalAmount
    });

    // Generate the DOCX file
    let fileBuffer = doc.getZip().generate({ type: 'nodebuffer' });
      // Send DOCX
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${userData.user}_report.docx"`);
      res.send(fileBuffer);

  } catch (error) {
    console.error("Error generating the document:", error);
    res.status(500).json({ error: error.message });
  }
}