import { supabase, isSupabaseConfigured } from './supabase';
import {
  createExpense,
  createSale,
  createServiceIncome,
  createInventoryItem,
  fetchInventory,
  updateInventoryItem,
} from './api';
import { applyStockDelta } from '../utils/inventory';
import { buildInventoryItemPayload, matchInventoryItem, summariseInventoryItem } from '../utils/assistant/recordPayload';
import { fastParse } from '../utils/assistant/fastParse';

/**
 * Network side of the "talk to record" assistant.
 *
 * The Edge Function (supabase/functions/parse-record) only PARSES a sentence: it
 * returns JSON and never writes to the database. This module calls it with the
 * signed-in user's JWT, logs the attempt to assistant_parses (the weekly-review
 * training data), and — only after the user taps Save in the confirmation card —
 * writes the record through the normal authenticated API, so a saved record is
 * indistinguishable from one typed by hand.
 */

const NOT_CONFIGURED_MESSAGE =
  'Recording by sentence isn\u2019t switched on yet. You can still ask me questions about your records.';

const fnUrl = () => {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/functions/v1/parse-record` : '';
};

const accessToken = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
};

/**
 * Sends one sentence to the parser.
 *
 * `merge` turns the call into a follow-up: the model is given the fields the
 * card already holds and asked to echo them back alongside whatever the answer
 * adds, so a reply can never silently wipe the amount the first sentence gave.
 *
 * Never throws: the panel must degrade to local Q&A rather than break when the
 * model is unreachable, unconfigured or slow.
 *
 * @returns {Promise<
 *   | { ok: true, kind: 'record'|'question'|'unknown', recordType: string|null, confidence: string, fields: object, clarify: string|null }
 *   | { ok: false, reason: 'not_configured'|'unauthorized'|'model_error'|'unreachable'|'invalid', status?: number }
 * >}
 */
export const parseSentence = async ({ text, mode, currency, categories, items, merge }) => {
  // A follow-up answer is semantic work — echoing the held fields back and
  // folding a reply onto them — so it always goes to the model. A fresh
  // sentence is tried locally first: the shapes people actually say ("paid 800
  // for fuel") are free, instant, offline, and survive the model being
  // unconfigured or slow. Anything the fast path declines falls through.
  if (!merge) {
    const local = fastParse(text, { mode, categories });
    if (local) return { ok: true, ...local, source: 'local', clarify: null };
  }

  const url = fnUrl();
  if (!isSupabaseConfigured || !url) return { ok: false, reason: 'not_configured' };

  const token = await accessToken();
  if (!token) return { ok: false, reason: 'unauthorized' };

  const controller = new AbortController();
  // Deliberately longer than the function's own 20 s Gemini cap: a slow model
  // must arrive as the function's JSON error, not as an aborted fetch that the
  // panel can only report as unreachable.
  const timer = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({
        text: String(text || '').slice(0, 500),
        mode: mode === 'services' ? 'services' : 'retail',
        currency: currency || 'GHS',
        categories: Array.isArray(categories) ? categories.slice(0, 60) : [],
        items: Array.isArray(items) ? items.slice(0, 60) : [],
        // A follow-up: the record type and fields already held, so the model
        // echoes every field back and this side merges. Only ever sent when a
        // card is on screen, so the model cannot invent a new record type here.
        merge: merge?.recordType
          ? { recordType: merge.recordType, fields: merge.fields || {} }
          : null,
      }),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'unauthorized', status: response.status };
  }
  if (response.status === 503) {
    return { ok: false, reason: 'not_configured', status: response.status };
  }
  if (!response.ok) {
    return { ok: false, reason: 'model_error', status: response.status };
  }

  try {
    const parsed = await response.json();
    const kind = ['record', 'question', 'unknown'].includes(parsed?.kind) ? parsed.kind : 'unknown';
    return {
      ok: true,
      kind,
      recordType: ['expense', 'sale', 'service_income'].includes(parsed?.recordType)
        ? parsed.recordType
        : null,
      confidence: typeof parsed?.confidence === 'string' ? parsed.confidence : 'medium',
      fields: parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
      clarify: typeof parsed?.clarify === 'string' && parsed.clarify ? parsed.clarify : null,
      source: 'model',
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
};

/**
 * Records what was said and what the model made of it. This is the training
 * corpus for the weekly review, so it is written even when the user then
 * declines the card. Best effort: a logging failure must never block the user.
 *
 * @returns {Promise<string|null>} the row id, or null when it could not be saved
 */
export const logParse = async ({ input, kind, recordType, parsed, error }) => {
  if (!supabase) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return null;
    const { data, error: insertError } = await supabase
      .from('assistant_parses')
      .insert({
        user_id: uid,
        input: String(input || '').slice(0, 500),
        kind,
        record_type: recordType || null,
        parsed: parsed || {},
        error: error || null,
      })
      .select('id')
      .single();
    if (insertError) return null;
    return data?.id || null;
  } catch {
    return null;
  }
};

export const updateParse = async (id, patch) => {
  if (!supabase || !id || !patch) return;
  try {
    await supabase
      .from('assistant_parses')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    /* best effort — feedback must never break the save that just succeeded */
  }
};

/**
 * Writes a confirmed record through the normal API. A sale also moves inventory,
 * exactly like DailySales does, reusing the same stock helpers.
 */
export const saveParsedRecord = async ({ recordType, payload }) => {
  if (recordType === 'expense') {
    const record = await createExpense(payload);
    return { record };
  }

  if (recordType === 'service_income') {
    const record = await createServiceIncome(payload);
    return { record };
  }

  if (recordType !== 'sale') throw new Error('Unsupported record type');

  // A sale is only ever written against an inventory row, because that row is
  // what moves the shelf and what supplies the cost that profit is reported
  // from. The panel blocks this too, but the guard lives here as well so a stale
  // card can never write a sale that silently skips inventory.
  const inventory = await fetchInventory();
  const rawMatch = matchInventoryItem(inventory, payload.item);
  if (!rawMatch) {
    const unknown = new Error('unknown_item');
    unknown.code = 'unknown_item';
    throw unknown;
  }
  const match = summariseInventoryItem(rawMatch);

  const created = await createSale({ ...payload, cost: match.cost });

  // Keep inventory in step with the sale, permanently fail-soft: DailySales warns
  // and continues when this throws, because the sale itself is already saved.
  let shortfall = null;
  try {
    const qty = Math.max(0, Math.round(Number(payload.quantity)) || 0);
    const applied = applyStockDelta(match.stock, qty, match.minStock);
    // The raw row is spread back, not the summary: a summary is a subset, and an
    // update that omitted price and costPrice would blank them.
    await updateInventoryItem(rawMatch.id, { ...rawMatch, stock: applied.stock, status: applied.status });
    if (applied.shortfall > 0) shortfall = applied.shortfall;
  } catch (inventoryError) {
    console.warn('Assistant inventory auto-deduct skipped:', inventoryError);
  }

  return { record: created, shortfall };
};

/**
 * Creates the inventory row a sale needs before that sale can be recorded at
 * all. Mirrors what the Inventory screen writes, so the item the assistant adds
 * is indistinguishable from a hand-typed one. Cost is left at zero because
 * nobody has said what it cost — the owner can fill that in on the item later.
 */
export const addInventoryItem = async ({ name, category, stock, costPrice, minStock }) => {
  const payload = buildInventoryItemPayload({ name, category, stock, costPrice, minStock });
  return createInventoryItem(payload);
};

export { NOT_CONFIGURED_MESSAGE };
