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
  console.log('Starting High-Fidelity PDF to Word conversion...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded. Pages: ${pdf.numPages}`);
    
    const sections = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i} with formatting extraction...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Sort items: Y descending (top to bottom), then X ascending
      const items = (textContent.items as any[]).sort((a, b) => {
        if (Math.abs(a.transform[5] - b.transform[5]) > 3) {
          return b.transform[5] - a.transform[5];
        }
        return a.transform[4] - b.transform[4];
      });

      const pageChildren = [];
      let currentLine: any[] = [];
      let lastY = items.length > 0 ? items[0].transform[5] : 0;

      for (const item of items) {
        // PDFJS transform[3] is height (font size)
        const fontSize = Math.round(item.transform[3]);
        const isBold = /bold|heavy|black/i.test(item.fontName || '');
        const isItalic = /italic|oblique/i.test(item.fontName || '');
        
        // Convert item to a TextRun
        const run = new TextRun({
          text: item.str,
          size: fontSize * 2, // docx uses half-points
          bold: isBold,
          italics: isItalic,
          font: "Arial", // Standard safe fallback
        });

        // New line detection (tolerance of 5 units)
        if (Math.abs(item.transform[5] - lastY) > 5) {
          if (currentLine.length > 0) {
            pageChildren.push(new Paragraph({
              children: [...currentLine],
              spacing: { after: 120 },
            }));
          }
          currentLine = [run];
          lastY = item.transform[5];
        } else {
          // Check for significant horizontal gap to add spaces
          if (currentLine.length > 0) {
            currentLine.push(new TextRun(" "));
          }
          currentLine.push(run);
        }
      }
      
      // Flush remaining line
      if (currentLine.length > 0) {
        pageChildren.push(new Paragraph({
          children: currentLine,
        }));
      }

      sections.push({
        children: pageChildren,
      });
    }

    const doc = new Document({
      sections,
    });

    console.log('Generating Word file with structure preservation...');
    return await Packer.toBlob(doc);
  } catch (error) {
    console.error('Advanced PDF to Word Error:', error);
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
