/**
 * The shape of a sentence that states an intention to record something — "I want
 * to record an expense", "help me log a sale" — rather than a question about the
 * numbers.
 *
 * The engine's classifier has to recognise these explicitly. Left as ordinary
 * sentences they fall through to the stats intents and get answered with "you
 * haven't recorded any expenses this month", which answers a question nobody
 * asked: the person wants to know where to tap.
 */
export const RECORDING_INTENT_RE = new RegExp(
  '^(?:i\\s+(?:would\\s+like\\s+to|d\\s+like\\s+to|want\\s+to|need\\s+to|wish\\s+to|plan\\s+to|am\\s+(?:going|about|trying)\\s+to|trying\\s+to|should|must|get\\s+to|gonna|wanna)|let\\s+me|help\\s+me)?\\s*' +
    '(?:record|add(?!\\s+up)|enter|log|store|track|register|put\\s+in|note\\s+down|create)\\s+' +
    '(?:(?:an?|my|some|the|another|first|more)\\s+)?' +
    '(?:expenses?|sales?|income|payments?|purchases?|transactions?|spends?|costs?|items?|stock|clients?|customers?|invoices?|records?)\\b',
  'i'
);
