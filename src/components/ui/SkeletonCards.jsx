import styled from 'styled-components';
import Skeleton from './Skeleton';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${({ $min }) => $min || '200px'}, 1fr));
  gap: 1rem;
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

/**
 * The stat-card rows that head almost every screen (Gross / Expenses / Net / ...).
 * `count` mirrors the real number of cards so the grid does not shift width when
 * the numbers load.
 */
const SkeletonCards = ({ count = 4, $min }) => (
  <Grid $min={$min}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i}>
        <Skeleton height="0.75rem" width="45%" />
        <Skeleton height="1.5rem" width="70%" />
      </Card>
    ))}
  </Grid>
);

export default SkeletonCards;
