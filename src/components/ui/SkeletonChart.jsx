import styled from 'styled-components';
import Skeleton from './Skeleton';

const Box = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.25rem;
`;

const Title = styled.div`
  margin-bottom: 1rem;
`;

const Plot = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  height: ${({ $height }) => $height || '180px'};
`;

const Bar = styled(Skeleton).attrs({ $radius: '4px 4px 0 0' })`
  flex: 1;
`;

/* A fixed, deterministic set of heights (never Math.random) so the placeholder
   does not flicker between renders. */
const BAR_HEIGHTS = [45, 70, 35, 85, 60, 95, 50, 75, 40, 65];

/**
 * Placeholder for the Recharts panels. It draws a bar silhouette rather than one
 * flat block so the chart area reads as a chart at a glance.
 */
const SkeletonChart = ({ $height }) => (
  <Box>
    <Title>
      <Skeleton height="0.8rem" width="30%" />
    </Title>
    <Plot $height={$height}>
      {BAR_HEIGHTS.map((h, i) => (
        <Bar key={i} height={`${h}%`} />
      ))}
    </Plot>
  </Box>
);

export default SkeletonChart;
