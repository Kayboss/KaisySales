import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Send, X, Sparkles, MessageCircle } from 'lucide-react';
import { answer, suggestedQuestions } from '../../utils/assistant/engine';
import { shouldParseSentence } from '../../utils/assistant/route';
import { buildRecordPayload, RECORD_TYPE_SECTIONS } from '../../utils/assistant/recordPayload';
import { buildAssistantContext } from '../../services/assistantContext';
import { parseSentence, logParse, updateParse, saveParsedRecord, NOT_CONFIGURED_MESSAGE } from '../../services/assistantRecord';
import { useAssistantStore } from '../../store/assistantStore';
import RecordCard from './RecordCard';

const Fab = styled.button`
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.onPrimary};
  font-family: ${({ theme }) => theme.fonts.main};
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: ${({ theme }) => theme.shadows.ambient};
  transition: ${({ theme }) => theme.transitions.default};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryContainer};
  }
`;

const Panel = styled.aside`
  position: fixed;
  right: 1.5rem;
  bottom: 5.25rem;
  z-index: 300;
  width: 380px;
  max-width: calc(100vw - 2rem);
  height: min(560px, calc(100dvh - 7rem));
  display: flex;
  flex-direction: column;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.ambient};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.onPrimary};
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.base};
`;

const Close = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.onPrimary};
  cursor: pointer;
  display: flex;
  padding: 0.25rem;
`;

const Messages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: ${({ theme }) => theme.colors.background.surface};
`;

const Bubble = styled.div`
  max-width: 85%;
  padding: 0.65rem 0.85rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.45;
  white-space: pre-line;
  word-break: break-word;

  ${({ $assistant, theme }) =>
    $assistant
      ? `
        align-self: flex-start;
        background: ${theme.colors.background.surfaceVariant};
        color: ${theme.colors.text.main};
      `
      : `
        align-self: flex-end;
        background: ${theme.colors.primary};
        color: ${theme.colors.text.onPrimary};
      `}
`;

const Thinking = styled.div`
  align-self: flex-start;
  padding: 0 0.25rem;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
`;

const Chip = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.surface};
  color: ${({ theme }) => theme.colors.text.main};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 0.4rem 0.75rem;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }
`;

const Composer = styled.form`
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.surface};
`;

const Input = styled.input`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 0.55rem 0.75rem;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.surface};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.border};
  }
