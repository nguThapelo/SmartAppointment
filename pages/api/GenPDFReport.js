import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';

export const config = {
  api: {
    bodyParser: false, // Disable bodyParser for file uploads
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'File parsing failed' });
    }

    const file = files.file[0]; // Correct file access
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const docxPath = file.filepath;
    const outputDir = path.join(process.cwd(), 'public', 'uploads');
    const pdfPath = path.join(outputDir, `${file.newFilename}.pdf`);

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      const { value: text } = await mammoth.extractRawText({ path: docxPath });
      const pdfDoc = new PDFDocument();
      pdfDoc.pipe(fs.createWriteStream(pdfPath));
      pdfDoc.text(text);
      pdfDoc.end();

      pdfDoc.on('finish', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${file.newFilename}.pdf`);
        const pdfStream = fs.createReadStream(pdfPath);
        pdfStream.pipe(res);
      });
    } catch (error) {
      return res.status(500).json({ error: 'Conversion failed', details: error.message });
    }
  });
}