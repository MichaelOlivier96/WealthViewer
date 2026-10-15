import * as pdfjs from 'pdfjs-dist';
import { toCents } from '../logic/toCents.js';
import { categorizationEngine } from '../logic/categorizationEngine.js';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.js?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MONTH_MAP = {
  'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
  'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
};

const isAmount = (str) => /^-?[R$£€]?\s?[\d,\s]+\.\d{2}(Cr|Dr)?$/i.test(str);

const cleanAmount = (str) => {
  if (!str) return 0;
  const cleaned = String(str).replace(/[R$£€\s,]/g, '').replace(/Cr$/i, '').replace(/Dr$/i, '');
  return toCents(cleaned);
};

const detectYear = (items) => {
  const text = items.map(it => it.str).join(' ');
  const match = text.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : new Date().getFullYear();
};

const detectBalances = (items) => {
  const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const text = sortedItems.map(it => it.str).join(' ');
  let opening = 0;
  let closing = 0;

  const fnbOpening = text.match(/Balance Brought Forward\s+(-?[\d,\s]+\.\d{2})/i);
  const fnbClosing = text.match(/Closing Balance\s+(-?[\d,\s]+\.\d{2})/i);
  const discOpening = text.match(/Opening balance.*?R?\s?(-?[\d,\s]+\.\d{2})/i);
  const discClosing = text.match(/Closing balance.*?R?\s?(-?[\d,\s]+\.\d{2})/i);

  if (fnbOpening) opening = cleanAmount(fnbOpening[1]);
  if (fnbClosing) closing = cleanAmount(fnbClosing[1]);
  if (discOpening) opening = cleanAmount(discOpening[1]);
  if (discClosing) closing = cleanAmount(discClosing[1]);

  return { opening, closing };
};

