import { formatCurrency, parseAmount } from '../currency.js';

/**
 * KaisySales assistant engine.
 *
 * Deterministic on purpose: no model, no network calls, no data ever leaves the
 * device. The engine is given a prepared `statsByScope` object (computed by the
 * UI layer with the same functions the reports use) and only ever words the
 * numbers it was handed — it cannot invent a figure.
 *
 * The module is import-light (only the shared pure currency helpers) so it can
 * be unit tested in plain Node.
 */

const DEFAULT_SCOPE = 'this month';

export const SCOPE_PATTERNS = [
  { key: 'today', re: /\btoday\b/ },
  { key: 'this week', re: /\bthis week\b|\bthis weeks\b|last 7 days/ },
  { key: 'this month', re: /\bthis month\b|\bthis months\b/ },
  { key: 'last month', re: /\blast month\b/ },
  { key: 'this year', re: /\bthis year\b|\bthis years\b/ },
  { key: 'all time', re: /\ball time\b|\btotal\b|\bever\b|\bso far\b|in total/ },
];

export const SCOPE_LABELS = {
  today: 'today',
  'this week': 'this week',
  'this month': 'this month',
  'last month': 'last month',
  'this year': 'this year',
  'all time': 'all time',
};

export const normalizeQuestion = (text) =>
  String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const HOWTO_TOPICS = [
  {
    key: 'sales',
    re: /\bsale\b|\bsell\b|record.*sale|selling/,
    text:
      "In Sales, tap 'Record sale', pick the item, set the quantity and price, then save.\n\u2022 Selling an item that matches an inventory name also moves that stock automatically.\n\u2022 Leave the total empty and it is worked out from quantity \u00d7 unit price.",
  },
  {
    key: 'inventory',
    re: /\binventor|\bstock\b|\bitem\b|\bproduct\b|supplier/,
    text:
      'In Inventory, add each product with its name, unit, cost and selling price, and a low-stock level.\n\u2022 Sales link to items by name, spelled the same way.\n\u2022 Import your existing list from Settings \u2192 Import Data.',
  },
  {
    key: 'expenses',
    re: /\bexpense|\bspend|\bcost\b|\bpay(out|ment)?\b/,
    text:
      "In the Expenses screen, tap 'Add expense', fill in the amount and category, then save.\n\u2022 Amounts are stored as text, so any format (GHS 800.00 or 800) reads back correctly.\n\u2022 Set 'Is an asset' for things that last more than a year.",
  },
  {
    key: 'customers',
    re: /\bcustomer|\bclient\b|\bcontact\b/,
    text:
      'On the Customers page, tap \u2018Add customer\u2019.\n\u2022 Only the name is needed \u2014 email, phone and company are optional and can be filled in later.',
  },
  {
    key: 'income',
    re: /\bincome\b|\bpay(ment)?\b|\breceiv|\bmoney (\bin|coming)/,
    text:
      'In Income Tracking, add one-off payments on the Income tab, or ongoing amounts under Recurring.\n\u2022 Net income is worked out as amount minus any platform fee.',
  },
  {
    key: 'invoices',
    re: /\binvoice\b|\bbill\b|\bbe paid\b|\bmark.*paid/,
    text:
      'Use Invoices to bill a client, then mark it Paid when the money arrives.\n\u2022 Payments link back to the invoice automatically, so balances stay right.',
  },
  {
    key: 'import',
    re: /\b(import|upload|csv|spreadsheet|migrate)\b|bring (my|in|over).{0,20}(data|records|csv|numbers)/,
    text:
      'You can bring data in from a CSV without retyping it. Open Settings \u2192 Import Data, choose what you\u2019re importing, drop the file and map the columns.\n\u2022 Nothing saves until you review the rows I flag for a second look.',
  },
];

const fallbackHowto =
  'Pick what you want help with and I will walk you through it.\n\u2022 Setting up inventory, recording a sale, tracking expenses, adding customers or sending invoices.';

const unknownSuggestionsFor = (mode) =>
  mode === 'services'
    ? [
        'Who owes me money?',
        'How much did I make this month?',
        'How do I add a client?',
        'How do I track income?',
      ]
    : [
        'How much did I make this month?',
        "What's my stock looking like?",
        'How do I record my first sale?',
        'What should I know about my business today?',
      ];

