import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const debugPdf = async (filePath) => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  console.log(`PDF loaded: ${filePath}, Pages: ${pdf.numPages}`);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items.map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5]
    }));

    console.log(`\n--- Page ${i} Raw Items ---`);
    items.forEach(item => {
      console.log(`[x:${item.x.toFixed(1)}, y:${item.y.toFixed(1)}] "${item.str}"`);
    });

    // Check for Date pattern
    const dates = items.filter(item => item.str.match(/^\d{2}\s[a-zA-Z]{3}$/));
    console.log(`\nDetected potential dates on Page ${i}:`, dates.map(d => d.str));

    // Check for Amount column
    const amounts = items.filter(item => item.str.match(/^-?[\d,]+\.\d{2}(Cr)?$/));
    console.log(`\nDetected potential amounts on Page ${i}:`, amounts.map(a => `x:${a.x.toFixed(1)} val:${a.str}`));
  }
};

const filePath = process.env.TEST_STATEMENT_PATH || './scripts/sample_statement.pdf';
debugPdf(filePath).catch(console.error);