export const specificProcessors = {
  'fnb_credit': {
    name: 'FNB Credit Card',
    process: (rows, year) => {
      return rows.map(row => {
        const dateMatch = row.find(it => it.str.match(/^(\d{2})\s([a-zA-Z]{3})/));
        if (!dateMatch) return null;
        
        const numericItems = row.filter(it => it.x > dateMatch.x + 20 && isAmount(it.str));
        const sortedNumerics = [...numericItems].sort((a, b) => a.x - b.x);
        
        let amountItem = null;
        let amountStr = '';
        let amount = 0;

        if (sortedNumerics.length >= 2) {
          amountItem = sortedNumerics[sortedNumerics.length - 2];
        } else if (sortedNumerics.length === 1 && sortedNumerics[0].x < 480) {
          amountItem = sortedNumerics[0];
        }

        if (amountItem) {
          amountStr = amountItem.str;
          amount = cleanAmount(amountStr);
        } else {
          const descItems = row.filter(it => it.x > dateMatch.x + 5 && it.x < 550);
          for (const it of descItems) {
            const match = it.str.match(/(-?[\d,\s]+\.\d{2})(Cr|Dr)?$/i);
            if (match) {
              amountStr = match[0];
              amount = cleanAmount(amountStr);
              it.str = it.str.replace(match[0], '').trim();
              break;
            }
          }
        }

        if (amount === 0 && amountStr === '') return null;

        if (amountStr.includes('Cr') || amountStr.includes('+')) {
          amount = Math.abs(amount);
        } else {
          amount = -Math.abs(amount); 
        }

        const description = row
          .filter(it => it.x > dateMatch.x + 5 && it.x < (amountItem ? amountItem.x - 5 : 500))
          .map(it => it.str).join(' ');

        const monthStr = dateMatch.str.match(/[a-zA-Z]{3}/i)[0];
        const monthKey = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
        
        return {
          id: crypto.randomUUID(),
          date: `${year}/${MONTH_MAP[monthKey]}/${dateMatch.str.match(/^\d{2}/)[0]}`,
          raw_description: description || 'No Description',
          amount,
          category_id: categorizationEngine.categorize(description),
          is_verified: false,
          is_transfer: false
        };
      }).filter(Boolean);
    }
  },
  'fnb_current': {
    name: 'FNB Current Account',
    process: (rows, year) => {
      return rows.map(row => {
        const dateMatch = row.find(it => it.str.match(/^(\d{2})\s([a-zA-Z]{3})/));
        if (!dateMatch) return null;
        
        // FNB Current Column Layout: Date (~50) | Description (~100-350) | Amount (~380-450) | Balance (~500+)
        const numericItems = row.filter(it => it.x > dateMatch.x + 20 && isAmount(it.str));
        const sortedNumerics = [...numericItems].sort((a, b) => a.x - b.x);
        
        let amountItem = null;
        // In Current accounts, the Amount is usually at X between 350 and 480.
        // The Balance is > 480.
        amountItem = sortedNumerics.find(it => it.x > 300 && it.x < 480);
        
        // Fallback: If only one number and it's not too far right
        if (!amountItem && sortedNumerics.length === 1 && sortedNumerics[0].x < 480) {
          amountItem = sortedNumerics[0];
        }

        let amount = 0;
        let amountStr = '';

        if (amountItem) {
          amountStr = amountItem.str;
          amount = cleanAmount(amountStr);
        } else {
          // Check description for merged amount
          const descItems = row.filter(it => it.x > dateMatch.x + 5 && it.x < 480);
          for (const it of descItems) {
            const match = it.str.match(/(-?[\d,\s]+\.\d{2})(Cr|Dr)?$/i);
            if (match) {
              amountStr = match[0];
              amount = cleanAmount(amountStr);
              it.str = it.str.replace(match[0], '').trim();
              break;
            }
          }
        }

        if (amount === 0 && amountStr === '') return null;

        // FNB Current Sign Logic: Deposits often have NO sign, withdrawals often have NO sign.
        // We rely on columns or 'Cr'/'Dr'.
        if (amountStr.includes('Cr') || amountStr.includes('+')) {
          amount = Math.abs(amount);
        } else if (amountStr.includes('-') || amountStr.includes('Dr')) {
          amount = -Math.abs(amount);
        } else {
          // Default to negative for safety
          amount = -Math.abs(amount); 
        }

        const description = row
          .filter(it => it.x > dateMatch.x + 5 && it.x < (amountItem ? amountItem.x - 5 : 380))
          .map(it => it.str).join(' ');

        const monthStr = dateMatch.str.match(/[a-zA-Z]{3}/i)[0];
        const monthKey = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
        
        return {
          id: crypto.randomUUID(),
          date: `${year}/${MONTH_MAP[monthKey]}/${dateMatch.str.match(/^\d{2}/)[0]}`,
          raw_description: description || 'No Description',
          amount,
          category_id: categorizationEngine.categorize(description),
          is_verified: false,
          is_transfer: false
        };
      }).filter(Boolean);
    }
  },
  'discovery_unified': {
    name: 'Discovery PDF',
    process: (rows, year, logs = []) => {
      return rows.map(row => {
        const dateMatch = row.find(it => it.str.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/));
        if (!dateMatch) return null;
        const dateParts = dateMatch.str.match(/(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/);
        
        const allAmounts = row.filter(it => it.x > dateMatch.x + 20 && isAmount(it.str));
        if (allAmounts.length === 0) return null;
        
        const sortedAmounts = [...allAmounts].sort((a, b) => a.x - b.x);
        const amountItem = sortedAmounts[0];
        let amount = cleanAmount(amountItem.str);
        
        const description = row.filter(it => it.x > dateMatch.x + 5 && !allAmounts.includes(it)).map(it => it.str).join(' ');
        
        if (amountItem.str.includes('+') || amountItem.str.includes('Cr') || 
            description.match(/Interest|Salary|Refund|Payment Rec|Credit/i)) {
          amount = Math.abs(amount);
        } else {
          amount = -Math.abs(amount);
        }

        return {
          id: crypto.randomUUID(),
          date: `${dateParts[1]}/${dateParts[2]}/${dateParts[3]}`,
          raw_description: description || 'No Description',
          amount,
          category_id: categorizationEngine.categorize(description),
          is_verified: false,
          is_transfer: false
        };
      }).filter(Boolean);
    }
  },
  'absa_pdf': {
    name: 'ABSA PDF',
    process: (rows, year) => {
      return rows.map(row => {
        const dateMatch = row.find(it => it.str.match(/^(\d{2})\/(\d{2})\/(\d{4})/));
        if (!dateMatch) return null;
        const amounts = row.filter(it => isAmount(it.str));
        if (amounts.length === 0) return null;
        const debit = cleanAmount(amounts.find(it => it.x > 400)?.str);
        const credit = cleanAmount(amounts.find(it => it.x < 400 && it.x > 200)?.str);
        const dateParts = dateMatch.str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        return {
          id: crypto.randomUUID(),
          date: `${dateParts[3]}/${dateParts[2]}/${dateParts[1]}`,
          raw_description: row.filter(it => it.x > dateMatch.x + 5 && !amounts.includes(it)).map(it => it.str).join(' '),
          amount: credit !== 0 ? credit : -Math.abs(debit),
          category_id: categorizationEngine.categorize(''),
          is_verified: false,
          is_transfer: false
        };
      }).filter(Boolean);
    }
  },
  'fnb_homeloan': {
    name: 'FNB Home Loan',
    process: (rows, year) => {
      return rows.map(row => {
        const dateMatch = row.find(it => it.str.match(/^(\d{2})\s([a-zA-Z]{3})/));
        if (!dateMatch) return null;
        const amounts = row.filter(it => isAmount(it.str));
        if (amounts.length === 0) return null;
        const description = row.filter(it => it.x > 100 && !amounts.includes(it)).map(it => it.str).join(' ');
        const amount = cleanAmount(amounts[0].str);
        const monthStr = dateMatch.str.match(/[a-zA-Z]{3}/i)[0];
        const monthKey = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
        return {
          id: crypto.randomUUID(),
          date: `${year}/${MONTH_MAP[monthKey]}/${dateMatch.str.match(/^\d{2}/)[0]}`,
          raw_description: description || 'No Description',
          amount,
          category_id: categorizationEngine.categorize(description),
          is_verified: false,
          is_transfer: false
        };
      }).filter(Boolean);
    }
  }
};

