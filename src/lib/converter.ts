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
      
      // Sort items by Y descending (top to bottom), then X ascending
      const items = (textContent.items as any[]).sort((a, b) => {
        // If Y is significantly different, sort by Y
        if (Math.abs(a.transform[5] - b.transform[5]) > 2) {
          return b.transform[5] - a.transform[5];
        }
        // Otherwise sort by X
        return a.transform[4] - b.transform[4];
      });

      const pageParagraphs = [];
      let currentLine: string[] = [];
      let lastY = items.length > 0 ? items[0].transform[5] : 0;

      for (const item of items) {
        // If Y changed significantly, it's a new line
        if (Math.abs(item.transform[5] - lastY) > 5) {
          if (currentLine.length > 0) {
            pageParagraphs.push(new Paragraph({
              children: [new TextRun(currentLine.join(' '))],
            }));
          }
          currentLine = [item.str];
          lastY = item.transform[5];
        } else {
          // If there's a big gap in X, add extra spaces
          currentLine.push(item.str);
        }
      }
      
      // Add last line
      if (currentLine.length > 0) {
        pageParagraphs.push(new Paragraph({
          children: [new TextRun(currentLine.join(' '))],
        }));
      }

      sections.push({
        children: pageParagraphs,
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
    
    const imgWidth = canvas.width / 2;
    const imgHeight = canvas.height / 2;
    
    // Standard A4 aspect ratio is approx 1.414. For width 800px, height is approx 1131px.
    const pageWidth = imgWidth;
    const pageHeight = (pageWidth * 297) / 210; // A4 ratio
    const totalPages = Math.ceil(imgHeight / pageHeight);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [pageWidth, pageHeight],
    });

    const imgData = canvas.toDataURL('image/png');

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage([pageWidth, pageHeight], 'portrait');
      
      // Calculate source y (where to clip from the original canvas)
      // Since we used scale 2, we need to multiply by 2 for the source coordinate
      const sourceY = i * pageHeight * 2;
      const sourceHeight = Math.min(pageHeight * 2, (canvas.height - sourceY));
      
      // We can use the full image and just shift the Y offset in addImage
      // but jspdf's addImage with cropping is sometimes finicky.
      // A more robust way is to draw a slice to a new canvas or just use the whole image with negative Y
      pdf.addImage(
        imgData, 
        'PNG', 
        0, 
        - (i * pageHeight), 
        imgWidth, 
        imgHeight
      );
    }
    
    document.body.removeChild(container);
    console.log(`Generated PDF with ${totalPages} pages.`);
    return pdf.output('blob');
  } catch (error) {
    console.error('Word to PDF Error:', error);
    throw error;
  }
}
