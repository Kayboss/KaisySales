import styled from 'styled-components';

/**
 * Base skeleton "bone".
 *
 * Loads used to be a centred "Loading..." string, so the page collapsed to a
 * single line and then jumped to full height once data arrived. This renders a
 * grey placeholder of the real shape instead, so the layout is stable while the
 * fetch is in flight.
 *
 * The bone is deliberately pure grey (not brand terracotta) so it reads as a
 * placeholder rather than content. `theme.mode` is the only theme key used
 * because it is the one alias ThemeContext adds at runtime that tells us whether
 * the surrounding surface is light or dark.
 *
 * `aria-hidden` keeps the bones out of the accessibility tree; the announcing
 * `role="status"` wrapper lives in SkeletonScreen, so screen readers hear one
 * "Loading" rather than every rectangle.
 */
const Bone = styled.span`
  display: block;
  width: ${({ $width }) => $width || '100%'};
  height: ${({ $height }) => $height || '1rem'};
  border-radius: ${({ $circle, $radius, theme }) =>
    $circle ? '50%' : ($radius || theme.borderRadius.sm)};
  background: ${({ theme }) =>
    theme.mode === 'dark'
      ? 'linear-gradient(90deg, #2B2B2E 25%, #3B3B40 37%, #2B2B2E 63%)'
      : 'linear-gradient(90deg, #E4E4E7 25%, #F4F4F5 37%, #E4E4E7 63%)'};
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;

  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* A shimmer is exactly the kind of motion a vestibular-sensitive user opts out
     of; the placeholder still communicates "loading" without it. */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Skeleton = ({ width, height, radius, circle = false, ...rest }) => (
  <Bone aria-hidden="true" $width={width} $height={height} $radius={radius} $circle={circle} {...rest} />
);

export default Skeleton;
