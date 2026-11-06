export const number = (value) => Number(value || 0);

// Applies a whole-party credit to the oldest open invoices first. This keeps the
// party ledger and invoice-wise follow-up on the same balance.
export function reconcileInvoices(invoices, { partyKey, initialKey, directCredits = [], adjustments = [] }) {
  const directByInvoice = {};
  const wholeCreditsByParty = {};

  [...directCredits, ...adjustments].forEach((row) => {
    const amount = number(row.amount);
    if (!amount) return;
    if (row.invoiceId) directByInvoice[row.invoiceId] = number(directByInvoice[row.invoiceId]) + amount;
    else if (row.partyId) wholeCreditsByParty[row.partyId] = number(wholeCreditsByParty[row.partyId]) + amount;
  });

  const sorted = [...invoices].sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date)) || String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)));
  const reconciled = sorted.map((invoice) => ({
    ...invoice,
    adjustment: number(invoice.adjustment),
    directCredit: number(directByInvoice[invoice.id]),
    allocatedCredit: 0,
  }));

  reconciled.forEach((invoice) => {
    const partyId = invoice[partyKey];
    const open = Math.max(0, number(invoice.total_amount) - number(invoice.adjustment) - number(invoice[initialKey]) - invoice.directCredit);
    const available = number(wholeCreditsByParty[partyId]);
    const allocation = Math.min(open, available);
    invoice.allocatedCredit = allocation;
    wholeCreditsByParty[partyId] = available - allocation;
  });

  const advances = Object.entries(wholeCreditsByParty).reduce((sum, [, amount]) => sum + Math.max(0, number(amount)), 0);
  return {
    rows: reconciled.map((invoice) => ({
      ...invoice,
      paid: number(invoice[initialKey]) + invoice.directCredit + invoice.allocatedCredit,
      balance: Math.max(0, number(invoice.total_amount) - number(invoice.adjustment) - number(invoice[initialKey]) - invoice.directCredit - invoice.allocatedCredit),
    })),
    advances,
  };
}
