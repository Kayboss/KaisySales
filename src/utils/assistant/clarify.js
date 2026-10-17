/**
 * "What's missing from this record?" — the app's own field vocabulary, in one
 * pure module so the answer is deterministic and unit tested rather than left to
 * the model to guess.
 *
 * The parser extracts what the sentence said. This decides which of the fields
 * that screen actually has are still blank, so the assistant can ask for them.
 * Only fields a person would meaningfully supply are asked about: Title and
 * Amount are required (the payload builder refuses without them), Date defaults
 * to today, and Subcategory / asset / fee deliberately keep the form defaults
 * because asking about them would be interrogating the user.
 *
 * Keys are the payload keys, so they read the same on the card, in the question
 * and in the record that finally gets written.
 */

// Payload key -> the label the screen shows for it.
const FIELD_LABELS = {
  category: 'Category',
  client_name: 'Client',
  vendor: 'Vendor',
  renewal_date: 'Renewal date',
};

// Per record type, per mode. A retail expense form has no vendor, client or
// renewal inputs, so asking a retail user for them would be asking for a field
// their own screen cannot show.
const ASKABLE = {
  expense: {
    retail: [['category']],
    services: [['category'], ['client_name'], ['vendor'], ['renewal_date']],
  },
  sale: {
    retail: [['category']],
  },
  service_income: {
    services: [['client_name'], ['category']],
  },
};

const isBlank = (value) => value === '' || value === null || value === undefined;

/**
 * @param {string} recordType 'expense' | 'sale' | 'service_income'
 * @param {object} payload the built payload, not the model's raw fields — the
 *   question should be about what will really be written
 * @param {string} mode 'retail' | 'services'
 * @returns {Array<{key: string, label: string}>} in screen order, possibly empty
 */
export const missingFields = (recordType, payload = {}, mode = 'retail') => {
  const askable = ASKABLE[recordType]?.[mode === 'services' ? 'services' : 'retail'] || [];
  return askable
    .filter(([key]) => isBlank(payload[key]))
    .map(([key]) => ({ key, label: FIELD_LABELS[key] || key }));
};

/**
 * The one question the assistant asks. Names the fields, because "anything else?"
 * gets answered with nothing.
 */
export const clarifyPrompt = (missing = []) => {
  if (!missing.length) return null;
  const names = missing.map((field) => field.label.toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  return `I noted that down. You can still add the ${list} \u2014 tell me here, or tap Save to keep it as it is.`;
};

/**
 * Folds an answer onto the fields already held. Blank values are ignored so that
 * a reply about the vendor cannot silently wipe the amount the first sentence
 * gave: the model is asked to echo every field back, and an echo arrives as ""
 * or null for the ones it has nothing to say about.
 */
export const mergeFields = (base = {}, patch = {}) => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (!isBlank(value)) merged[key] = value;
  }
  return merged;
};

/**
 * The blocked-sale question. A sale moves stock, so it can only be written
 * against an inventory row; inventing one silently would record an item with no
 * cost and no stock level for the owner to see. So the assistant says why it is
 * stopped and offers the two ways out: add the item, or name the right one.
 */
export const unknownItemPrompt = (item) => {
  const name = String(item || '').trim() || 'that item';
  return `I can\u2019t record that sale yet \u2014 \u201c${name}\u201d isn\u2019t in your inventory, so there\u2019s no stock to sell it from. Add it to inventory first, or tell me the item you actually sold.`;
};

/**
 * The one question the add-to-inventory flow asks. The count must be the level
 * *before* this sale, because the sale deducts its own quantity afterwards, so a
 * bare shelf count would be recorded as "you had this much and also sold some of
 * it" — which is why the sold units are named in the question.
 */
export const inventoryStockPrompt = (item, quantity) => {
  const name = String(item || '').trim() || 'it';
  const sold = Math.max(0, Math.round(Number(quantity)) || 0);
  const note = sold > 0 ? ` Include the ${sold} you just sold.` : '';
  return `How many ${name} do you have in stock right now?${note}`;
};

/**
 * Reads a reply to the stock question. Deliberately strict — a count, optionally
 * with a unit word, and nothing else — so that "40 for the cement" is not read as
 * a stock level of 40, and any other reply falls through to the normal flow.
 */
export const parseStockAnswer = (text) => {
  const match = /^\s*(\d{1,7})\s*(?:units?|pieces?|pcs|items?|in stock)?\s*\.?$/i.exec(String(text || ''));
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
};
