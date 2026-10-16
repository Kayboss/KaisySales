import styled from 'styled-components';

const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

/**
 * Wraps a composed skeleton for one screen.
 *
 * The grey bones are decorative, so without this the only signal that the page is
 * loading would be visual — a screen-reader user would hear nothing at all. This
 * exposes a single polite status ("Loading <name>") and marks the region busy.
 */
const SkeletonScreen = ({ label = 'Loading', children }) => (
  <Screen role="status" aria-busy="true" aria-live="polite">
    <SrOnly>{label}…</SrOnly>
    {children}
  </Screen>
);

export default SkeletonScreen;