const money = (value, currency) => formatCurrency(parseAmount(value), currency);
const countText = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const HORIZON_PATTERNS = [
  { re: /next (\d+) months?|(\d+) months? (ahead|from now)|(\d+) months? out/, months: (n) => n },
  { re: /next (\d+) years?|(\d+) years? (ahead|from now)/, months: (n) => n * 12 },
  { re: /\bnext month\b|\ba month (ahead|from now)\b/, months: () => 1 },
  { re: /\b(quarter|quarters? ahead)\b/, months: () => 3 },
  { re: /six months|half a year|next half/, months: () => 6 },
  { re: /\bnext year\b/, months: () => 12 },
];

const DEFAULT_HORIZON = 6;

const parseHorizon = (raw) => {
  const text = normalizeQuestion(raw);
  for (const { re, months } of HORIZON_PATTERNS) {
    const match = text.match(re);
    if (!match) continue;
    const captured = match.slice(1).find((group) => group !== undefined);
    return captured ? months(Number(captured)) : months();
  }
  return DEFAULT_HORIZON;
};

const scopeStatsOf = (context, scope) => {
  const byScope = (context && context.statsByScope) || {};
  return byScope[scope] || byScope[DEFAULT_SCOPE] || {};
};

const pick = (stats, context, key) => {
  if (stats && stats[key] !== undefined) return stats[key];
  return (context && context.stats && context.stats[key]) || 0;
};

