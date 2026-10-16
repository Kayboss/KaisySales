import styled from 'styled-components';

const Wrap = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.text.muted};
  padding: ${({ $compact }) => ($compact ? '1.5rem 1rem' : '3rem 1.5rem')};
  background: ${({ $boxed, theme }) => ($boxed ? theme.colors.background.surface : 'transparent')};
  border: ${({ $boxed, theme }) => ($boxed ? `1px dashed ${theme.colors.outlineVariant}` : 'none')};
  border-radius: ${({ $boxed, theme }) => ($boxed ? theme.borderRadius.lg : '0')};
`;

const Icon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
  color: ${({ theme }) => theme.colors.border};
`;

const Text = styled.p`
  margin: 0;
  font-size: 0.9rem;
`;

/**
 * The empty state was copy-pasted into ~15 feature files under two different
 * names (`Empty` and `EmptyState`) with three different paddings and two looks.
 * This is the single replacement: plain muted centred text by default, a dashed
 * card when `$boxed`, tighter spacing inside a table cell when `$compact`.
 */
const EmptyState = ({ icon, children, $boxed = false, $compact = false }) => (
  <Wrap $boxed={$boxed} $compact={$compact}>
    {icon && <Icon>{icon}</Icon>}
    <Text>{children}</Text>
  </Wrap>
);

export default EmptyState;
