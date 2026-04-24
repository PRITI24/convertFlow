import * as PDFJS from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Configure PDF.js worker
// Using version 5.6.205 as specified in package.json
const PDF_JS_VERSION = '5.6.205';
const WORKER_URL = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;
PDFJS.GlobalWorkerOptions.workerSrc = WORKER_URL;

export async function convertPdfToWord(file: File): Promise<Blob> {
  console.log('Starting PDF to Word conversion...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded. Pages: ${pdf.numPages}`);
    
    const sections = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract string content
      const textItems = textContent.items
        .map((item: any) => item.str)
        .filter(str => str.trim().length > 0)
        .join(' ');
      
      sections.push({
        children: [
          new Paragraph({
            children: [new TextRun(textItems)],
          }),
        ],
      });
    }

    const doc = new Document({
      sections,
    });

    console.log('Generating Word file...');
    return await Packer.toBlob(doc);
  } catch (error) {
    console.error('PDF to Word Error:', error);
    throw error;
  }
}

export async function convertWordToPdf(file: File): Promise<Blob> {
  console.log('Starting Word to PDF conversion...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    console.log('Word content converted to HTML');

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.padding = '40px';
    container.style.background = 'white';
    container.className = 'word-content-container';
    container.innerHTML = html;
    document.body.appendChild(container);

    console.log('Rendering HTML to Canvas...');
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    
    document.body.removeChild(container);
    console.log('Generating PDF file...');
    return pdf.output('blob');
  } catch (error) {
    console.error('Word to PDF Error:', error);
    throw error;
  }
}