const intentAnswerers = {
  greeting: () =>
    `Hi! I\u2019m your local assistant. I answer from your own records and nothing leaves this device. Ask me things like \u201chow much did I make this month?\u201d`,

  thanks: () => 'You\u2019re welcome. Ask me about your sales, expenses, stock or who owes you.',

  help: () =>
    `I can look at your records and answer questions like:\n\u2022 How much did I make this month?\n\u2022 What am I spending on?\n\u2022 Is anything running low?\n\u2022 Who owes me money?\nAsk away, or tap one of the suggestions.`,

  overview: (meta) => {
    const { scope, scopeStats, currency, mode } = meta;
    const phrase = SCOPE_LABELS[scope] || SCOPE_LABELS[DEFAULT_SCOPE];
    const income = pick(scopeStats, meta.context, 'incomeTotal');
    const expenses = pick(scopeStats, meta.context, 'expenseTotal');
    const incomeCount = pick(scopeStats, meta.context, 'incomeCount');
    const net = pick(scopeStats, meta.context, 'profit') ?? (income || 0) - (expenses || 0);

    const salesLine =
      mode === 'services'
        ? `You took in ${money(income, currency)} across ${countText(incomeCount, 'payment')} ${phrase}.`
        : `You brought in ${money(income, currency)} across ${countText(incomeCount, 'sale')} ${phrase}.`;
    const expenseLine = ` You spent ${money(expenses, currency)}.`;
    const netLine = ` Net for the period is ${money(net, currency)}.`;
    const stockLine = meta.mode === 'retail' ? lowStockSentence(scopeStats) : '';

    const extra = [];
    if (mode === 'services') {
      const outstanding = pick(scopeStats, meta.context, 'outstandingTotal');
      const recurring = pick(scopeStats, meta.context, 'recurringCount');
      if (outstanding > 0) extra.push(` \u00a0\u2022 ${money(outstanding, currency)} is still owed to you.`);
      if (recurring > 0) extra.push(` You have ${countText(recurring, 'recurring item')} to expect.`);
    }
    return `${salesLine}${expenseLine}${netLine}${stockLine}${extra.join('')}`;
  },

  income: (meta) => {
    const { scope, scopeStats, currency, mode } = meta;
    const phrase = SCOPE_LABELS[scope] || SCOPE_LABELS[DEFAULT_SCOPE];
    const total = pick(scopeStats, meta.context, 'incomeTotal');
    const count = pick(scopeStats, meta.context, 'incomeCount');

    if (!total && !count) {
      return `You haven\u2019t recorded any income ${phrase} yet. Once you add ${mode === 'retail' ? 'a sale' : 'a payment'}, ask me again and I\u2019ll break it down.`;
    }
    const per = count > 0 ? ` That works out to about ${money(total / count, currency)} each.` : '';
    const label = mode === 'retail' ? countText(count, 'sale') : countText(count, 'payment');
    return `You took in ${money(total, currency)} from ${label} ${phrase}.${per}`;
  },

  expenses: (meta) => {
    const { scope, scopeStats, currency } = meta;
    const phrase = SCOPE_LABELS[scope] || SCOPE_LABELS[DEFAULT_SCOPE];
    const total = pick(scopeStats, meta.context, 'expenseTotal');
    const count = pick(scopeStats, meta.context, 'expenseCount');
    const top = scopeStats.expenseTopCategory;

    if (!total && !count) {
      return `You haven\u2019t recorded any expenses ${phrase} yet.`;
    }
    const topLine = top && top.name ? ` The largest single category was ${top.name} at ${money(top.total, currency)}.` : '';
    return `You spent ${money(total, currency)} across ${countText(count, 'expense')} ${phrase}.${topLine}`;
  },

  profit: (meta) => {
    const { scope, scopeStats, currency } = meta;
    const phrase = SCOPE_LABELS[scope] || SCOPE_LABELS[DEFAULT_SCOPE];
    const income = pick(scopeStats, meta.context, 'incomeTotal');
    const expenses = pick(scopeStats, meta.context, 'expenseTotal');
    const net = pick(scopeStats, meta.context, 'profit') ?? (income || 0) - (expenses || 0);

    if (net >= 0) {
      return `After ${money(expenses, currency)} of expenses against ${money(income, currency)} of income, you\u2019re ${money(net, currency)} to the good ${phrase}.`;
    }
    return `Expenses ran to ${money(expenses, currency)} against ${money(income, currency)} of income \u2014 you\u2019re running ${money(-net, currency)} in the red ${phrase}.`;
  },

  stock: (meta) => {
    const { scopeStats } = meta;
    const inventoryCount = pick(scopeStats, meta.context, 'inventoryCount');
    if (!inventoryCount) {
      return 'You don\u2019t have any inventory yet. Add items, and I\u2019ll warn you whenever a name is running low.';
    }
    const low = lowStockSentence(scopeStats);
    if (low) return low;
    return `Nothing is running low right now \u2014 you have ${countText(inventoryCount, 'item')} on your shelf.`;
  },

  customers: (meta) => {
    const { scopeStats, currency } = meta;
    const customerCount = pick(scopeStats, meta.context, 'customerCount');
    if (!customerCount) {
      return 'You don\u2019t have any customers on file yet. Open the Customers page and add your first one.';
    }
    const top = scopeStats.topCustomer;
    const topLine =
      top && top.name
        ? ` Your biggest client is ${top.name} at ${money(top.total, currency)}.`
        : '';
    return `You have ${countText(customerCount, 'customer')} on file.${topLine}`;
  },

  outstanding: (meta) => {
    const { scopeStats, currency } = meta;
    const total = pick(scopeStats, meta.context, 'outstandingTotal');
    if (!total) {
      return 'Nothing is outstanding \u2014 every invoice is settled.';
    }
    const rows = scopeStats.outstandingByCustomer || [];
    const top = rows.slice(0, 3).map((row) => `${row.name} still owes ${money(row.total, currency)}`);
    const more = rows.length > 3 ? `\n\u2022 and ${rows.length - 3} more` : '';
    return `${money(total, currency)} is owed to you in total.\n\u2022 ${top.join('\n\u2022 ')}${more}`;
  },

  overdue: (meta) => {
    const { scopeStats, currency } = meta;
    const count = pick(scopeStats, meta.context, 'overdueCount');
    if (!count) {
      return 'Nothing is overdue right now.';
    }
    const total = pick(scopeStats, meta.context, 'overdueTotal');
    const names = (scopeStats.overdueCustomers || []).slice(0, 3).join(', ');
    const nameLine = names ? ` involving ${names}${(scopeStats.overdueCustomers || []).length > 3 ? ' and more' : ''}.` : '.';
    return `${countText(count, 'invoice')} overdue, totalling ${money(total, currency)}${nameLine}`;
  },

  recurring: (meta) => {
    const { scopeStats, currency } = meta;
    const count = pick(scopeStats, meta.context, 'recurringCount');
    if (!count) {
      return 'You have no recurring income yet \u2014 set one up and it becomes money you can expect on schedule.';
    }
    const next = scopeStats.nextRecurring;
    const nextLine =
      next && next.clientName
        ? ` Next up is ${next.clientName} for ${money(next.amount, currency)}${next.nextDueDate ? ` on ${next.nextDueDate}` : ''}.`
        : '';
    return `You have ${countText(count, 'recurring income item')}.${nextLine}`;
  },

  expenseTop: (meta) => {
    const { scopeStats, currency } = meta;
    const top = scopeStats.expenseTopCategory;
    if (!top || !top.name) {
      return 'You don\u2019t have enough expenses yet to pick a top category.';
    }
    return `Most of your spending went on ${top.name} (${money(top.total, currency)}).`;
  },

  incomeTop: (meta) => {
    const { scopeStats, currency } = meta;
    const top = scopeStats.incomeTopCategory;
    if (!top || !top.name) {
      return 'You don\u2019t have enough income to rank sources yet.';
    }
    return `Most of your income came from ${top.name} (${money(top.total, currency)}).`;
  },

  howto: (meta) => {
    const text = normalizeQuestion(meta.matchedText || '');
    const topic = HOWTO_TOPICS.find((candidate) => candidate.re.test(text));
    return topic ? topic.text : fallbackHowto;
  },

  dataImport: () =>
    "Yes — you don\u2019t have to type everything in. Open Settings \u2192 Import Data, pick what you\u2019re bringing in (inventory, sales, expenses, one-off income, recurring income or customers), upload the CSV and map the columns.\n\u2022 Nothing saves until you review the rows I flag for a second look.",

  projection: (meta) => {
    const { currency, mode } = meta;
    const projectionData = (meta.context && meta.context.projection) || {};
    const average = Number(projectionData.monthlyAverageIncome) || 0;
    const activeMonths = Number(projectionData.activeMonths) || 0;
    const horizon = parseHorizon(meta.matchedText);

    if (average <= 0) {
      const noun = mode === 'services' ? 'payments' : 'sales';
      return (
        `You haven\u2019t recorded any ${noun} this year yet, so there\u2019s nothing to project from. ` +
        `Ask me again once money starts coming in and I\u2019ll put a number on it.`
      );
    }

    const basis =
      activeMonths > 1
        ? `Based on the ${activeMonths} months of income you\u2019ve recorded this year, you average about ${money(average, currency)} a month`
        : `You\u2019re at about ${money(average, currency)} a month so far this year`;
    const monthsWord = horizon === 1 ? 'month' : 'months';
    return (
      `${basis}. As a rough guess, the next ${horizon} ${monthsWord} could bring in around ` +
      `${money(average * horizon, currency)}. That\u2019s a straight average of recent months, not a promise.`
    );
  },
};

