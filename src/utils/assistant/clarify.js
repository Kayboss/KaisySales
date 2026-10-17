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
