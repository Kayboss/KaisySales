import styled from 'styled-components';
import { Sparkles } from 'lucide-react';
import { ASSISTANT_ENABLED } from '../../utils/features';
import { useAssistantStore } from '../../store/assistantStore';

/**
 * A doorway into the assistant, meant to sit on empty states and welcome
 * blocks: tap it and the panel opens already primed with the question for that
 * screen. Renders nothing when the feature flag is off, so screens can use it
 * unconditionally.
 */
const DoorwayButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.6rem 1.1rem;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.background.surface};
  color: ${({ theme }) => theme.colors.primary};
  font-family: ${({ theme }) => theme.fonts.main};
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-style: solid;
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.text.onPrimary};
  }
`;

const AssistantDoorway = ({ question, children = 'Not sure where to start? Ask the assistant' }) => {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  if (!ASSISTANT_ENABLED) return null;

  return (
    <DoorwayButton type="button" onClick={() => openAssistant(question)}>
      <Sparkles size={16} />
      {children}
    </DoorwayButton>
  );
};

export default AssistantDoorway;