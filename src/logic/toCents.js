export const toCents = (amountStr) => {
  if (!amountStr) return 0;
  
  // Clean string: remove commas and whitespace
  let cleanStr = String(amountStr).replace(/,/g, '').trim();
  
  // Handle 'Cr' suffix (FNB specific)
  const isCredit = cleanStr.toLowerCase().includes('cr');
  cleanStr = cleanStr.replace(/cr/i, '');
  
  let amount = parseFloat(cleanStr);
  if (isNaN(amount)) return 0;

  // Convert to integer cents
  let cents = Math.round(amount * 100);

  // If it's a credit, ensure it's positive.
  // If it's a debit (often has '-' in CSVs), it stays negative.
  // Note: FNB PDFs often show debits as positive in a debit column,
  // that specific logic will be handled in the processor.
  if (isCredit) {
    cents = Math.abs(cents);
  }

  return cents;
};

export const fromCents = (cents) => {
  return (cents / 100).toFixed(2);
};