const lowStockSentence = (scopeStats) => {
  const items = (scopeStats.lowStock || []).filter((item) => item && item.name);
  if (items.length === 0) return '';
  const names = items.slice(0, 5).map((item) => {
    const hint = item.minStock ? ` (min ${item.minStock})` : '';
    return `${item.name} — ${item.stock ?? 0} left${hint}`;
  });
  const more = items.length > 5 ? ` and ${items.length - 5} more` : '';
  return `\n\u2022 Running low: ${names.join(', ')}${more}.`;
};

const INTENT_CHECKERS = [
  { key: 'greeting', re: /^(hi|hello|hey|yo|howdy)(\s|$)|good (morning|afternoon|evening)/ },
  { key: 'thanks', re: /\b(thankyou|thanks|thank you|thx|appreciate it)\b/ },
  {
    key: 'dataImport',
    re: /\b(import(ing|ed|s)?|upload(ing|ed|s)?|migrate|migration)\b|(data|csv|spreadsheet|records|file).{0,20}(import|upload|transfer)|(import|upload|transfer).{0,20}(data|csv|spreadsheet|file|records)/,
  },
  { key: 'help', re: /\bhelp\b|what can you do|how (do|does) (you|this) work|\bcommands?\b|what do you do/ },
  {
    key: 'overview',
    re: /how (is|are|'s).{0,30}(business|doing|things|i doing)|what should i know|summary|overview|status report|how am i doing/,
  },
  { key: 'howto', re: /how (do|to|can|should) i|help me (set up|with|understand|figure)|explain|walk me through|tell me how/ },
  { key: 'overdue', re: /\boverdue\b|past due|late invoices?|late payments?/ },
  { key: 'outstanding', re: /\b(owe|owes|owed|owing)\b|outstanding|unpaid|still owed|in debt|arrears|yet to pay|to be paid/ },
  {
    key: 'stock',
    re: /\bstock\b|inventory|reorder|restock|running low|low (stock|on|level)|left in stock|on hand|shelf/,
  },
  {
    key: 'customers',
    re: /\bcustomers?\b|\bclients?\b|top (customer|client|payer)|who pays me the most|best customer/,
  },
  {
    key: 'recurring',
    re: /\brecurring\b|monthly income|quarterly income|monthly payments?|subscriptions?|retainer|steady income|every month|expected income/,
  },
  {
    key: 'projection',
    re: /\b(project(ions?|ed)?|forecast|predict(ions?|ed)?|outlook)\b|expect(ed)? (income|sales|revenue|payments?)|(next|coming|following) \d+ (months?|years?|quarters?)|(next|coming) few months/,
  },
  {
    key: 'expenseTop',
    re: /what do i spend the most on|(most|top|largest|biggest).{0,15}(expense|category|spending|money goes)|where does my money go/,
  },
  {
    key: 'incomeTop',
    re: /(income|money|earnings).{0,25}(come from|by (category|source|client)|from what)|where does my (income|money) come from|(top|biggest|main).{0,12}(income|source|category)/,
  },
  {
    key: 'profit',
    re: /\bprofits?\b|\blos(e|es|ing|t)\b|net (income|profit)|after (expenses?|costs)|margin|in the red|breaking even/,
  },
  {
    key: 'income',
    re: /\b(income|earnings|revenue|made|make|makes|making|earn(s|ed|ing)?|receiv(e|ed|ing)?|collect(ed|ing)?|gross|brought? in|took in|sales total)\b/,
  },
  {
    key: 'expenses',
    re: /\b(expenses?|spend|spent|spending|pay(ed)? out|outgoings?|outflow|costs|what did i pay)\b/,
  },
];

export const classifyIntent = (raw) => {
  const text = normalizeQuestion(raw);

  let scope = DEFAULT_SCOPE;
  for (const pattern of SCOPE_PATTERNS) {
    if (pattern.re.test(text)) {
      scope = pattern.key;
      break;
    }
  }

  for (const checker of INTENT_CHECKERS) {
    if (checker.re.test(text)) {
      return { intent: checker.key, scope, raw: String(raw).trim() };
    }
  }

  return { intent: 'unknown', scope, raw: String(raw).trim() };
};

/**
 * Turns a question into an answer using ONLY the stats it was handed.
 *
 * @param {string} question
 * @param {{
 *   mode: 'retail'|'services',
 *   currency?: string,
 *   businessName?: string,
 *   statsByScope: Record<string, object>,
 * }} context
 * @returns {{ intent: string, scope: string, text: string }}
 */
export const answer = (question, context = {}) => {
  const classification = classifyIntent(question);
  const { intent, scope } = classification;
  const contextSet = context || {};
  const currency = contextSet.currency || 'GHS';
  const mode = contextSet.mode === 'services' ? 'services' : 'retail';

  if (intent === 'unknown') {
    return {
      intent,
      scope,
      text: `I couldn\u2019t quite work that one out. I can answer from your own records \u2014 try:\n\u2022 ${unknownSuggestionsFor(mode).join('\n\u2022 ')}`,
    };
  }

  const scopeStats = scopeStatsOf(contextSet, scope);
  const meta = {
    intent,
    scope,
    scopeStats,
    currency,
    mode,
    context: contextSet,
    matchedText: question,
  };

  const answerer = intentAnswerers[intent];
  const text = answerer ? answerer(meta) : `I can\u2019t help with that yet.`;

  return { intent, scope, text };
};

export const suggestedQuestions = (mode) => unknownSuggestionsFor(mode === 'services' ? 'services' : 'retail');