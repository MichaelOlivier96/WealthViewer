import fs from 'fs';
import Papa from 'papaparse';
import { toCents } from '../logic/toCents.js';
import { categorizationEngine } from '../logic/categorizationEngine.js';

// Mocking absaProcessor logic for Node test
const testAbsa = (csvData) => {
  const results = Papa.parse(csvData, { header: false, skipEmptyLines: true });
  
  let dataStartIndex = results.data.findIndex(row => 
    row[0] && String(row[0]).match(/^\d{8}$/)
  );

  if (dataStartIndex === -1) dataStartIndex = 0;

  const transactions = [];
  const unparsed = [];

  results.data.slice(dataStartIndex).forEach((row, index) => {
    try {
      const rawDate = String(row[0]);
      const description = String(row[1] || '').trim();
      const rawAmount = String(row[2]);

      if (!rawDate.match(/^\d{8}$/) || !rawAmount) {
        unparsed.push({ line: dataStartIndex + index, data: row });
        return;
      }

      const date = `${rawDate.slice(0, 4)}/${rawDate.slice(4, 6)}/${rawDate.slice(6, 8)}`;
      const amount = toCents(rawAmount);

      transactions.push({
        date,
        raw_description: description,
        amount
      });
    } catch (err) {
      unparsed.push({ line: dataStartIndex + index, data: row, error: err.message });
    }
  });

  return { transactions, unparsed };
};

const sampleCsv = `Statement for Account 1234
User: Test
Date: 20260506

20240101,UBER TRIP,-150.00
20240102,CHECKERS,500.00
`;

const result = testAbsa(sampleCsv);
console.log('Transactions:', JSON.stringify(result.transactions, null, 2));
console.log('Unparsed count:', result.unparsed.length);
