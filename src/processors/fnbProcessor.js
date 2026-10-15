import * as pdfjs from 'pdfjs-dist';
import { toCents } from '../logic/toCents.js';
import { categorizationEngine } from '../logic/categorizationEngine.js';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const MONTH_MAP = {
  'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
  'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
};

export const fnbProcessor = {
  process: async (arrayBuffer) => {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const transactions = [];
    const unparsed = [];
    let currentTx = null;
    let statementYear = new Date().getFullYear();
    let columns = { date: null, desc: null, amount: null, balance: null };

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewBox = page.viewBox;
      const textContent = await page.getTextContent();
      
      const items = textContent.items.map(item => ({
        str: item.str,
        x: item.transform[4] - viewBox[0],
        y: item.transform[5] - viewBox[1]
      }));

      if (i === 1) {
        const headerText = items.map(item => item.str).join(' ');
        const yearMatch = headerText.match(/\b(20\d{2})\b/);
        if (yearMatch) statementYear = parseInt(yearMatch[1]);
      }

      items.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
        return a.x - b.x;
      });

      const rows = [];
      let currentRow = [];
      let lastY = items[0]?.y;

      for (const item of items) {
        if (Math.abs(item.y - lastY) > 3) {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [item];
          lastY = item.y;
        } else {
          currentRow.push(item);
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      for (const row of rows) {
        const fullRowText = row.map(item => item.str).join(' ').trim();
        
        // Dynamic Column Detection: Look for headers
        if (fullRowText.match(/Date/i) && fullRowText.match(/Description/i) && fullRowText.match(/Amount/i)) {
          columns.date = row.find(it => it.str.match(/Date/i))?.x;
          columns.desc = row.find(it => it.str.match(/Description/i))?.x;
          columns.amount = row.find(it => it.str.match(/Amount/i))?.x;
          columns.balance = row.find(it => it.str.match(/Balance/i))?.x;
          continue;
        }

        const dateMatch = fullRowText.match(/^(\d{2})\s([a-zA-Z]{3})\b/);
        
        // Map row items to detected columns
        const rowData = { date: '', desc: [], amount: [], balance: [] };
        row.forEach(item => {
          const isMoney = item.str.match(/^-?[\d,]+\.\d{2}(Cr)?$/);
          
          if (columns.date && Math.abs(item.x - columns.date) < 40) {
             rowData.date = item.str;
          } else if (columns.amount && Math.abs(item.x - columns.amount) < 60 && isMoney) {
             rowData.amount.push(item);
          } else if (columns.balance && Math.abs(item.x - columns.balance) < 60 && isMoney) {
             rowData.balance.push(item);
          } else if (item.x > (columns.date ? columns.date + 15 : 30) && item.x < (columns.amount || 400)) {
             // Anything between Date and Amount is considered part of the description
             rowData.desc.push(item.str);
          } else if (!columns.date && item.x < 100 && item.str.match(/^\d{2}\s[a-zA-Z]{3}/)) {
             rowData.date = item.str; // Fallback for date detection
          }
        });

        if (dateMatch && rowData.amount.length > 0) {
          if (currentTx) {
            currentTx.category_id = categorizationEngine.categorize(currentTx.raw_description);
            transactions.push(currentTx);
          }

          const day = dateMatch[1];
          const month = MONTH_MAP[dateMatch[2]];
          const date = `${statementYear}/${month}/${day}`;
          
          const amountItem = rowData.amount[0];
          const amountStr = amountItem.str;
          let amountCents = toCents(amountStr);
          
          // Polarity Logic
          if (amountStr.toLowerCase().includes('cr')) {
            amountCents = Math.abs(amountCents);
          } else {
            // FNB Current: Amount column is usually debits unless 'Cr'
            // FNB Credit: 'Debit' column vs 'Credit' column
            // For now, assume anything in Amount without Cr is a debit
            amountCents = -Math.abs(amountCents);
          }

          currentTx = {
            id: crypto.randomUUID(),
            date,
            raw_description: rowData.desc.join(' ').trim() || 'No Description',
            amount: amountCents,
            is_verified: false
          };
        } else if (currentTx && rowData.desc.length > 0 && !dateMatch) {
          // Continuation line
          const extraDesc = rowData.desc.join(' ').trim();
          if (extraDesc && !extraDesc.match(/Balance/i)) {
            currentTx.raw_description += ' ' + extraDesc;
          }
        } else if (fullRowText.match(/(?:Opening|Closing)\sBalance/i)) {
          const balanceMatch = fullRowText.match(/(-?[\d,]+\.\d{2})/);
          if (balanceMatch) {
            unparsed.push({ type: 'BALANCE', text: fullRowText, cents: toCents(balanceMatch[1]) });
          }
        }
      }
    }
    
    // Finalize the very last transaction
    if (currentTx) {
      currentTx.category_id = categorizationEngine.categorize(currentTx.raw_description);
      transactions.push(currentTx);
    }

    // Explicit Balance Extraction from unparsed or rows
    const extractBalance = (type) => {
      const entry = unparsed.find(u => u.type === 'BALANCE' && u.text.toLowerCase().includes(type.toLowerCase()));
      if (!entry) return 0;
      let cents = entry.cents;
      if (entry.text.toLowerCase().includes('dr')) cents = -Math.abs(cents);
      if (entry.text.toLowerCase().includes('cr')) cents = Math.abs(cents);
      return cents;
    };

    const balances = {
      opening: extractBalance('Opening'),
      closing: extractBalance('Closing')
    };

    return { transactions, unparsed, balances };
  },

  dryRun: (result) => {
    const { transactions, unparsed } = result;
    const netChangeCents = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const openingBalance = unparsed.find(u => u.type === 'BALANCE' && u.text.toLowerCase().includes('opening'))?.cents || 0;
    const closingBalance = unparsed.find(u => u.type === 'BALANCE' && u.text.toLowerCase().includes('closing'))?.cents || 0;
    
    return {
      count: transactions.length,
      netChange: netChangeCents / 100,
      match: closingBalance !== 0 ? (openingBalance + netChangeCents === closingBalance) : null
    };
  }
};
