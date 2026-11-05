import { useState } from 'react';
import styled from 'styled-components';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/supabase';
import { PASSWORD_HINT, passwordProblem } from '../../utils/staffLogin';

/**
 * Shown once, to a login the business owner created.
 *
 * The owner hands over a temporary password in person, so the first thing the
 * teammate does is choose their own — the password the owner saw is no longer
 * the password they can sign in with. The flag that gates this screen lives in
 * user metadata (see `create-staff`), not in the profile, so clearing it
 * requires no extra write and no RLS exemption.
 */

const Page = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FCF9F3;
  padding: 1.5rem;
`;

const Card = styled.form`
  width: 100%;
  max-width: 420px;
  background: white;
  border: 1px solid #F0EEE8;
  border-radius: 16px;
  box-shadow: 0 18px 50px rgba(28, 28, 24, 0.08);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const IconWrap = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #F5EFEB;
  color: #6F240A;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h1`
  margin: 0;
  font-family: 'Tango Sans', 'Manrope', sans-serif;
  font-size: 1.35rem;
  color: #1C1C18;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #55423D;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #55423D;
`;

const Input = styled.input`
  padding: 0.7rem 0.85rem;
  border: 1px solid #D0C8C4;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1C1C18;

  &:focus {
    outline: none;
    border-color: #6F240A;
  }
`;

const Hint = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: #89726C;
  line-height: 1.45;
`;

const Error = styled.div`
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #FFC7C7;
  background: #FFE8E8;
  color: #BA1A1A;
  font-size: 0.82rem;
  font-weight: 600;
`;

const Submit = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.8rem 1rem;
  border: none;
  border-radius: 10px;
  background: #6F240A;
  color: white;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;

  &:hover:not(:disabled) { background: #5A1D08; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const SignOut = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.7rem 1rem;
  border: 1px solid #D0C8C4;
  border-radius: 10px;
  background: white;
  color: #55423D;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;

  &:hover { background: #F5F3F0; }
`;

const SetPasswordScreen = () => {
  const email = useAuthStore((state) => state.user?.email);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await authService.updatePassword(password);
      // The auth listener in authStore receives USER_UPDATED with the new
      // metadata, so `mustChangePassword` flips and CheckAuth renders the app.
      // Nothing else to do here.
    } catch (err) {
      setError(err?.message || 'Could not save that password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Card onSubmit={handleSubmit}>
        <IconWrap><ShieldCheck size={22} /></IconWrap>
        <Title>Choose your password</Title>
        <Subtitle>
          {email ? <><strong>{email}</strong> is signed in with a temporary password. </> : null}
          Replace it with one only you know. You will use it from now on.
        </Subtitle>

        {error && <Error role="alert">{error}</Error>}

        <Field>
          New password
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field>
          Confirm password
          <Input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>

        <Hint><KeyRound size={12} style={{ verticalAlign: '-2px' }} /> {PASSWORD_HINT}</Hint>

        <Submit type="submit" disabled={saving || !password || !confirm}>
          {saving ? 'Saving...' : 'Save password and continue'}
        </Submit>
        <SignOut type="button" onClick={() => useAuthStore.getState().logout()}>
          <LogOut size={14} /> Sign out
        </SignOut>
      </Card>
    </Page>
  );
};

export default SetPasswordScreen;
