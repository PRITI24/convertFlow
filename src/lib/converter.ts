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
import { renderAsync } from 'docx-preview';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Configure PDF.js worker
const PDF_JS_VERSION = '5.6.205';
const WORKER_URL = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;
PDFJS.GlobalWorkerOptions.workerSrc = WORKER_URL;

export async function convertPdfToWord(file: File): Promise<Blob> {
  console.log('Starting Advanced Professional Layout Analysis...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const sections = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Analyzing page ${i} structure...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Group items into lines with a small Y-tolerance
      const items = (textContent.items as any[]).sort((a, b) => {
        if (Math.abs(a.transform[5] - b.transform[5]) > 3) return b.transform[5] - a.transform[5];
        return a.transform[4] - b.transform[4];
      });

      const lines: any[][] = [];
      let currentLine: any[] = [];
      let lastY = items.length > 0 ? items[0].transform[5] : 0;

      for (const item of items) {
        if (Math.abs(item.transform[5] - lastY) > 6) {
          if (currentLine.length > 0) lines.push(currentLine);
          currentLine = [item];
          lastY = item.transform[5];
        } else {
          currentLine.push(item);
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);

      const pageChildren: any[] = [];
      let k = 0;
      while (k < lines.length) {
        const line = lines[k];
        
        // Refined Table detection: multiple segments with large gutters
        const gutters = [];
        for(let j = 1; j < line.length; j++) {
           gutters.push(line[j].transform[4] - (line[j-1].transform[4] + line[j-1].width));
        }

        const isPotentialTable = line.length >= 2 && gutters.some(g => g > 30);

        if (isPotentialTable) {
          const tableLines = [line];
          let next = k + 1;
          while (next < lines.length) {
            const nextLine = lines[next];
            // Table rows usually have similar column counts or alignment
            if (Math.abs(nextLine.length - line.length) <= 1 && nextLine.length >= 2) {
              tableLines.push(nextLine);
              next++;
            } else break;
          }
          
          if (tableLines.length >= 2) {
             const maxCols = Math.max(...tableLines.map(l => l.length));
             const rows = tableLines.map(rowLine => {
               const cells = [];
               for(let c = 0; c < maxCols; c++) {
                 const item = rowLine[c] || { str: "", transform: [0,0,0,10,0,0] };
                 cells.push(new TableCell({
                   children: [new Paragraph({
                     children: [new TextRun({
                       text: item.str,
                       size: Math.round(item.transform[3]) * 2,
                       bold: /bold|heavy/i.test(item.fontName || ''),
                     })]
                   })],
                   width: { size: 100 / maxCols, type: WidthType.PERCENTAGE },
                 }));
               }
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
             pageChildren.push(new Paragraph({ children: [] }));
             k = next;
             continue;
          }
        }

        // Standard Paragraph rendering
        const runItems = line.map((item, idx) => {
          const runs = [];
          if (idx > 0) {
            const prev = line[idx-1];
            const gap = item.transform[4] - (prev.transform[4] + prev.width);
            if (gap > 5) runs.push(new TextRun({ text: " ", size: Math.round(item.transform[3]) * 2 }));
          }
          runs.push(new TextRun({
            text: item.str,
            size: Math.round(item.transform[3]) * 2,
            bold: /bold|heavy/i.test(item.fontName || ''),
            italics: /italic|oblique/i.test(item.fontName || ''),
            font: "Calibri",
          }));
          return runs;
        }).flat();

        const xStart = line[0].transform[4];
        let alignment: any = AlignmentType.LEFT;
        if (xStart > viewport.width * 0.35 && xStart < viewport.width * 0.5 && line.length < 4) {
           alignment = AlignmentType.CENTER;
        }

        const fontSize = Math.round(line[0].transform[3]);
        let heading: any = undefined;
        if (fontSize > 18) heading = HeadingLevel.HEADING_1;
        else if (fontSize > 14) heading = HeadingLevel.HEADING_2;

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
    console.error('Pro PDF to Word Error:', error);
    throw error;
  }
}

export async function convertWordToPdf(file: File): Promise<Blob> {
  console.log('Starting Ultra-High Fidelity Word to PDF conversion...');
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '840px'; 
    container.style.background = 'white';
    container.className = 'docx-professional-render';
    document.body.appendChild(container);

    // Use docx-preview for superior rendering
    await renderAsync(arrayBuffer, container, undefined, {
      debug: false,
      experimental: true
    });

    // Enhancement: Ensure all children are visible and layout is stable
    const canvas = await html2canvas(container, {
      scale: 3, 
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 840
    });
    
    document.body.removeChild(container);

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pageWidth = 595.28; 
    const pageHeight = 841.89; 
    const canvasPageHeight = (imgWidth * pageHeight) / pageWidth;
    
    const totalPages = Math.ceil(imgHeight / canvasPageHeight);
    const pdf = new jsPDF('p', 'pt', 'a4', true); // Use compression

    for (let j = 0; j < totalPages; j++) {
      if (j > 0) pdf.addPage();
      
      const sourceY = j * canvasPageHeight;
      const sourceHeight = Math.min(canvasPageHeight, imgHeight - sourceY);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imgWidth;
      tempCanvas.height = sourceHeight;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, imgWidth, sourceHeight);
        ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        const pageData = tempCanvas.toDataURL('image/jpeg', 0.9);
        pdf.addImage(pageData, 'JPEG', 0, 0, pageWidth, (sourceHeight * pageWidth) / imgWidth, undefined, 'FAST');
      }
    }
    
    return pdf.output('blob');
  } catch (error) {
    console.error('Pro Word to PDF Error:', error);
    throw error;
  }
}
