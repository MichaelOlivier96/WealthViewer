import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fnbProcessor } from '../processors/fnbProcessor.js';

async function test() {
  const filePath = process.env.TEST_STATEMENT_PATH || './scripts/sample_statement.pdf';
  const data = fs.readFileSync(filePath).buffer;
  const result = await fnbProcessor.process(data);
  
  console.log(`Parsed ${result.transactions.length} transactions.`);
  result.transactions.forEach(tx => {
    console.log(`[${tx.date}] ${tx.amount / 100} - ${tx.raw_description}`);
  });
}

test().catch(console.error);
