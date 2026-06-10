import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MessageSquare, Send, Mail, User, Clock } from 'lucide-react';
import { fetchAllProfiles, fetchSupportNotes, createSupportNote } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const Layout = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.5rem;
  min-height: 400px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const UserList = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
`;

const UserListItem = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 0.85rem 1rem;
  border: none;
  border-bottom: 1px solid #F0EEE8;
  background: ${props => props.$active ? '#F5EFEB' : 'white'};
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;

  &:hover {
    background: #F5EFEB;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const UserName = styled.span`
  font-weight: 700;
  font-size: 0.85rem;
  color: #1C1C18;
`;

const UserEmail = styled.span`
  font-size: 0.75rem;
  color: #89726C;
`;

const SupportPanel = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #F0EEE8;
  font-weight: 800;
  color: #1C1C18;
  font-size: 0.95rem;
`;

const NotesList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  min-height: 250px;
`;

const Note = styled.div`
  padding: 0.75rem;
  border-radius: 8px;
  background: ${props => props.$fromAdmin ? '#F5EFEB' : '#F0EEE8'};
  margin-bottom: 0.75rem;
`;

const NoteHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
`;

const NoteAuthor = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #6F240A;
`;

const NoteTime = styled.span`
  font-size: 0.65rem;
  color: #89726C;
`;

const NoteText = styled.p`
  font-size: 0.85rem;
  color: #1C1C18;
  margin: 0;
  line-height: 1.4;
`;

const InputRow = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #F0EEE8;
`;

const Input = styled.input`
  flex: 1;
  border: 1px solid #D0C8C4;
  border-radius: 8px;
  padding: 0.7rem 1rem;
  font-size: 0.85rem;
  outline: none;

  &:focus {
    border-color: #6F240A;
  }
`;

const SendBtn = styled.button`
  background: #6F240A;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.7rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 0.85rem;
  transition: background 0.15s ease;

  &:hover {
    background: #5A1D08;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 250px;
  color: #89726C;
  text-align: center;
  gap: 0.5rem;
`;

const QuickActions = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0 1rem 0.75rem;
`;

const ActionBtn = styled.a`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  background: #F0EEE8;
  color: #55423D;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s ease;

  &:hover {
    background: #E0D8D4;
  }
`;

const AdminSupport = () => {
  const { user } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchAllProfiles().then(setProfiles).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) {
      fetchSupportNotes(selected.id).then(setNotes).catch(console.error);
    }
  }, [selected]);

  const handleSend = async () => {
    if (!message.trim() || !selected || !user) return;
    setSending(true);
    try {
      await createSupportNote({
        userId: selected.id,
        adminId: user.uid,
        message: message.trim(),
        isFromAdmin: true,
      });
      setMessage('');
      const updated = await fetchSupportNotes(selected.id);
      setNotes(updated);
    } catch (err) {
      console.error('Failed to send note', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout>
      <UserList>
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #F0EEE8', fontWeight: 700, fontSize: '0.8rem', color: '#89726C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Users ({profiles.length})
        </div>
        {profiles.map(p => (
          <UserListItem key={p.id} $active={selected?.id === p.id} onClick={() => setSelected(p)}>
            <UserName>{p.ownerName || p.businessName || 'Unnamed'}</UserName>
            <UserEmail>{p.email || '—'}</UserEmail>
          </UserListItem>
        ))}
      </UserList>

      <SupportPanel>
        {!selected ? (
          <EmptyState>
            <MessageSquare size={32} />
            <p style={{ fontWeight: 600 }}>Select a user to view or write support notes.</p>
          </EmptyState>
        ) : (
          <>
            <PanelHeader>
              {selected.ownerName || selected.businessName || 'User'}
              <span style={{ fontWeight: 400, color: '#89726C', fontSize: '0.8rem' }}> — {selected.email || '—'}</span>
            </PanelHeader>

            <QuickActions>
              <ActionBtn href={`mailto:${selected.email}`} target="_blank">
                <Mail size={13} /> Send Email
              </ActionBtn>
            </QuickActions>

            <NotesList>
              {notes.length === 0 ? (
                <EmptyState>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>No notes yet.</p>
                  <p style={{ fontSize: '0.8rem' }}>Write the first support note below.</p>
                </EmptyState>
              ) : (
                notes.map(n => (
                  <Note key={n.id} $fromAdmin={n.isFromAdmin}>
                    <NoteHeader>
                      <NoteAuthor>{n.isFromAdmin ? 'You (Admin)' : selected.ownerName || 'User'}</NoteAuthor>
                      <NoteTime><Clock size={10} /> {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</NoteTime>
                    </NoteHeader>
                    <NoteText>{n.message}</NoteText>
                  </Note>
                ))
              )}
            </NotesList>

            <InputRow>
              <Input
                placeholder="Write a support note..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <SendBtn onClick={handleSend} disabled={sending || !message.trim()}>
                <Send size={15} />
                {sending ? '...' : 'Send'}
              </SendBtn>
            </InputRow>
          </>
        )}
      </SupportPanel>
    </Layout>
  );
};

export default AdminSupport;
