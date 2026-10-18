import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ChevronRight, Send, Sparkles, X } from 'lucide-react';
import { answer, suggestedQuestions } from '../../utils/assistant/engine';
import { buildInsights } from '../../utils/assistant/insights';
import { buildAssistantContext } from '../../services/assistantContext';
import { useAssistantStore } from '../../store/assistantStore';

/**
 * The assistant is a reading surface, not an input method.
 *
 * Recording is left to the screens, which already do it well and validate what
 * they are told — a spoken sentence was a slower, blurrier way to fill the same
 * form. So this panel does the thing the screens cannot: it looks across every
 * record and says what needs attention, then answers questions about the numbers.
 * Both are computed on-device from the same stats the reports use, so the panel
 * can never disagree with a screen.
 */

const severityColor = (theme, severity) => {
  if (severity === 'high') return theme.colors.status.error;
  if (severity === 'medium') return theme.colors.status.warning;
  return theme.colors.primary;
};

const Fab = styled.button`
  position: fixed;
  right: 1.5rem;
  bottom: 5.25rem;
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
  flex-shrink: 0;
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
  /* min-height: 0 is load-bearing. A flex item's automatic minimum size is its
     content, so without it this scroll area grows to fit a tall message instead
     of scrolling it — the panel (overflow: hidden) then clips the overflow and
     on a phone the composer slides out of reach. */
  min-height: 0;
  overscroll-behavior: contain;
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

const SectionLabel = styled.div`
  margin-top: 0.25rem;
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`;

const InsightCard = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-align: left;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-left: 3px solid ${({ theme, $severity }) => severityColor(theme, $severity)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background.surface};
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.main};
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }
`;

const InsightText = styled.div`
  flex: 1;
  min-width: 0;
`;

const InsightTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text.main};
`;

const InsightBody = styled.div`
  margin-top: 0.15rem;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  line-height: 1.35;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const InsightChevron = styled(ChevronRight)`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Suggestions = styled.div`
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  const closeAssistant = useAssistantStore((s) => s.closeAssistant);
  const clearInitial = useAssistantStore((s) => s.clearInitial);
  const navigate = useNavigate();

  const [context, setContext] = useState(null);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [lastAuto, setLastAuto] = useState(null);
  const builtRef = useRef(false);
  const endRef = useRef(null);

  const insights = useMemo(
    () => (context ? buildInsights({ mode: context.mode, currency: context.currency, statsByScope: context.statsByScope }) : []),
    [context]
  );

  const ask = (question) => {
    const text = String(question || '').trim();
    if (!text) return;
    const reply = answer(text, context || { mode: 'retail', currency: 'GHS', statsByScope: {} }).text;
    setMessages((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: reply }]);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    ask(input);
    setInput('');
  };

  const onInsight = (insight) => {
    navigate(insight.route);
    closeAssistant();
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

  // A doorway button opens the panel primed with that screen's question. The same
  // setState-during-render pattern the store test pins down: an effect here would
  // be the naive version the react-hooks rule forbids.
  if (open && ready && initialQuestion && lastAuto !== initialQuestion) {
    setLastAuto(initialQuestion);
    const reply = answer(initialQuestion, context || { mode: 'retail', currency: 'GHS', statsByScope: {} }).text;
    setMessages([
      { role: 'user', text: initialQuestion },
      { role: 'assistant', text: reply },
    ]);
  }

  useEffect(() => {
    if (!open || !initialQuestion || lastAuto !== initialQuestion) return;
    clearInitial();
  }, [open, initialQuestion, lastAuto, clearInitial]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  if (!open) {
    return (
      <Fab type="button" onClick={() => openAssistant()} aria-label="Open the KaisySales assistant">
        <Sparkles size={18} />
        Assistant
      </Fab>
    );
  }

  const suggestions = suggestedQuestions(context?.mode || 'retail');
  const showLanding = messages.length === 0;

  return (
    <Panel>
      <Header>
        <Title>
          <Sparkles size={18} />
          KaisySales Assistant
        </Title>
        <Close type="button" onClick={closeAssistant} aria-label="Close assistant">
          <X size={20} />
        </Close>
      </Header>

      <Messages>
        {showLanding && (
          <Bubble $assistant>
            For keeping your books, use each screen&apos;s own form — that&apos;s the quickest way. Ask me here about your
            numbers instead, or look below for what needs your attention.
          </Bubble>
        )}

        {showLanding && ready && context && insights.length === 0 && (
          <Bubble $assistant>Everything looks settled right now — nothing needs your attention.</Bubble>
        )}

        {showLanding && insights.length > 0 && (
          <>
            <SectionLabel>Needs attention</SectionLabel>
            {insights.map((insight) => (
              <InsightCard key={insight.id} type="button" $severity={insight.severity} onClick={() => onInsight(insight)}>
                <InsightText>
                  <InsightTitle>{insight.title}</InsightTitle>
                  <InsightBody>{insight.body}</InsightBody>
                </InsightText>
                <InsightChevron size={16} />
              </InsightCard>
            ))}
          </>
        )}

        {!showLanding &&
          messages.map((message, index) => (
            <Bubble key={index} $assistant={message.role === 'assistant'}>
              {message.text}
            </Bubble>
          ))}
        <div ref={endRef} />
      </Messages>

      {showLanding && (
        <Suggestions>
          {suggestions.slice(0, 3).map((suggestion) => (
            <Chip key={suggestion} type="button" onClick={() => ask(suggestion)}>
              {suggestion}
            </Chip>
          ))}
        </Suggestions>
      )}

      {!showLanding && (
        <Suggestions>
          <Chip type="button" onClick={() => setMessages([])}>
            What needs attention?
          </Chip>
          {suggestions.slice(0, 2).map((suggestion) => (
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
          placeholder="Ask about your numbers…"
          aria-label="Ask the assistant about your numbers"
        />
        <SendButton type="submit" disabled={!input.trim()} aria-label="Send to the assistant">
          <Send size={16} />
        </SendButton>
      </Composer>
    </Panel>
  );
};

export default AssistantPanel;
