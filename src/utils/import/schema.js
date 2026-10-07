export const MODE_RETAIL = 'retail';
export const MODE_SERVICES = 'services';

const F = (key, label, type, options = {}) => ({
  key,
  label,
  type,
  required: options.required === true,
  aliases: options.aliases || [],
  values: options.values,
  valueAliases: options.valueAliases,
  writable: options.writable !== false,
});

const ENTITIES = {
  inventory: {
    key: 'inventory',
    label: 'Inventory',
    modes: [MODE_RETAIL],
    table: 'inventory',
    matchedBy: 'name',
    emptyState: 'No inventory yet.',
    hint: 'Each row becomes an item you can sell. Stock levels move when you record sales against the item name.',
    fields: [
      F('name', 'Item name', 'text', {
        required: true,
        aliases: ['item', 'product', 'productname', 'itemname', 'goods', 'stockname', 'description', 'name'],
      }),
      F('stock', 'In stock', 'integer', {
        aliases: ['qty', 'quantity', 'units', 'unitssold', 'onhand', 'available', 'stocklevel', 'count', 'balance', 'stockonhand', 'instock', 'unitsinstock'],
      }),
      F('price', 'Selling price', 'moneyText', {
        aliases: ['price', 'sellingprice', 'retailprice', 'saleprice', 'priceeach', 'rrp', 'priceghs', 'unitprice'],
      }),
      F('costPrice', 'Cost price', 'moneyText', {
        aliases: ['cost', 'costprice', 'buyprice', 'purchaseprice', 'wholesaleprice', 'unitcost', 'landedcost'],
      }),
      F('category', 'Category', 'text', {
        aliases: ['cat', 'type', 'group', 'department', 'class', 'producttype'],
      }),
      F('unit', 'Unit', 'text', {
        aliases: ['uom', 'unitofmeasure', 'measure', 'unittype', 'pack'],
      }),
      F('minStock', 'Min stock', 'integer', {
        aliases: ['minimumstock', 'reorderlevel', 'minqty', 'minquantity', 'safetystock', 'reorderpoint', 'lowstocklevel'],
      }),
    ],
  },

  sales: {
    key: 'sales',
    label: 'Sales',
    modes: [MODE_RETAIL],
    table: 'sales',
    matchedBy: 'item',
    emptyState: 'No sales yet.',
    hint: 'Stock only moves when the item name matches something in inventory exactly as written.',
    fields: [
      F('item', 'Item sold', 'text', {
        required: true,
        aliases: ['product', 'productname', 'itemname', 'goods', 'description', 'what', 'item', 'itemsold'],
      }),
      F('quantity', 'Quantity', 'integer', {
        aliases: ['qty', 'units', 'count', 'numbersold', 'no', 'pieces', 'amountsold'],
      }),
      F('unitPrice', 'Unit price', 'number', {
        aliases: ['price', 'priceeach', 'rate', 'priceperunit', 'priceghs'],
      }),
      F('amount', 'Total', 'moneyText', {
        aliases: ['total', 'totalamount', 'saleamount', 'revenue', 'value', 'salesamount', 'gross', 'money'],
      }),
      F('category', 'Category', 'text', {
        aliases: ['cat', 'type', 'group', 'department', 'producttype'],
      }),
      F('paymentMethod', 'Payment method', 'text', {
        aliases: ['payment', 'method', 'paymenttype', 'tender', 'howpaid', 'modeofpayment', 'paidby'],
      }),
      F('date', 'Date', 'date', {
        aliases: ['saledate', 'day', 'when', 'purchasedate', 'transactiondate', 'dated', 'saleday'],
      }),
      F('time', 'Time', 'text', {
        aliases: ['saletime', 'timeofday', 'hour', 'timestamp'],
      }),
      F('cost', 'Cost price', 'number', {
        aliases: ['costprice', 'unitcost', 'cogs', 'buyprice', 'purchaseprice'],
      }),
    ],
  },

  expenses: {
    key: 'expenses',
    label: 'Expenses',
    modes: [MODE_RETAIL, MODE_SERVICES],
    table: 'expenses',
    matchedBy: 'title',
    emptyState: 'No expenses yet.',
    hint: 'Amounts are stored as text with a currency prefix, so any format you paste in will read back correctly.',
    fields: [
      F('title', 'Description', 'text', {
        required: true,
        aliases: ['description', 'expense', 'name', 'what', 'detail', 'item', 'narrative', 'particulars'],
      }),
      F('amount', 'Amount', 'moneyText', {
        aliases: ['total', 'cost', 'amountspent', 'value', 'price', 'expenseamount', 'spend', 'paid'],
      }),
      F('category', 'Category', 'text', {
        aliases: ['cat', 'type', 'expcategory', 'group', 'classification', 'nature'],
      }),
      F('date', 'Date', 'date', {
        aliases: ['expensedate', 'day', 'when', 'purchasedate', 'transactiondate', 'dated'],
      }),
      F('clientName', 'Client', 'text', {
        aliases: ['client', 'customer', 'forwhom', 'customername', 'who'],
      }),
      F('vendor', 'Vendor', 'text', {
        aliases: ['supplier', 'paidto', 'merchant', 'payee', 'store', 'shop', 'vendorname'],
      }),
      F('subcategory', 'Subcategory', 'text', {
        aliases: ['subcat', 'subcategoryname', 'subtype', 'subgroup'],
      }),
      F('renewalDate', 'Renewal date', 'date', {
        aliases: ['renewson', 'renewal', 'nextrenewal', 'renewdate', 'expiry'],
      }),
      F('isAsset', 'Is an asset', 'boolean', {
        aliases: ['asset', 'capital', 'capitalpurchase', 'isasset', 'fixedasset', 'isanasset'],
      }),
      F('assetLifetimeYears', 'Lifetime (years)', 'integer', {
        aliases: ['lifetime', 'usefullife', 'lifespan', 'years', 'amortisationyears', 'lifetimeyears'],
      }),
      F('transactionFee', 'Transaction fee', 'number', {
        aliases: ['fee', 'fees', 'transactioncost', 'charges', 'charge', 'levy'],
      }),
    ],
  },

  service_income: {
    key: 'service_income',
    label: 'Income (one-off)',
    modes: [MODE_SERVICES],
    table: 'service_income',
    matchedBy: 'clientName',
    emptyState: 'No income entries yet.',
    hint: 'Net income is worked out as amount minus platform fee when you do not give one directly.',
    fields: [
      F('amount', 'Amount', 'decimal', {
        required: true,
        aliases: ['total', 'price', 'value', 'payment', 'gross', 'sum', 'invoiced', 'paid', 'earnings'],
      }),
      F('clientName', 'Client', 'text', {
        aliases: ['client', 'customer', 'name', 'who', 'account', 'company', 'customername'],
      }),
      F('platformFee', 'Platform fee', 'number', {
        aliases: ['fee', 'commission', 'platformfee', 'cut', 'servicecharge', 'deduction', 'charge'],
      }),
      F('netAmount', 'Net amount', 'number', {
        aliases: ['net', 'takehome', 'payout', 'afterfees', 'netamount', 'netpay', 'received'],
      }),
      F('platformTag', 'Source', 'text', {
        aliases: ['platform', 'source', 'channel', 'tag', 'app', 'marketplace', 'via'],
      }),
      F('milestoneLabel', 'Milestone', 'text', {
        aliases: ['milestone', 'stage', 'phase', 'paymentfor', 'for', 'job'],
      }),
      F('paymentDate', 'Payment date', 'date', {
        aliases: ['date', 'paidon', 'when', 'paymentdate', 'receivedon', 'dated'],
      }),
      F('category', 'Category', 'text', {
        aliases: ['type', 'incomecategory', 'servicetype', 'category'],
      }),
      F('notes', 'Notes', 'text', {
        aliases: ['note', 'comments', 'comment', 'remark', 'remarks', 'details'],
      }),
    ],
  },

  recurring_income: {
    key: 'recurring_income',
    label: 'Recurring income',
    modes: [MODE_SERVICES],
    table: 'recurring_income',
    matchedBy: 'clientName',
    emptyState: 'No recurring income.',
    hint: 'How often must be one of monthly, quarterly or yearly — anything else is flagged rather than guessed.',
    fields: [
      F('clientName', 'Client', 'text', {
        required: true,
        aliases: ['client', 'customer', 'name', 'who', 'account', 'company', 'customername'],
      }),
      F('amount', 'Amount', 'decimal', {
        required: true,
        aliases: ['total', 'fee', 'price', 'value', 'charge', 'rate', 'monthlyfee', 'sum', 'retainer'],
      }),
      F('frequency', 'How often', 'enum', {
        values: ['monthly', 'quarterly', 'yearly'],
        valueAliases: {
          monthly: ['month', 'monthly', '1 month', 'one month', 'per month', 'every month', 'm'],
          quarterly: ['quarter', 'quarterly', '3 months', 'three months', 'per quarter', 'every quarter', 'q'],
          yearly: ['year', 'yearly', 'annual', 'annually', '12 months', 'per year', 'every year', 'per annum', 'y'],
        },
        aliases: ['interval', 'period', 'howoften', 'cadence', 'recurrence', 'frequency', 'cycle', 'terms'],
      }),
      F('nextDueDate', 'Next due', 'date', {
        aliases: ['due', 'nextpayment', 'duedate', 'nextdue', 'startdate', 'firstpayment', 'renewal'],
      }),
      F('category', 'Category', 'text', {
        aliases: ['type', 'incometype', 'servicetype', 'category'],
      }),
      F('active', 'Active', 'boolean', {
        aliases: ['enabled', 'on', 'live', 'running', 'status', 'inuse'],
      }),
    ],
  },

  customers: {
    key: 'customers',
    label: 'Customers',
    modes: [MODE_SERVICES],
    table: 'customers',
    matchedBy: 'name',
    emptyState: 'No customers found.',
    hint: 'Only the name is needed — everything else can be filled in later.',
    fields: [
      F('name', 'Name', 'text', {
        required: true,
        aliases: ['client', 'customer', 'fullname', 'contact', 'who', 'businessname', 'entity'],
      }),
      F('email', 'Email', 'text', {
        aliases: ['emailaddress', 'mail', 'eaddress', 'contactemail'],
      }),
      F('phone', 'Phone', 'text', {
        aliases: ['tel', 'telephone', 'mobile', 'phonenumber', 'contactnumber', 'number', 'whatsapp'],
      }),
      F('location', 'Location', 'text', {
        aliases: ['address', 'city', 'place', 'region', 'area', 'town', 'district'],
      }),
      F('company', 'Company', 'text', {
        aliases: ['business', 'organisation', 'organization', 'firm', 'employer', 'companyname'],
      }),
      F('notes', 'Notes', 'text', {
        aliases: ['note', 'comment', 'comments', 'remark', 'remarks', 'details'],
      }),
    ],
  },
};

const ENTITY_LIST = Object.values(ENTITIES);

export const CATEGORY_TYPE_BY_ENTITY = {
  inventory: 'inventory',
  sales: 'sales',
  expenses: 'expense',
  service_income: 'income',
  recurring_income: 'income',
  customers: null,
};

export const getEntity = (key) => ENTITIES[key] || null;

export const getEntitiesForMode = (mode) =>
  ENTITY_LIST.filter((entity) => entity.modes.includes(mode));

export const getField = (entity, key) =>
  entity.fields.find((field) => field.key === key) || null;

export const getFields = (entity) => entity.fields;

export const getRequiredFields = (entity) =>
  entity.fields.filter((field) => field.required);

export const getWritableFields = (entity) =>
  entity.fields.filter((field) => field.writable);

export const ENTITY_KEYS = Object.keys(ENTITIES);

export { ENTITIES };
