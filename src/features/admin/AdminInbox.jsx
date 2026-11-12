import { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Inbox, MessageSquare, Bug, UserX, ChevronRight, Clock, RefreshCw, CheckCircle2, Mail, Trash2,
} from 'lucide-react';
import {
  fetchOpenSupportRequests, fetchErrorLogs, fetchNeverSignedInUsers, fetchStaffUserIds,
  fetchContactMessages, updateContactMessageStatus, deleteContactMessage,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  inboxStorage, readLastSeen, writeLastSeen, summariseUnseen,
} from '../../utils/adminInboxSeen';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SkeletonCards from '../../components/ui/SkeletonCards';
import SkeletonScreen from '../../components/ui/SkeletonScreen';
import SkeletonTable from '../../components/ui/SkeletonTable';

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  background: white;
  border: 1px solid #F0EEE8;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: border-color 0.15s ease;

  &:hover { border-color: #D0C8C4; }
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${props =>
    props.$tone === 'reports' ? '#FFF0E0' :
    props.$tone === 'errors' ? '#FBE9E7' : '#F5EFEB'};
  color: ${props =>
    props.$tone === 'reports' ? '#875200' :
    props.$tone === 'errors' ? '#BA1A1A' : '#6F240A'};
`;

const StatText = styled.div`
  min-width: 0;
`;

const StatNumber = styled.div`
  font-size: 1.4rem;
  font-weight: 800;
  color: #1C1C18;
  line-height: 1.1;
`;

const StatLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #89726C;
`;

const Section = styled.section`
  margin-bottom: 1.75rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-weight: 800;
  font-size: 0.95rem;
  color: #1C1C18;
`;

const CountPill = styled.span`
  font-size: 0.68rem;
  font-weight: 800;
  color: #55423D;
  background: #F0EEE8;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
`;

const Spacer = styled.div`
  flex: 1;
`;

const RefreshBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  background: white;
  color: #55423D;
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover { border-color: #6F240A; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RowCard = styled.div`
  background: white;
  border: 1px solid #F0EEE8;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
`;

const Row = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.85rem 1rem;
  border: none;
  border-bottom: 1px solid #F0EEE8;
  background: white;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover { background: #FCF9F3; }
  &:last-child { border-bottom: none; }
`;

const RowIcon = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${props =>
    props.$tone === 'report' ? '#FFF0E0' :
    props.$tone === 'error' ? '#FBE9E7' : '#F5EFEB'};
  color: ${props =>
    props.$tone === 'report' ? '#875200' :
    props.$tone === 'error' ? '#BA1A1A' : '#6F240A'};
`;

const RowBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowTitle = styled.div`
  font-weight: 700;
  font-size: 0.85rem;
  color: #1C1C18;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: ${props => (props.$muted ? '#F0EEE8' : '#FFF0E0')};
  color: ${props => (props.$muted ? '#55423D' : '#875200')};
`;

const RowPreview = styled.div`
  font-size: 0.78rem;
  color: #55423D;
  margin-top: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RowMeta = styled.div`
  font-size: 0.7rem;
  color: #89726C;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
`;

const Chevron = styled(ChevronRight)`
  color: #C0B8B4;
  flex-shrink: 0;
  margin-top: 0.35rem;
`;

/* A contact-form message has no account to open, so its row is not a button:
   it carries its own action instead of navigating to a user drawer. */
const MessageRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #F0EEE8;
  background: ${props => (props.$closed ? '#FAF9F7' : 'white')};

  &:last-child { border-bottom: none; }
`;

const ActionBtn = styled.button`
  flex-shrink: 0;
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  border: 1px solid ${({ $danger }) => ($danger ? '#E8C4C4' : '#D0C8C4')};
  background: white;
  color: ${({ $danger }) => ($danger ? '#BA1A1A' : '#55423D')};
  font-weight: 700;
  font-size: 0.72rem;
  cursor: pointer;
  white-space: nowrap;

  &:hover { border-color: ${({ $danger }) => ($danger ? '#BA1A1A' : '#6F240A')}; }
`;

/* The row's actions stack, so a narrow screen keeps both reachable. */
const RowActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
`;

const MailLink = styled.a`
  color: #6F240A;
  font-weight: 600;
  text-decoration: underline;
`;

const SUBJECT_LABELS = {
  general: 'General',
  account: 'Account',
  billing: 'Billing',
  technical: 'Technical',
  privacy: 'Privacy',
  data: 'Data',
};

const shorten = (value) => (value ? new Date(value).toLocaleString() : '—');

/**
 * A cashier's login has its own profile, so without this the Inbox lists "users
 * with errors" that are not businesses of their own (the owner's dashboard is
 * where those belong). Support reports are deliberately NOT filtered: a person
 * asking for help is a person, whether they own the shop or work in it.
 */
const withoutStaff = (rows, staffIds) =>
  (rows || []).filter((row) => !staffIds.has(row.userId || row.id));

/**
 * One pass over the three feeds, plus the stamp they will be judged against.
 *
 * `lastSeenAt` is read *before* the fetch and written *after* the result has
 * been rendered (see the callers), so the count is always "what arrived since
 * the last time this inbox was on screen" and never "what I am looking at
 * right now".
 */
const loadInbox = async ({ storage, uid }) => {
  const lastSeenAt = readLastSeen(storage, uid);
  const [reports, rawErrors, rawNeverSignedIn, staffIds, contactMessages] = await Promise.all([
    fetchOpenSupportRequests(100),
    fetchErrorLogs(50),
    fetchNeverSignedInUsers(200),
    fetchStaffUserIds(),
    fetchContactMessages(100),
  ]);
  return {
    reports,
    errors: withoutStaff(rawErrors, staffIds),
    neverSignedIn: withoutStaff(rawNeverSignedIn, staffIds),
    contactMessages,
    lastSeenAt,
  };
};

const AdminInbox = ({ onOpenUser, onAttentionCount }) => {
  const uid = useAuthStore((s) => s.user?.uid);
  const storage = inboxStorage();
  const [reports, setReports] = useState([]);
  const [errors, setErrors] = useState([]);
  const [neverSignedIn, setNeverSignedIn] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const result = await loadInbox({ storage, uid });
        if (!isCurrent) return;
        setReports(result.reports);
        setErrors(result.errors);
        setNeverSignedIn(result.neverSignedIn);
        setContactMessages(result.contactMessages);
        // Stamp only now: everything in `result` is on screen, so it must not
        // badge again on a later visit. Reading it is what clears the badge.
        writeLastSeen(storage, uid);
        if (onAttentionCount) onAttentionCount(summariseUnseen(result).total);
      } catch (err) {
        console.error('Failed to load inbox', err);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    load();
    return () => { isCurrent = false; };
  }, [onAttentionCount, storage, uid]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await loadInbox({ storage, uid });
      setReports(result.reports);
      setErrors(result.errors);
      setNeverSignedIn(result.neverSignedIn);
      setContactMessages(result.contactMessages);
      writeLastSeen(storage, uid);
      // Only what arrived since the previous load is new — pressing Refresh
      // must not resurrect a count the admin has already read.
      if (onAttentionCount) onAttentionCount(summariseUnseen(result).total);
    } catch (err) {
      console.error('Failed to refresh inbox', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleContactStatus = async (message, status) => {
    try {
      const updated = await updateContactMessageStatus(message.id, status);
      setContactMessages(prev =>
        prev.map(m => (m.id === message.id ? { ...m, ...updated } : m))
      );
    } catch (err) {
      console.error('Failed to update contact message', err);
    }
  };

  /**
   * Deleting is the one irreversible action here, so it goes through
   * ConfirmDialog and only leaves the list once the database has agreed.
   * `pendingDelete` doubles as the dialog's `isOpen` — ConfirmDialog returns
   * null for a falsy prop, so a dialog rendered without one never appears.
   */
  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await deleteContactMessage(target.id);
      setContactMessages(prev => prev.filter(m => m.id !== target.id));
      setPendingDelete(null);
    } catch (err) {
      console.error('Failed to delete contact message', err);
    } finally {
      setDeleting(false);
    }
  };

  const errorsByUser = Object.values(
    errors.reduce((acc, e) => {
      const key = e.userId || 'unknown';
      if (!acc[key]) acc[key] = { userId: e.userId, count: 0, latest: e };
      acc[key].count++;
      if (new Date(e.createdAt || 0) > new Date(acc[key].latest.createdAt || 0)) {
        acc[key].latest = e;
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.latest.createdAt || 0) - new Date(a.latest.createdAt || 0));

  const labelOf = (entry) =>
    entry?.businessName || entry?.userBusinessName || entry?.email || entry?.userEmail || null;

  const newContactCount = contactMessages.filter(m => m.status === 'new').length;

  if (loading) return (
    <SkeletonScreen label="Loading inbox">
      <SkeletonCards count={3} $min="280px" />
      <SkeletonTable rows={6} cols={3} />
    </SkeletonScreen>
  );

  return (
    <div>
      <StatRow>
        <StatCard onClick={handleRefresh}>
          <StatIcon $tone="reports"><MessageSquare size={20} /></StatIcon>
          <StatText>
            <StatNumber>{reports.length}</StatNumber>
            <StatLabel>Open reports</StatLabel>
          </StatText>
        </StatCard>
        <StatCard onClick={handleRefresh}>
          <StatIcon $tone="reports"><Mail size={20} /></StatIcon>
          <StatText>
            <StatNumber>{newContactCount}</StatNumber>
            <StatLabel>New messages</StatLabel>
          </StatText>
        </StatCard>
        <StatCard onClick={handleRefresh}>
          <StatIcon $tone="errors"><Bug size={20} /></StatIcon>
          <StatText>
            <StatNumber>{errorsByUser.length}</StatNumber>
            <StatLabel>Users with errors</StatLabel>
          </StatText>
        </StatCard>
        <StatCard onClick={handleRefresh}>
          <StatIcon $tone="never"><UserX size={20} /></StatIcon>
          <StatText>
            <StatNumber>{neverSignedIn.length}</StatNumber>
            <StatLabel>Never signed in</StatLabel>
          </StatText>
        </StatCard>
      </StatRow>

      <Section>
        <SectionHeader>
          <Inbox size={16} /> Open support reports
          <CountPill>{reports.length}</CountPill>
          <Spacer />
          <RefreshBtn onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={13} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </RefreshBtn>
        </SectionHeader>
        {reports.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={26} />}>No open reports. All clear.</EmptyState>
        ) : (
          <RowCard>
            {reports.map(r => (
              <Row
                key={r.id}
                onClick={() => onOpenUser(
                  { id: r.userId, email: r.userEmail, businessName: r.userBusinessName },
                  'support'
                )}
              >
                <RowIcon $tone="report"><MessageSquare size={17} /></RowIcon>
                <RowBody>
                  <RowTitle>
                    {r.userBusinessName || r.userEmail || `User ${(r.userId || '').slice(0, 8)}`}
                    {r.category && <Tag>{r.category}</Tag>}
                  </RowTitle>
                  <RowPreview>{r.message}</RowPreview>
                  <RowMeta>
                    <Clock size={11} /> {shorten(r.createdAt)}
                    {r.url && <span>on {r.url}</span>}
                  </RowMeta>
                </RowBody>
                <Chevron size={18} />
              </Row>
            ))}
          </RowCard>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <Mail size={16} /> Contact messages
          <CountPill>{contactMessages.length}</CountPill>
          <Spacer />
          <RefreshBtn onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={13} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </RefreshBtn>
        </SectionHeader>
        {contactMessages.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={26} />}>No messages from the contact form yet.</EmptyState>
        ) : (
          <RowCard>
            {contactMessages.map(m => (
              <MessageRow key={m.id} $closed={m.status === 'closed'}>
                <RowIcon $tone="report"><Mail size={17} /></RowIcon>
                <RowBody>
                  <RowTitle>
                    {m.name || 'Unnamed sender'}
                    <Tag>{SUBJECT_LABELS[m.subject] || m.subject || 'General'}</Tag>
                    {m.status !== 'new' && <Tag $muted>{m.status}</Tag>}
                  </RowTitle>
                  <RowPreview>{m.message}</RowPreview>
                  <RowMeta>
                    <Clock size={11} /> {shorten(m.createdAt)}
                    {m.email && (
                      <MailLink href={`mailto:${m.email}`}>{m.email}</MailLink>
                    )}
                    {m.sourcePage && <span>from {m.sourcePage}</span>}
                  </RowMeta>
                </RowBody>
                <RowActions>
                  <ActionBtn
                    type="button"
                    onClick={() => handleContactStatus(m, m.status === 'closed' ? 'new' : 'closed')}
                  >
                    {m.status === 'closed' ? 'Reopen' : 'Mark closed'}
                  </ActionBtn>
                  <ActionBtn
                    type="button"
                    $danger
                    onClick={() => setPendingDelete(m)}
                    aria-label={`Delete the message from ${m.name || 'this sender'}`}
                  >
                    <Trash2 size={12} /> Delete
                  </ActionBtn>
                </RowActions>
              </MessageRow>
            ))}
          </RowCard>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <Bug size={16} /> Recent errors
          <CountPill>{errorsByUser.length}</CountPill>
        </SectionHeader>
        {errorsByUser.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={26} />}>No errors recorded.</EmptyState>
        ) : (
          <RowCard>
            {errorsByUser.map(group => (
              <Row
                key={group.userId || 'unknown'}
                onClick={() => onOpenUser(
                  { id: group.userId, email: group.latest.userEmail, businessName: group.latest.userBusinessName },
                  'errors'
                )}
              >
                <RowIcon $tone="error"><Bug size={17} /></RowIcon>
                <RowBody>
                  <RowTitle>
                    {labelOf(group.latest) || `User ${(group.userId || '').slice(0, 8)}`}
                    <Tag>{group.count} error{group.count > 1 ? 's' : ''}</Tag>
                  </RowTitle>
                  <RowPreview>{group.latest.error}</RowPreview>
                  <RowMeta>
                    <Clock size={11} /> latest {shorten(group.latest.createdAt)}
                  </RowMeta>
                </RowBody>
                <Chevron size={18} />
              </Row>
            ))}
          </RowCard>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <UserX size={16} /> Never signed in
          <CountPill>{neverSignedIn.length}</CountPill>
        </SectionHeader>
        {neverSignedIn.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={26} />}>Every user has signed in at least once.</EmptyState>
        ) : (
          <RowCard>
            {neverSignedIn.map(p => (
              <Row key={p.id} onClick={() => onOpenUser(p, 'activity')}>
                <RowIcon $tone="never"><UserX size={17} /></RowIcon>
                <RowBody>
                  <RowTitle>{p.ownerName || p.businessName || p.email || 'Unnamed user'}</RowTitle>
                  <RowPreview>{p.email || '—'}</RowPreview>
                  <RowMeta>
                    {p.createdAt && <><Clock size={11} /> joined {new Date(p.createdAt).toLocaleDateString()}</>}
                  </RowMeta>
                </RowBody>
                <Chevron size={18} />
              </Row>
            ))}
          </RowCard>
        )}
      </Section>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete this message?"
        message={
          pendingDelete
            ? `The message from ${pendingDelete.name || 'this sender'} and their email address will be removed for good. Marking it closed keeps it if you might need it.`
            : ''
        }
        confirmLabel="Delete message"
        confirmLoading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
      />
    </div>
  );
};

export default AdminInbox;
