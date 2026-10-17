import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Send, X, Sparkles, MessageCircle } from 'lucide-react';
import { answer, suggestedQuestions } from '../../utils/assistant/engine';
import { shouldParseSentence } from '../../utils/assistant/route';
import { buildRecordPayload, RECORD_TYPE_LABELS, RECORD_TYPE_SECTIONS } from '../../utils/assistant/recordPayload';
import { missingFields, clarifyPrompt, mergeFields, unknownItemPrompt, inventoryStockPrompt, parseStockAnswer } from '../../utils/assistant/clarify';
import { buildAssistantContext } from '../../services/assistantContext';
import { parseSentence, logParse, updateParse, saveParsedRecord, addInventoryItem, NOT_CONFIGURED_MESSAGE } from '../../services/assistantRecord';
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

const PendingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0 1rem 0.5rem;
  padding: 0.45rem 0.5rem 0.45rem 0.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Composer = styled.form`
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.surface};
`;const Input = styled.input`
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
  // The card whose blank fields the assistant just asked about. While it is set,
  // the next thing the user types is read as an answer to that question rather
  // than as a fresh record.
  const [pending, setPending] = useState(null);
  // The card waiting on an inventory item to be added before it can be saved.
  // While it is set, a bare number is read as that item's stock level — no round
  // trip, because "40" is not a sentence for the parser to interpret.
  const [pendingAdd, setPendingAdd] = useState(null);
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

  const mode = context?.mode === 'services' ? 'services' : 'retail';
  const currency = context?.currency || 'GHS';
  const inventory = context?.inventory;

  /**
   * Builds the payload, shows the card, and asks about whatever the record is
   * still missing. `replaceKey` re-renders an existing card in place, which is
   * how an answer to the follow-up question lands: same card, fuller record.
   * `inventory` overrides the loaded rows so a card can be re-presented against
   * an item that was just added.
   */
  const presentCard = useCallback(
    ({ recordType, fields, confidence, parseId, replaceKey, inventory: inventoryRows }) => {
      const rows = Array.isArray(inventoryRows) ? inventoryRows : inventory;
      const built = buildRecordPayload(recordType || '', fields, { mode, currency, inventory: rows });
      if (!built.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', text: built.error }]);
        if (!replaceKey) setPending(null);
        return;
      }

      // A sale moves stock, and stock only exists on an inventory row. When the
      // spoken item matches none, the card is shown but cannot be saved: the
      // assistant names the problem and offers to add the item, rather than
      // writing a sale that quietly skips the shelf (or inventing an item with no
      // cost the owner never sees). `null` (loaded, no match) is the block;
      // `undefined` (retail context not loaded) is not, and saveParsedRecord
      // re-checks so a stale card still cannot slip through.
      const unresolvedItem =
        built.recordType === 'sale' && Array.isArray(rows) && !built.inventoryMatch;

      const missing = missingFields(built.recordType, built.payload, mode);
      const cardKey = replaceKey || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const card = {
        key: cardKey,
        parseId,
        recordType: built.recordType,
        payload: built.payload,
        summary: built.summary,
        missing,
        confidence,
        status: 'pending',
        fields,
        inventoryMatch: built.inventoryMatch || null,
        unresolvedItem,
      };

      if (replaceKey) {
        // Keep the original parse row: the feedback the user gives when they save
        // or reject belongs to the sentence that started the record, not to the
        // answer that finished it.
        setMessages((prev) =>
          prev.map((message) =>
            message.card && message.card.key === replaceKey
              ? {
                  ...message,
                  card: {
                    ...card,
                    parseId: message.card.parseId,
                    status: message.card.status,
                    // A re-present (stock added, item re-named) does not re-read
                    // the model, so the original confidence stands.
                    confidence: card.confidence ?? message.card.confidence,
                  },
                }
              : message
          )
        );
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', card }]);
      }

      // The unresolved item is the more urgent question, so it replaces the
      // "anything missing?" one instead of arriving beside it.
      if (unresolvedItem) {
        setPendingAdd(null);
        setPending({
          cardKey,
          recordType: built.recordType,
          fields,
          label: built.payload.item || RECORD_TYPE_LABELS[built.recordType] || 'this record',
        });
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: unknownItemPrompt(built.payload.item) },
        ]);
        return;
      }

      setPending(
        missing.length
          ? {
              cardKey,
              recordType: built.recordType,
              fields,
              label:
                built.payload.title || built.payload.item || built.payload.client_name ||
                RECORD_TYPE_LABELS[built.recordType] ||
                'this record',
            }
          : null
      );

      const question = clarifyPrompt(missing);
      if (question) setMessages((prev) => [...prev, { role: 'assistant', text: question }]);
    },
    [mode, currency, inventory]
  );

  const ask = useCallback(
    async (raw) => {
      const q = String(raw || '').trim();
      if (!q) return;
      setMessages((prev) => [...prev, { role: 'user', text: q }]);

      const safeContext = context || { mode: 'retail', currency: 'GHS', statsByScope: {} };
      const answering = pending;

      // The one thing the assistant asks that is not a sentence: "how many do you
      // have in stock?" is answered with a number. A bare count is read here and
      // the item is created locally, so no model round trip is spent on it. Any
      // other reply means they changed their mind, so the flow is abandoned and
      // the message carries on as an ordinary one.
      const stockLevel = pendingAdd ? parseStockAnswer(q) : null;
      if (pendingAdd && stockLevel === null) setPendingAdd(null);

      if (pendingAdd && stockLevel !== null) {
        const target = pendingAdd;
        setThinking(true);
        try {
          await addInventoryItem({
            name: target.item,
            category: target.category,
            stock: stockLevel,
          });
          const fresh = await buildAssistantContext();
          setContext(fresh);
          setPendingAdd(null);
          // Re-present the same card against the new inventory: it is the same
          // sentence and the same parse row, now resolvable.
          presentCard({
            recordType: target.recordType,
            fields: target.fields,
            replaceKey: target.cardKey,
            inventory: fresh.inventory,
          });
        } catch (error) {
          console.error('Failed to add inventory item from assistant', error);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: `I couldn\u2019t add \u201c${target.item}\u201d to inventory. You can add it in Inventory, then say the sale again.`,
            },
          ]);
        } finally {
          setThinking(false);
        }
        return;
      }

      // A sentence with no number and a question word in it can only be a
      // question, so it is answered from the on-device stats without a round trip.
      // An answer to the assistant's own question is exempt: "Adobe" carries no
      // number, but it is an answer, and it has to reach the parser.
      if (!answering && !shouldParseSentence(q)) {
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
          merge: answering ? { recordType: answering.recordType, fields: answering.fields } : null,
        });

        if (!parsed.ok) {
          const text =
            parsed.reason === 'not_configured'
              ? NOT_CONFIGURED_MESSAGE
              : parsed.reason === 'unauthorized'
                ? 'Your session has expired. Sign in again and I can record that for you.'
                : 'Something went wrong on the record service just now. I can still answer questions about your business.';
          setMessages((prev) => [...prev, { role: 'assistant', text }]);
          return;
        }

        if (answering) {
          // The reply may have been a question of their own instead of an answer.
          // Answer it and leave the card, and the question, standing.
          if (parsed.kind !== 'record' || !parsed.recordType) {
            const result = answer(q, safeContext);
            setMessages((prev) => [...prev, { role: 'assistant', text: result.text }]);
            return;
          }
          presentCard({
            recordType: parsed.recordType,
            fields: mergeFields(answering.fields, parsed.fields),
            confidence: parsed.confidence,
            replaceKey: answering.cardKey,
          });
          return;
        }

        if (parsed.kind !== 'record' || !parsed.recordType) {
          const result = answer(q, safeContext);
          const text = parsed.kind === 'unknown' && parsed.clarify ? parsed.clarify : result.text;
          setMessages((prev) => [...prev, { role: 'assistant', text }]);
          return;
        }

        // The attempt is logged either way: a sentence the model got wrong is the
        // exact material the weekly review turns into a new FEW_SHOT example. An
        // answer to a follow-up question is deliberately NOT logged — detached
        // from the sentence it was answering it would read as a broken example.
        const parseId = await logParse({
          input: q,
          kind: 'record',
          recordType: parsed.recordType,
          parsed: { recordType: parsed.recordType, confidence: parsed.confidence, fields: parsed.fields },
        });

        presentCard({
          recordType: parsed.recordType,
          fields: parsed.fields,
          confidence: parsed.confidence,
          parseId,
        });
      } finally {
        setThinking(false);
      }
    },
    [context, pending, pendingAdd, presentCard]
  );

  /**
   * Starts the add-to-inventory flow for a sale whose item is not stocked. The
   * card is left standing: once the item exists the same card is re-presented,
   * still bound to the sentence that created it.
   */
  const handleAddToInventory = useCallback((card) => {
    setPendingAdd({
      cardKey: card.key,
      recordType: card.recordType,
      fields: card.fields || {},
      item: card.payload?.item || '',
      category: card.payload?.category || '',
    });
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: inventoryStockPrompt(card.payload?.item, card.payload?.quantity) },
    ]);
  }, []);

  const handleSaveCard = useCallback(
    async (card) => {
      if (pending?.cardKey === card.key) setPending(null);
      if (pendingAdd?.cardKey === card.key) setPendingAdd(null);
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
        // The item went missing between the card being built and being saved —
        // an inventory row was renamed or deleted in another tab. Rather than a
        // bare "something went wrong", put the card back into the blocked state
        // and offer the same way out.
        if (error?.code === 'unknown_item') {
          patchCard(card.key, { status: 'pending', unresolvedItem: true, inventoryMatch: null });
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', text: unknownItemPrompt(card.payload?.item) },
          ]);
          return;
        }
        patchCard(card.key, { status: 'error' });
      }
    },
    [patchCard, pending, pendingAdd]
  );

  const handleDiscardCard = useCallback(
    (card) => {
      if (pending?.cardKey === card.key) setPending(null);
      if (pendingAdd?.cardKey === card.key) setPendingAdd(null);
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
    [patchCard, pending, pendingAdd]
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
              <RecordCard
                key={message.card.key}
                card={message.card}
                onSave={handleSaveCard}
                onDiscard={handleDiscardCard}
                onAddToInventory={handleAddToInventory}
                addingToInventory={pendingAdd?.cardKey === message.card.key}
              />
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

        {(pending || pendingAdd) && (
          <PendingRow>
            <span>
              Adding to &ldquo;{pendingAdd ? pendingAdd.item : pending.label}&rdquo;
            </span>
            <Chip
              type="button"
              onClick={() => {
                setPending(null);
                setPendingAdd(null);
              }}
            >
              New record instead
            </Chip>
          </PendingRow>
        )}

        <Composer onSubmit={onSubmit}>
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              pendingAdd
                ? 'How many in stock?'
                : pending
                  ? 'Answer, or say something else…'
                  : 'Type a record or ask a question…'
            }
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