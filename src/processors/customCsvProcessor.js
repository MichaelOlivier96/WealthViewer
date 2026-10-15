import Papa from 'papaparse';
import { toCents } from '../logic/toCents.js';
import { categorizationEngine } from '../logic/categorizationEngine.js';

export const customCsvProcessor = {
  process: async (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions = [];
            const unparsed = [];
            
            results.data.forEach((row, index) => {
              try {
                // Check if the required core columns exist in the row
                if (!row.Dates) return;
                
                // Assuming date is in YYYY/MM/DD format
                const rawDate = row.Dates.trim();
                const description = (row.Descriptions || row.Categories || row.Group || 'Unknown').trim();
                
                // Parse Debit and Credit
                const debit = row.Debit ? parseFloat(row.Debit) : 0;
                const credit = row.Credit ? parseFloat(row.Credit) : 0;
                
                let amountInRands = 0;
                if (debit > 0) {
                  amountInRands = -Math.abs(debit);
                } else if (credit > 0) {
                  amountInRands = Math.abs(credit);
                } else if (row.Amount) {
                  // Fallback if it's signed already
                  amountInRands = parseFloat(row.Amount);
                }
                
                const amount = toCents(amountInRands);
                const category = categorizationEngine.categorize(description);
                
                // Check if it's explicitly marked as a Transfer in the source file
                const isTransfer = (row.Type && row.Type.toLowerCase().includes('transfer')) || 
                                   (row.Group && row.Group.toLowerCase().includes('transfer')) ||
                                   (row.Categories && row.Categories.toLowerCase().includes('transfer'));
                                   
                transactions.push({
                  id: crypto.randomUUID(),
                  date: rawDate,
                  raw_description: description,
                  amount,
                  category_id: category,
                  is_verified: false,
                  is_transfer: isTransfer ? 1 : 0
                });
              } catch (err) {
                unparsed.push({ line: index, data: row, error: err.message });
              }
            });

            resolve({ transactions, unparsed, balances: { opening: 0, closing: 0 } });
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err)
      });
    });
  }
};
