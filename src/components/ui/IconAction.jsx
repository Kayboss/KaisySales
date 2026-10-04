import styled from 'styled-components';

/**
 * Row/table action control.
 *
 * These actions used to be bare lucide icons with `cursor="pointer"` and an
 * onClick. An SVG is not a button: it cannot be focused, cannot be activated
 * with Enter/Space, and exposes no accessible name, so every edit/delete action
 * in a table was mouse-only. The mobile layout below ~700px already rendered
 * real buttons, which is why this was easy to miss.
 *
 * `label` is what a screen reader announces and what the tooltip shows, so it
 * should name the specific record, e.g. `Delete sale for Ruth`.
 */
const IconAction = styled.button.attrs(({ label }) => ({
  type: 'button',
  'aria-label': label,
  title: label,
}))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: none;
  border: none;
  border-radius: 6px;
  color: inherit;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }
`;

export default IconAction;