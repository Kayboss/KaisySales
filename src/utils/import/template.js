import { getEntity } from './schema.js';

const encodeCell = (value) => {
  const text = String(value == null ? '' : value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const EXAMPLES = {
  inventory: { name: 'Wheat flour, 1kg', unit: 'bag', category: 'General' },
  sales: {
    item: 'Wheat flour, 1kg',
    quantity: '5',
    unitPrice: '1000.00',
    amount: 'GHS 5000.00',
    paymentMethod: 'Cash',
    category: 'General',
    date: '2026-11-01',
  },
  expenses: {
    title: 'Market rent',
    category: 'Rent',
    vendor: 'Landlord',
    amount: 'GHS 800.00',
    date: '2026-11-01',
  },
  service_income: {
    clientName: 'Acme Ltd',
    platformTag: 'Bank transfer',
    milestoneLabel: 'Final payment',
    amount: '2500.00',
    platformFee: '0.00',
    paymentDate: '2026-11-01',
    category: 'Retainer',
  },
  recurring_income: {
    clientName: 'Acme Ltd',
    amount: '500.00',
    frequency: 'monthly',
    nextDueDate: '2026-12-01',
    category: 'Retainer',
  },
  customers: {
    name: 'Acme Ltd',
    email: 'billing@acme.example',
    phone: '+233 00 000 0000',
    location: 'Accra',
    company: 'Acme Limited',
  },
};

const defaultExample = (field) => {
  if (field.type === 'decimal' || field.type === 'number') return '1000.00';
  if (field.type === 'moneyText') return 'GHS 1000.00';
  if (field.type === 'integer') return '5';
  if (field.type === 'boolean') return 'yes';
  if (field.type === 'enum') return (field.values && field.values[0]) || field.key;
  if (field.type === 'date') return '2026-11-01';
  return field.label;
};

export const buildTemplate = (entityKey) => {
  const entity = getEntity(entityKey);
  if (!entity) return null;

  const fields = entity.fields.filter((field) => field.writable);
  const examples = EXAMPLES[entityKey] || {};

  const headers = fields.map((field) => field.label);
  const exampleRow = fields.map((field) => examples[field.key] ?? defaultExample(field));

  const csv = `${headers.map(encodeCell).join(',')}\n${exampleRow.map(encodeCell).join(',')}\n`;
  return { filename: `kaisysales-${entity.key}-template.csv`, csv };
};