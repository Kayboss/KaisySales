import { useState } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { ArrowRight, AlertCircle, CheckCircle2, Loader, Eye, EyeOff } from 'lucide-react';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  background: ${({ theme }) => theme.background};

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const HeroSection = styled.div`
  flex: 1.2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4rem;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const FormSection = styled.div`
  flex: 0.8;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4rem;
  background: white;

  @media (max-width: 768px) {
    flex: 1;
    padding: 2.5rem 1.5rem;
  }
`;

const Title = styled.h1`
  font-size: 3.5rem;
  margin-bottom: 1.5rem;
  color: white;

  @media (max-width: 1024px) {
    font-size: 2.5rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.25rem;
  opacity: 0.9;
  max-width: 500px;
  line-height: 1.8;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.secondary};
  color: white;
  padding: 1rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
  border: none;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};
  width: 100%;

  &:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.text.muted};
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const GoogleButton = styled.button`
  background: white;
  color: ${({ theme }) => theme.colors.text.main};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding: 1rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};
  width: 100%;

  &:hover {
    background: ${({ theme }) => theme.colors.background.main};
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: 1.25rem;
  font-family: inherit;
  background: ${({ theme }) => theme.colors.background.main};
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text.main};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(111, 36, 10, 0.1);
  }
`;

const PasswordWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const EyeButton = styled.button`
  position: absolute;
  right: 1rem;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.muted};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  height: 100%;
  
  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const PasswordChecklist = styled.div`
  margin: -0.5rem 0 1.25rem;
  padding: 0.9rem 1rem;
  background: ${({ theme }) => theme.colors.background.main};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const CheckItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${({ $ok }) => ($ok ? '#2E7D32' : '#8A817C')};
  margin-bottom: 0.4rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const StrengthMeter = styled.div`
  margin-top: 0.75rem;
`;

const StrengthBarTrack = styled.div`
  height: 6px;
  border-radius: 3px;
  background: #E8E0DC;
  overflow: hidden;
`;

const StrengthBarFill = styled.div`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ $color }) => $color};
  border-radius: 3px;
  transition: width 0.3s ease, background 0.3s ease;
`;

const StrengthLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${({ $color }) => $color};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const ToggleText = styled.p`
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;

  span {
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 700;
    cursor: pointer;
    margin-left: 0.5rem;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const ErrorBanner = styled.div`
  background: rgba(186, 26, 26, 0.08);
  color: #BA1A1A;
  border: 1px solid rgba(186, 26, 26, 0.2);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SuccessBanner = styled.div`
  background: rgba(37, 67, 47, 0.08);
  color: #25432F;
  border: 1px solid rgba(37, 67, 47, 0.2);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const WelcomePage = () => {
  const { login, signup, signInWithGoogle, resetPassword } = useAuthStore();
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedUntil] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Rate limiting
    if (blockedUntil && Date.now() < blockedUntil) {
      const waitSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      setError(`Too many attempts. Please wait ${waitSeconds} seconds.`);
      return;
    }

    // Pre-submission checks for signup
    if (isSignUp) {
      if (password !== confirmPassword) {
        setError('Secret passphrases do not match.');
        return;
      }
      if (password.length < 8) {
        setError('Secret passphrase must be at least 8 characters long.');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError('Passphrase must contain at least one uppercase letter.');
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError('Passphrase must contain at least one number.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const result = await signup(email, password);
        if (result) {
          setSuccess('Account created! Check your email for the confirmation link, then log in.');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        await login(email, password);
      }
    } catch (err) {
      console.error('🔥 Authentication error:', err);
      let msg = err?.message || err?.error_description || 'Something went wrong. Please try again.';
      
      if (/already registered|email already in use|already exists/i.test(msg)) {
        msg = 'This email is already registered. Please log in instead.';
      } else if (/invalid login credentials|wrong password|invalid-credential|user not found/i.test(msg)) {
        msg = 'Invalid business email or secret passphrase. Please review your entries.';
      } else if (/invalid email/i.test(msg)) {
        msg = 'Please enter a valid business email address.';
      } else if (/weak password|password is too weak/i.test(msg)) {
        msg = 'The passphrase is too weak. Please use a stronger combination.';
      } else if (/rate limit/i.test(msg)) {
        msg = 'Too many attempts. Please wait a moment and try again.';
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('🔥 Google Sign-in error:', err);
      setError(err.message || 'Google authentication was cancelled.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');
    
    if (!email) {
      setError('Please enter your business email address first, then click "Forgot passphrase?".');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess('A secure reset link has been woven and sent to your email address!');
    } catch (err) {
      console.error('🔥 Password reset error:', err);
      let msg = err.message;
      if (msg.includes('auth/user-not-found')) {
        msg = 'No registered account was found with this business email address.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Please enter a valid business email address.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const passwordChecks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'At least one uppercase letter (A-Z)', ok: /[A-Z]/.test(password) },
    { label: 'At least one number (0-9)', ok: /[0-9]/.test(password) },
  ];
  const metCount = passwordChecks.filter((c) => c.ok).length;
  const strength = [
    { label: 'Too weak', color: '#BA1A1A', pct: 20 },
    { label: 'Weak', color: '#E65100', pct: 40 },
    { label: 'Fair', color: '#F9A825', pct: 70 },
    { label: 'Strong', color: '#2E7D32', pct: 100 },
  ][metCount];

  return (
    <Container>
      <HeroSection>
<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
  <span style={{ fontWeight: 700, letterSpacing: '1px', fontFamily: "'Tango Sans', sans-serif", fontSize: '1.5rem', color: '#6F240A' }}>KaisySales</span>
</div>
        <Title style={{ fontFamily: "'Tango Sans', sans-serif" }}>Know your Business</Title>
        <Subtitle>
          Every true business owner knows that keeping track of every Cedi is the secret 
          to moving from a small shop to a big enterprise. KaisySales is the digital 
          financial partner built for the modern African entrepreneur.
        </Subtitle>
      </HeroSection>

      <FormSection>
        <h2 style={{ marginBottom: '2rem', color: '#6F240A', fontSize: '2rem', fontWeight: 900 }}>
          {isSignUp ? 'Create Your Account' : 'Enter KaisySales'}
        </h2>

        {error && (
          <ErrorBanner>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </ErrorBanner>
        )}

        {success && (
          <SuccessBanner>
            <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </SuccessBanner>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#6F240A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Business Email
          </label>
          <Input 
            type="email" 
            placeholder="email@business.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={loading}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#6F240A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Secret Passphrase
            </label>
            {!isSignUp && (
              <span 
                onClick={handleForgotPassword}
                style={{ 
                  fontSize: '0.85rem', 
                  color: '#6F240A', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Forgot passphrase?
              </span>
            )}
          </div>
          
          <PasswordWrapper style={{ marginBottom: '1.25rem' }}>
            <Input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              disabled={loading}
              style={{ marginBottom: 0, paddingRight: '3rem' }}
            />
            <EyeButton 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </EyeButton>
          </PasswordWrapper>

          {isSignUp && (
            <PasswordChecklist>
              {passwordChecks.map((check) => (
                <CheckItem key={check.label} $ok={check.ok}>
                  {check.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {check.label}
                </CheckItem>
              ))}
              {password.length > 0 && (
                <StrengthMeter>
                  <StrengthBarTrack>
                    <StrengthBarFill $pct={strength.pct} $color={strength.color} />
                  </StrengthBarTrack>
                  <StrengthLabel $color={strength.color}>
                    <span>Passphrase strength</span>
                    <span>{strength.label}</span>
                  </StrengthLabel>
                </StrengthMeter>
              )}
            </PasswordChecklist>
          )}

          {isSignUp && (
            <>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#6F240A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm Passphrase
              </label>
              <PasswordWrapper style={{ marginBottom: '1.25rem' }}>
                <Input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                  disabled={loading}
                  style={{ marginBottom: 0, paddingRight: '3rem' }}
                />
                <EyeButton 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </EyeButton>
              </PasswordWrapper>
            </>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                Connecting...
              </>
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'Enter KaisySales'}
                <ArrowRight size={20} />
              </>
            )}
          </Button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: '#DCC1B9' }}>
          <div style={{ flex: 1, height: '1px', background: '#DCC1B9' }} />
          <span style={{ padding: '0 1rem', fontSize: '0.85rem', color: '#55423D', fontWeight: 700 }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#DCC1B9' }} />
        </div>

        <GoogleButton 
          type="button" 
          onClick={handleGoogleSignIn} 
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.86 3C6.18 7.56 8.87 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.77 2.92c2.2-2.03 3.68-5.02 3.68-8.64z"
            />
            <path
              fill="#FBBC05"
              d="M5.25 14.56c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38l-3.86-3C.56 8.36 0 10.12 0 12s.56 3.64 1.39 5.2l3.86-3.04z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.77-2.92c-1.12.75-2.54 1.21-4.19 1.21-3.13 0-5.82-2.52-6.75-5.52l-3.86 3C3.37 20.33 7.35 23 12 23z"
            />
          </svg>
          Continue with Google
        </GoogleButton>

        <ToggleText>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <span onClick={handleToggleMode}>
            {isSignUp ? 'Log in here' : 'Sign up now'}
          </span>
        </ToggleText>
      </FormSection>
    </Container>
  );
};

export default WelcomePage;