export const pdfProcessor = {
  process: async (arrayBuffer, type) => {
    const logs = [`Starting import for ${type}`];
    try {
      logs.push('Initializing PDF.js...');
      const loadingTask = pdfjs.getDocument(new Uint8Array(arrayBuffer));
      const pdf = await loadingTask.promise;
      const processor = specificProcessors[type];
      
      if (!processor) throw new Error(`Unknown processor type: ${type}`);
      logs.push(`Processor found: ${processor.name}`);
      
      const allTransactions = [];
      let statementYear = new Date().getFullYear();
      let extractedBalances = { opening: 0, closing: 0 };

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items.map(it => ({
          str: it.str.trim(),
          x: it.transform[4],
          y: it.transform[5]
        })).filter(it => it.str.length > 0);

        if (items.length === 0) continue;
        if (i === 1) {
          statementYear = detectYear(items);
          extractedBalances = detectBalances(items);
          logs.push(`Balances detected: Opening=${extractedBalances.opening}, Closing=${extractedBalances.closing}`);
        }

        items.sort((a, b) => b.y - a.y);
        const rows = [];
        let currentRow = [];
        let lastY = items[0].y;
        
        items.forEach(item => {
          if (Math.abs(item.y - lastY) > 4) {
            rows.push(currentRow.sort((a, b) => a.x - b.x));
            currentRow = [item];
            lastY = item.y;
          } else {
            currentRow.push(item);
          }
        });
        rows.push(currentRow.sort((a, b) => a.x - b.x));

        const txs = processor.process(rows, statementYear, logs);
        allTransactions.push(...txs);
        logs.push(`Page ${i}: Found ${txs.length} transactions`);
      }
      return { transactions: allTransactions, logs, balances: extractedBalances };
    } catch (err) {
      logs.push(`❌ Error: ${err.message}`);
      return { transactions: [], logs };
    }
  }
};
