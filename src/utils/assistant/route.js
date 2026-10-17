/**
 * Decides whether a sentence is worth sending to the record parser.
 *
 * The parser is the authority on "is this a question or a money event", but a
 * sentence with no number and a question word in it is knowably a question, and
 * answering it locally is both instant and free. Everything else goes to the
 * model, which can still reply kind="question" — the panel then falls back to the
 * local engine for the numbers.
 */

const QUESTION_WORDS =
  /\b(how|what|who|whose|when|which|why|where|much|many|show|list|tell me|do i|did i|am i|is my|are my|should i|can i)\b/i;

const hasNumber = (text) => /\d/.test(text);

/**
 * "I want to record an expense" said out loud as an intention, not as a record.
 *
 * It carries no number — a real record always does, which is why the number
 * check above still wins — so there is nothing for the model to extract. Sent
 * anyway it replies kind="question", and the panel falls back to the local
 * engine for what is now the same answer every time: where to tap, and that the
 * one-sentence form works too.
 *
 * Shared with the engine's classifyIntent so the route and the classifier can
 * never disagree about what an intent to record looks like.
 */
export const RECORDING_INTENT_RE = new RegExp(
  '^(?:i\\s+(?:would\\s+like\\s+to|d\\s+like\\s+to|want\\s+to|need\\s+to|wish\\s+to|plan\\s+to|am\\s+(?:going|about|trying)\\s+to|trying\\s+to|should|must|get\\s+to|gonna|wanna)|let\\s+me|help\\s+me)?\\s*' +
    '(?:record|add(?!\\s+up)|enter|log|store|track|register|put\\s+in|note\\s+down|create)\\s+' +
    '(?:(?:an?|my|some|the|another|first|more)\\s+)?' +
    '(?:expenses?|sales?|income|payments?|purchases?|transactions?|spends?|costs?|items?|stock|clients?|customers?|invoices?|records?)\\b',
  'i'
);

export const shouldParseSentence = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return false;
  if (hasNumber(text)) return true;
  if (RECORDING_INTENT_RE.test(text)) return false;
  return !QUESTION_WORDS.test(text);
};
