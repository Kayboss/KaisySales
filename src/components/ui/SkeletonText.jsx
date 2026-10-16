import styled from 'styled-components';
import Skeleton from './Skeleton';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

/**
 * A short paragraph of placeholder lines. The final line is shortened so the
 * block reads as prose rather than a solid grey slab.
 */
const SkeletonText = ({ lines = 3, lastWidth = '60%' }) => (
  <Wrap>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} height="0.85rem" width={i === lines - 1 ? lastWidth : '100%'} />
    ))}
  </Wrap>
);

export default SkeletonText;
