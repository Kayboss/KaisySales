import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';

const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #FCF9F3;
  color: #1C1C18;
  text-align: center;
  padding: 2rem;
  font-family: 'Manrope', sans-serif;
`;

const Card = styled.div`
  max-width: 560px;
  background: #FFFFFF;
  border: 1px solid rgba(111, 36, 10, 0.15);
  border-left: 4px solid #6F240A;
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 8px 24px rgba(28, 28, 24, 0.06);
`;

const Title = styled.h1`
  font-family: 'Tango Sans', sans-serif;
  font-size: 1.75rem;
  margin: 0 0 1rem 0;
  color: #6F240A;
`;

const Body = styled.p`
  color: #55423D;
  line-height: 1.6;
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
`;

const Code = styled.code`
  display: block;
  margin: 1.25rem 0;
  padding: 0.85rem 1rem;
  background: #1C1C18;
  color: #FCF9F3;
  border-radius: 8px;
  font-size: 0.8rem;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-all;
`;

const Support = styled.p`
  color: #55423D;
  font-size: 0.85rem;
  margin: 0;

  a {
    color: #6F240A;
    font-weight: 600;
  }
`;

/**
 * Shown instead of the app when a production build has no Supabase credentials.
 * The alternative is the localStorage fallback, which would accept a sign-in and
 * quietly keep a user's real records in one browser — so we refuse to run.
 */
const ConfigError = () => (
  <Screen>
    <Card role="alert">
      <AlertTriangle size={40} color="#6F240A" aria-hidden="true" />
      <Title>Service Temporarily Unavailable</Title>
      <Body>
        KaisySales could not start because its database connection is not configured. This is
        an issue on our side, not with your account or your data.
      </Body>
      <Body>
        <strong>Nothing has been saved.</strong> We have deliberately disabled the app rather
        than let it run without a database, so no invoice, customer or payment you enter can be
        stored unsafely in your browser. Your existing records are untouched.
      </Body>
      <Code>Expected environment variables{'\n'}VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_ANON_KEY</Code>
      <Support>
        Please try again shortly, or email{' '}
        <a href="mailto:support@kaisysales.com">support@kaisysales.com</a>.
      </Support>
    </Card>
  </Screen>
);

export default ConfigError;