`;

const SendButton = styled.button`
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.onPrimary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.9rem;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryContainer};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AssistantPanel = () => {
  const open = useAssistantStore((s) => s.open);
  const initialQuestion = useAssistantStore((s) => s.initialQuestion);
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  const clearInitial = useAssistantStore((s) => s.clearInitial);
  const closeAssistant = useAssistantStore((s) => s.closeAssistant);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState(null);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [lastAuto, setLastAuto] = useState(null);
  const builtRef = useRef(false);
  const endRef = useRef(null);

  const patchCard = useCallback(
    (key, patch) =>
      setMessages((prev) =>
        prev.map((message) =>
          message.card && message.card.key === key ? { ...message, card: { ...message.card, ...patch } } : message
        )
      ),
    []
  );

  const ask = useCallback(
    async (raw) => {
      const q = String(raw || '').trim();
      if (!q) return;
      setMessages((prev) => [...prev, { role: 'user', text: q }]);

      const safeContext = context || { mode: 'retail', currency: 'GHS', statsByScope: {} };

      // A sentence with no number and a question word in it can only be a
      // question, so it is answered from the on-device stats without a round trip.
      if (!shouldParseSentence(q)) {
        const result = answer(q, safeContext);
        setMessages((prev) => [...prev, { role: 'assistant', text: result.text }]);
        return;
      }

      setThinking(true);
      try {
        const parsed = await parseSentence({
          text: q,
          mode: safeContext.mode,
          currency: safeContext.currency,
          categories: safeContext.categories,
          items: safeContext.items,
        });

        if (!parsed.ok) {
          const text =
            parsed.reason === 'not_configured'
              ? NOT_CONFIGURED_MESSAGE
              : parsed.reason === 'unauthorized'
                ? 'Your session has expired. Sign in again and I can record that for you.'
                : 'I couldn\u2019t reach the record service just now. I can still answer questions about your business.';
          setMessages((prev) => [...prev, { role: 'assistant', text }]);
          return;
        }

        if (parsed.kind !== 'record' || !parsed.recordType) {
          const result = answer(q, safeContext);
          const text = parsed.kind === 'unknown' && parsed.clarify ? parsed.clarify : result.text;
          setMessages((prev) => [...prev, { role: 'assistant', text }]);
          return;
        }

        const built = buildRecordPayload(parsed.recordType, parsed.fields, {
          mode: safeContext.mode,
          currency: safeContext.currency,
        });

        // The attempt is logged either way: a sentence the model got wrong is the
        // exact material the weekly review turns into a new FEW_SHOT example.
        const parseId = await logParse({
          input: q,
          kind: 'record',
          recordType: parsed.recordType,
          parsed: { recordType: parsed.recordType, confidence: parsed.confidence, fields: parsed.fields },
        });

        if (!built.ok) {
          setMessages((prev) => [...prev, { role: 'assistant', text: built.error }]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            card: {
              key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              parseId,
              recordType: built.recordType,
              payload: built.payload,
              summary: built.summary,
              confidence: parsed.confidence,
              status: 'pending',
            },
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [context]
  );

  const handleSaveCard = useCallback(
    async (card) => {
      patchCard(card.key, { status: 'saving' });
      try {
        const result = await saveParsedRecord({
          recordType: card.recordType,
          payload: card.payload,
        });
        patchCard(card.key, {
          status: 'saved',
          shortfall: result?.shortfall || null,
          item: card.payload?.item || null,
        });
        updateParse(card.parseId, { saved: true, feedback: 'up' });
        // A saved record is new input for any follow-up question, so rebuild the
        // stats the engine answers from rather than leaving it a record behind.
        buildAssistantContext().then(setContext).catch(() => {});
      } catch (error) {
        console.error('Failed to save assistant record', error);
        patchCard(card.key, { status: 'error' });
      }
    },
    [patchCard]
  );

  const handleDiscardCard = useCallback(
    (card) => {
      patchCard(card.key, { status: 'rejected' });
      updateParse(card.parseId, { feedback: 'down' });
      const section = RECORD_TYPE_SECTIONS[card.recordType] || 'your records';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `No problem \u2014 nothing was saved. You can add it by hand in ${section}, or say it another way.`,
        },
      ]);
    },
    [patchCard]
  );

  const onSubmit = (event) => {
    event.preventDefault();
    ask(input);
    setInput('');
  };

  useEffect(() => {
    if (!open || builtRef.current) return;
    builtRef.current = true;
    let alive = true;
    buildAssistantContext()
      .then((ctx) => {
        if (!alive) return;
        setContext(ctx);
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setContext(null);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // A doorway question is answered once its context has finished loading. The
  // append happens during render (the React-sanctioned "adjust state when a
  // value changes" pattern) rather than in an effect, so the seeded answer uses
  // real numbers. `lastAuto` back-stops the append so a later open of the same
  // session never replays it; the effect below then clears the pending question
  // from the store.
  if (open && ready && initialQuestion && lastAuto !== initialQuestion) {
    setLastAuto(initialQuestion);
    const safeContext = context || { mode: 'retail', currency: 'GHS', statsByScope: {} };
    const result = answer(initialQuestion, safeContext);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: initialQuestion },
      { role: 'assistant', text: result.text },
    ]);
  }

  useEffect(() => {
    if (open && initialQuestion && lastAuto === initialQuestion) clearInitial();
  }, [open, initialQuestion, lastAuto, clearInitial]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  if (!open) {
    return (
      <Fab type="button" onClick={() => openAssistant()} aria-label="Ask the KaisySales assistant">
        <Sparkles size={18} />
        Ask
      </Fab>
    );
  }

  const suggestions = suggestedQuestions(context?.mode || 'retail');
  const recordExample = context?.mode === 'services' ? 'Received 5,000 from Kwame' : 'Paid 800 for fuel';

  return (
    <>
      <Panel>
        <Header>
          <Title>
            <MessageCircle size={18} />
            KaisySales Assistant
          </Title>
          <Close type="button" onClick={closeAssistant} aria-label="Close assistant">
            <X size={20} />
          </Close>
        </Header>

        <Messages>
          {messages.length === 0 && (
            <Bubble $assistant>
              Hi! Tell me what happened — “paid 800 for fuel” — and I&apos;ll read it back for you to confirm
              before anything is saved. Or ask about your numbers; those are answered right here on your device.
            </Bubble>
          )}
          {messages.map((message, index) =>
            message.card ? (
              <RecordCard key={message.card.key} card={message.card} onSave={handleSaveCard} onDiscard={handleDiscardCard} />
            ) : (
              <Bubble key={index} $assistant={message.role === 'assistant'}>
                {message.text}
              </Bubble>
            )
          )}
          {thinking && <Thinking>Reading your sentence…</Thinking>}
          <div ref={endRef} />
        </Messages>

        {messages.length === 0 && (
          <Suggestions>
            <Chip key={recordExample} type="button" onClick={() => ask(recordExample)}>
              {recordExample}
            </Chip>
            {suggestions.slice(0, 3).map((suggestion) => (
              <Chip key={suggestion} type="button" onClick={() => ask(suggestion)}>
                {suggestion}
              </Chip>
            ))}
          </Suggestions>
        )}

        <Composer onSubmit={onSubmit}>
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a record or ask a question…"
            aria-label="Type a record or a question for the assistant"
          />
          <SendButton type="submit" disabled={!input.trim()} aria-label="Send to the assistant">
            <Send size={16} />
          </SendButton>
        </Composer>
      </Panel>
    </>
  );
};

export default AssistantPanel;