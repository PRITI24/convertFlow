import * as PDFJS from 'pdfjs-dist';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from 'docx';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Configure PDF.js worker
const PDF_JS_VERSION = '5.6.205';
const WORKER_URL = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;
PDFJS.GlobalWorkerOptions.workerSrc = WORKER_URL;

export async function convertPdfToWord(file: File): Promise<Blob> {
  console.log('Starting Professional Layout Analysis...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const sections = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i} with structure analysis...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      
      // 1. Group items into lines
      const items = (textContent.items as any[]).sort((a, b) => {
        if (Math.abs(a.transform[5] - b.transform[5]) > 3) return b.transform[5] - a.transform[5];
        return a.transform[4] - b.transform[4];
      });

      const lines: any[][] = [];
      let currentLine: any[] = [];
      let lastY = items.length > 0 ? items[0].transform[5] : 0;

      for (const item of items) {
        if (Math.abs(item.transform[5] - lastY) > 5) {
          if (currentLine.length > 0) lines.push(currentLine);
          currentLine = [item];
          lastY = item.transform[5];
        } else {
          currentLine.push(item);
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);

      // 2. Identify potential tables (lines with multiple columns sharing X boundaries)
      const pageChildren: any[] = [];
      let k = 0;
      while (k < lines.length) {
        const line = lines[k];
        
        // Table detection heuristic: multiple segments with large gaps
        const isTableLine = line.length > 1 && line.some((item, idx) => {
          if (idx === 0) return false;
          const prev = line[idx-1];
          return (item.transform[4] - (prev.transform[4] + prev.width)) > 40;
        });

        if (isTableLine) {
          // Attempt to consume subsequent lines into the table
          const tableLines = [line];
          let next = k + 1;
          while (next < lines.length) {
            const nextLine = lines[next];
            const nextIsTable = nextLine.length > 1 && Math.abs(nextLine.length - line.length) <= 2;
            if (nextIsTable) {
              tableLines.push(nextLine);
              next++;
            } else break;
          }
          
          if (tableLines.length >= 2) {
            // Reconstruct as a Word Table
            const rows = tableLines.map(rowLine => {
              // Group items into cells based on X clusters
              const cells = rowLine.map(item => new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({
                    text: item.str,
                    size: Math.round(item.transform[3]) * 2,
                  })]
                })],
                width: { size: 100 / rowLine.length, type: WidthType.PERCENTAGE },
              }));
              return new TableRow({ children: cells });
            });
            
            pageChildren.push(new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              }
            }));
            pageChildren.push(new Paragraph({ children: [] })); // Spacer
            k = next;
            continue;
          }
        }

        // Standard Paragraph rendering for non-table lines
        const runItems = line.map((item, idx) => {
          const runs = [];
          if (idx > 0) {
            const gap = item.transform[4] - (line[idx-1].transform[4] + line[idx-1].width);
            if (gap > 5) runs.push(new TextRun({ text: " ", size: Math.round(item.transform[3]) * 2 }));
          }
          runs.push(new TextRun({
            text: item.str,
            size: Math.round(item.transform[3]) * 2,
            bold: /bold|heavy/i.test(item.fontName || ''),
            italics: /italic|oblique/i.test(item.fontName || ''),
            font: "Arial",
          }));
          return runs;
        }).flat();

        const xStart = line[0].transform[4];
        let alignment: any = AlignmentType.LEFT;
        if (xStart > viewport.width * 0.3 && xStart < viewport.width * 0.5 && line.length < 5) {
          alignment = AlignmentType.CENTER;
        }

        const firstFontSize = Math.round(line[0].transform[3]);
        let heading: any = undefined;
        if (firstFontSize > 18) heading = HeadingLevel.HEADING_1;
        else if (firstFontSize > 14) heading = HeadingLevel.HEADING_2;

        pageChildren.push(new Paragraph({
          children: runItems,
          alignment,
          heading,
          spacing: { after: 120, before: heading ? 240 : 0 },
        }));
        
        k++;
      }

      sections.push({ children: pageChildren });
    }

    const doc = new Document({ sections });
    return await Packer.toBlob(doc);
  } catch (error) {
    console.error('Professional Converter Error:', error);
    throw error;
  }
}

export async function convertWordToPdf(file: File): Promise<Blob> {
  console.log('Starting Vector-Grade Word to PDF conversion...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '840px'; // Matching standard A4 width approx
    container.style.padding = '60px'; // Margins
    container.style.background = 'white';
    container.style.lineHeight = '1.6';
    container.style.fontFamily = 'Arial, sans-serif';
    container.className = 'docx-content-preview';
    container.innerHTML = `
      <style>
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        h1 { font-size: 24pt; margin-bottom: 0.5em; }
        p { margin-bottom: 1em; }
      </style>
      ${html}
    `;
    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 3, // High-fidelity scaling for crispness
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);

    // Logic for paginated PDF
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pageWidth = 595.28; // A4 point width
    const pageHeight = 841.89; // A4 point height
    const canvasPageHeight = (imgWidth * pageHeight) / pageWidth;
    
    const totalPages = Math.ceil(imgHeight / canvasPageHeight);
    const pdf = new jsPDF('p', 'pt', 'a4');

    for (let j = 0; j < totalPages; j++) {
      if (j > 0) pdf.addPage();
      
      const sourceY = j * canvasPageHeight;
      const sourceHeight = Math.min(canvasPageHeight, imgHeight - sourceY);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imgWidth;
      tempCanvas.height = sourceHeight;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        const pageData = tempCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(pageData, 'JPEG', 0, 0, pageWidth, (sourceHeight * pageWidth) / imgWidth);
      }
    }
    
    return pdf.output('blob');
  } catch (error) {
    console.error('Word to PDF Error:', error);
    throw error;
  }
}
