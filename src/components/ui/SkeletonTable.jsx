import styled from 'styled-components';
import Skeleton from './Skeleton';

const Card = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 0 1.25rem;
  overflow: hidden;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, 1fr);
  gap: 1rem;
  align-items: center;
  padding: 0.9rem 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.background.surfaceVariant};

  &:last-child {
    border-bottom: none;
  }
`;

const HeaderRow = styled(Row)`
  padding-top: 1.1rem;
`;

/**
 * Placeholder for the many `<Table>` screens. `rows`/`cols` should match the real
 * table so the card keeps the same height and the rows do not reflow on load.
 */
const SkeletonTable = ({ rows = 6, cols = 4 }) => (
  <Card>
    <HeaderRow $cols={cols}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height="0.7rem" width="60%" />
      ))}
    </HeaderRow>
    {Array.from({ length: rows }).map((_, r) => (
      <Row key={r} $cols={cols}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} height="0.85rem" width={c === 0 ? '80%' : '55%'} />
        ))}
      </Row>
    ))}
  </Card>
);

export default SkeletonTable;
