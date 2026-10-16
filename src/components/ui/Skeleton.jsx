import styled from 'styled-components';

/**
 * Base skeleton "bone".
 *
 * The grey placeholder shows while content loads, so the page layout remains
 * stable. A sweeping shine is used instead of background-position for a
 * cleaner feel, and colours are brand-tinted (warm sand tones) rather than
 * stark neutral grey.
 *
 * `aria-hidden` keeps bones out of the accessibility tree; the announcing
 * `role="status"` wrapper lives in SkeletonScreen, so screen readers hear one
 * "Loading" rather than every rectangle.
 */
const Bone = styled.span`
  position: relative;
  display: block;
  overflow: hidden;
  width: ${({ $width }) => $width || '100%'};
  height: ${({ $height }) => $height || '1rem'};
  border-radius: ${({ $circle, $radius, theme }) =>
    $circle ? '50%' : ($radius || theme.borderRadius.sm)};
  background: ${({ theme }) =>
    theme.mode === 'dark' ? '#352E2A' : '#EFE9DC'};
  animation: skeleton-sweep 1.6s ease-in-out infinite;
  animation-delay: ${({ $delay }) => ($delay ? `${$delay}s` : '0s')};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: ${({ theme }) =>
      theme.mode === 'dark'
        ? 'linear-gradient(90deg, transparent 0%, #463F38 50%, transparent 100%)'
        : 'linear-gradient(90deg, transparent 0%, #F7F2E8 50%, transparent 100%)'};
    animation: skeleton-sweep-after 1.6s ease-in-out infinite;
    animation-delay: ${({ $delay }) => ($delay ? `${$delay}s` : '0s')};
  }

  @keyframes skeleton-sweep {
    0% {
      opacity: 0.8;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.8;
    }
  }

  @keyframes skeleton-sweep-after {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  /* Respect reduced motion preferences. */
  @media (prefers-reduced-motion: reduce) {
    animation: skeleton-pulse 2.2s ease-in-out infinite;
    animation-delay: ${({ $delay }) => ($delay ? `${$delay}s` : '0s')};

    &::after {
      display: none;
      animation: none;
    }
  }

  @keyframes skeleton-pulse {
    0% {
      opacity: 0.55;
    }
    50% {
      opacity: 0.9;
    }
    100% {
      opacity: 0.55;
    }
  }
`;

const Skeleton = ({ width, height, radius, circle = false, delay = 0, ...rest }) => (
  <Bone
    aria-hidden="true"
    $width={width}
    $height={height}
    $radius={radius}
    $circle={circle}
    $delay={delay}
    {...rest}
  />
);

export default Skeleton;
