import * as pdfjs from 'pdfjs-dist';
import { toCents } from '../logic/toCents.js';
import { categorizationEngine } from '../logic/categorizationEngine.js';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const MONTH_MAP = {
  'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
  'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
};

const DATE_PATTERNS = [
  { regex: /(\d{2})\s([a-zA-Z]{3})\b/, type: 'DD_MMM' },      // 04 Mar
  { regex: /(\d{4})\/(\d{2})\/(\d{2})/, type: 'YYYY_MM_DD' }, // 2026/03/25
  { regex: /(\d{4})(\d{2})(\d{2})/, type: 'YYYYMMDD' }       // 20260325
];

export const universalPdfProcessor = {
  process: async (arrayBuffer) => {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const transactions = [];
    const logs = [];
    let statementYear = new Date().getFullYear();

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewBox = page.viewBox;
      const textContent = await page.getTextContent();
      
      const items = textContent.items.map(item => ({
        str: item.str,
        x: item.transform[4] - viewBox[0],
        y: item.transform[5] - viewBox[1]
      }));

      // Find year on any page
      const pageText = items.map(item => item.str).join(' ');
      const yearMatch = pageText.match(/\b(20\d{2})\b/);
      if (yearMatch) statementYear = parseInt(yearMatch[1]);

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
        if (!fullRowText) continue;

        // 1. Detect Date
        let detectedDate = null;
        for (const pattern of DATE_PATTERNS) {
          const match = fullRowText.match(pattern.regex);
          if (match) {
            if (pattern.type === 'DD_MMM') {
              detectedDate = `${statementYear}/${MONTH_MAP[match[2]]}/${match[1]}`;
            } else if (pattern.type === 'YYYY_MM_DD') {
              detectedDate = match[0];
            } else if (pattern.type === 'YYYYMMDD') {
              detectedDate = `${match[1]}/${match[2]}/${match[3]}`;
            }
            break;
          }
        }

        // 2. Detect Amounts (Fuzzy)
        // We look for anything that looks like a number with decimals
        const monetaryItems = row.filter(item => 
          item.str.match(/^-?[\d,]+\.\d{2}(Cr)?$/i)
        );

        if (detectedDate && monetaryItems.length > 0) {
          // Found a potential transaction row!
          const amountItem = monetaryItems[0];
          const amountStr = amountItem.str;
          let amountCents = toCents(amountStr);

          // Polarity Logic
          if (amountStr.toLowerCase().includes('cr')) {
            amountCents = Math.abs(amountCents);
          } else if (amountStr.toLowerCase().includes('dr') || amountStr.includes('-')) {
            amountCents = -Math.abs(amountCents);
          } else {
            // Default to debit if no sign (common for FNB/ABSA transaction columns)
            amountCents = -Math.abs(amountCents);
          }

          // Description is everything EXCEPT the date and amount
          const description = row
            .filter(item => !item.str.match(monetaryItems[0].str) && !item.str.match(/\d{2}\s[a-zA-Z]{3}/))
            .map(item => item.str)
            .join(' ')
            .trim();

          transactions.push({
            id: crypto.randomUUID(),
            date: detectedDate,
            raw_description: description || 'No Description',
            amount: amountCents,
            category_id: categorizationEngine.categorize(description),
            is_verified: false
          });
          
          logs.push(`✅ [${detectedDate}] ${amountCents/100}: ${description}`);
        } else {
          // Check for balances
          const balanceMatch = fullRowText.match(/(?:Opening|Closing)\sBalance\s*(-?[\d,]+\.\d{2})/i);
          if (balanceMatch) {
            logs.push(`💰 Balance Found: ${fullRowText}`);
          }
        }
      }
    }
    
    // Final balance extraction (using the improved logic from before)
    const openingMatch = items => items.map(it => it.str).join(' ').match(/Opening\sBalance\s*(-?[\d,]+\.\d{2}(?:\s?Cr)?)/i);
    const closingMatch = items => items.map(it => it.str).join(' ').match(/Closing\sBalance\s*(-?[\d,]+\.\d{2}(?:\s?Cr)?)/i);
    
    // We'll return the transactions and logs
    return { transactions, logs };
  }
};
