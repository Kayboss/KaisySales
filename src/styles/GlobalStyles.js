import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: ${({ theme }) => theme.fonts.main};
    background-color: ${({ theme }) => theme.background};
    color: ${({ theme }) => theme.text};
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    transition: ${({ theme }) => theme.transitions.default};
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    letter-spacing: -0.02em;
  }

  /* Data tabular lining for financial numbers */
  .data-tabular {
    font-variant-numeric: tabular-nums;
    font-family: ${({ theme }) => theme.fonts.data};
  }

  /* Modern Tactile Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background.main};
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary};
    border-radius: 3px;
    opacity: 0.3;
  }

  /* Accent pattern style */
  .pattern-accent {
    background-image: radial-gradient(${({ theme }) => theme.colors.primary} 0.5px, transparent 0.5px);
    background-size: 8px 8px;
    opacity: 0.1;
  }
`;
