import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Send, X, Sparkles, MessageCircle } from 'lucide-react';
import { answer, suggestedQuestions } from '../../utils/assistant/engine';
import { buildAssistantContext } from '../../services/assistantContext';
import { useAssistantStore } from '../../store/assistantStore';

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
  const [lastAuto, setLastAuto] = useState(null);
  const builtRef = useRef(false);
  const endRef = useRef(null);

  const ask = useCallback(
    (question) => {
      const q = String(question || '').trim();
      if (!q) return;
      const safeContext = context || { mode: 'retail', currency: 'GHS', statsByScope: {} };
      const result = answer(q, safeContext);
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: q },
        { role: 'assistant', text: result.text },
      ]);
    },
    [context]
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
  }, [messages]);

  if (!open) {
    return (
      <Fab type="button" onClick={() => openAssistant()} aria-label="Ask the KaisySales assistant">
        <Sparkles size={18} />
        Ask
      </Fab>
    );
  }

  const suggestions = suggestedQuestions(context?.mode || 'retail');

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
              Hi! Ask me about your records in plain language — how much you made, what you're spending on, stock levels, or who still owes you. Everything stays on this device.
            </Bubble>
          )}
          {messages.map((message, index) => (
            <Bubble key={index} $assistant={message.role === 'assistant'}>
              {message.text}
            </Bubble>
          ))}
          <div ref={endRef} />
        </Messages>

        {messages.length === 0 && (
          <Suggestions>
            {suggestions.slice(0, 4).map((suggestion) => (
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
            placeholder="Ask about your business…"
            aria-label="Ask the assistant a question"
          />
          <SendButton type="submit" disabled={!input.trim()} aria-label="Send question">
            <Send size={16} />
          </SendButton>
        </Composer>
      </Panel>
    </>
  );
};

export default AssistantPanel;