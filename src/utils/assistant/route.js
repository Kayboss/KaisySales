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

export const shouldParseSentence = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return false;
  if (hasNumber(text)) return true;
  return !QUESTION_WORDS.test(text);
};
