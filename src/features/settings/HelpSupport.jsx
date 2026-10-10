import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { LifeBuoy, Send, CheckCircle, MessageSquare, Clock } from 'lucide-react';
import { createSupportRequest, fetchMySupportNotes } from '../../services/api';

const CATEGORIES = [
  { value: 'help', label: "I'm stuck and need help" },
  { value: 'bug', label: 'Something is broken' },
  { value: 'data', label: 'My figures look wrong' },
  { value: 'feedback', label: 'Feature idea or feedback' },
  { value: 'other', label: 'Something else' },
];

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.primary};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2rem;
  margin: 0 0 0.35rem;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  margin: 0;
  max-width: 40rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: white;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
`;

const CardTitle = styled.h2`
  font-size: 1.05rem;
  color: ${({ theme }) => theme.colors.text.main};
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Field = styled.div`
  margin-bottom: 1rem;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.main};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 130px;
  padding: 0.85rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.main};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(111, 36, 10, 0.1);
  }
`;

const ActionButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  padding: 0.85rem 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: none;
  font-weight: 700;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover { filter: brightness(1.12); }
  &:disabled { background: ${({ theme }) => theme.colors.text.muted}; cursor: not-allowed; }
`;

const SuccessBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #E8F0EC;
  color: #25432F;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 1rem;
`;

const Note = styled.div`
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: ${props => props.$fromAdmin ? '#F5EFEB' : '#F7F5F0'};
  margin-bottom: 0.75rem;
`;

const NoteHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
`;

const NoteAuthor = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
`;

const NoteTime = styled.span`
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.text.muted};
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
`;

const NoteText = styled.p`
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.text.main};
  margin: 0;
  line-height: 1.45;
  white-space: pre-wrap;
`;

const Badge = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  background: ${props => props.$tone === 'resolved' ? '#E8F0EC' : '#FFF0E0'};
  color: ${props => props.$tone === 'resolved' ? '#25432F' : '#875200'};
`;

const Empty = styled.div`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.88rem;
  text-align: center;
  padding: 2rem 1rem;
`;

const HelpSupport = () => {
  const location = useLocation();
  const [category, setCategory] = useState('help');
  const [message, setMessage] = useState(location.state?.prefill || '');
  const [notes, setNotes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = async () => {
    try {
      return await fetchMySupportNotes();
    } catch (err) {
      console.error('Failed to load your reports', err);
      return [];
    }
  };

  useEffect(() => {
    let active = true;
    loadNotes().then(data => { if (active) setNotes(data); });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await createSupportRequest({
        message: message.trim(),
        category,
        url: location.pathname,
      });
      setMessage('');
      setSubmitted(true);
      const data = await loadNotes();
      setNotes(data);
      setTimeout(() => setSubmitted(false), 6000);
    } catch (err) {
      setError('We could not send your report just now. Please try again, or email support@kaisysales.com.');
      console.error('Failed to submit report', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header>
        <Title>Get Help</Title>
        <Subtitle>
          Tell us what is going wrong or what you need, and the KaisySales team will
          see it right away. You can also always reach us at support@kaisysales.com.
        </Subtitle>
      </Header>

      <Grid>
        <Card>
          <CardTitle><LifeBuoy size={18} /> Report a problem</CardTitle>

          {submitted && (
            <SuccessBox>
              <CheckCircle size={18} /> Thanks — your report has been sent. We will follow up if we need more detail.
            </SuccessBox>
          )}
          {error && (
            <div style={{ color: '#BA1A1A', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <Field>
              <Label htmlFor="help-category">What is this about?</Label>
              <Select id="help-category" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label htmlFor="help-message">Describe the problem</Label>
              <Textarea
                id="help-message"
                placeholder="What were you trying to do, and what happened instead?"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </Field>

            <ActionButton type="submit" disabled={submitting || !message.trim()}>
              <Send size={16} />
              {submitting ? 'Sending...' : 'Send report'}
            </ActionButton>
          </form>
        </Card>

        <Card>
          <CardTitle><MessageSquare size={18} /> Your recent reports</CardTitle>
          {notes.length === 0 ? (
            <Empty>You have not reported anything yet.</Empty>
          ) : (
            notes.slice(0, 20).map(n => (
              <Note key={n.id} $fromAdmin={n.isFromAdmin}>
                <NoteHeader>
                  <NoteAuthor>{n.isFromAdmin ? 'KaisySales Support' : 'You'}</NoteAuthor>
                  <NoteTime><Clock size={10} /> {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</NoteTime>
                </NoteHeader>
                <NoteText>{n.message}</NoteText>
                {!n.isFromAdmin && n.status && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <Badge $tone={n.status === 'resolved' ? 'resolved' : 'open'}>
                      {n.status === 'resolved' ? 'Resolved' : 'Open'}
                    </Badge>
                  </div>
                )}
              </Note>
            ))
          )}
        </Card>
      </Grid>
    </>
  );
};

export default HelpSupport;
