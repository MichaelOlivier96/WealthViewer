import Papa from 'papaparse';
import { toCents } from '../logic/toCents.js';
import { categorizationEngine } from '../logic/categorizationEngine.js';

export const absaProcessor = {
  process: async (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // Pre-Parser: Strip metadata rows
            // Data starts with a row where the first column is a date (YYYYMMDD)
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
                const category = categorizationEngine.categorize(description);

                transactions.push({
                  id: crypto.randomUUID(),
                  date,
                  raw_description: description,
                  amount,
                  category_id: category,
                  is_verified: false
                });
              } catch (err) {
                unparsed.push({ line: dataStartIndex + index, data: row, error: err.message });
              }
            });

            const balances = {
              opening: 0,
              closing: 0
            };

            if (transactions.length > 0) {
              const firstTx = transactions[0];
              const lastTx = transactions[transactions.length - 1];
              
              // We need the raw rows to get the Balance column
              const firstRow = results.data[dataStartIndex];
              const lastRow = results.data[results.data.length - 1];
              
              // Based on sample: Balance is in column index 3 (4th column)
              balances.opening = toCents(firstRow[3]) - firstTx.amount;
              balances.closing = toCents(lastRow[3]);
            }

            resolve({ transactions, unparsed, balances });
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err)
      });
    });
  },

  dryRun: (transactions) => {
    const netChange = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    return {
      count: transactions.length,
      netChange: netChange / 100
    };
  }
};
