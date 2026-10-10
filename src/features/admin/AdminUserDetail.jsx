import { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  X, Mail, Briefcase, Store, Calendar, Clock, ToggleLeft, ToggleRight,
  Send, CheckCircle2, RotateCcw, PlusCircle, Pencil, Trash2, Bug, ShoppingCart,
  Receipt, CreditCard, Users, ChevronDown, ChevronUp, History, Activity as ActivityIcon,
  MessageSquare, DollarSign, Package, AlertCircle,
} from 'lucide-react';
import {
  fetchUsersWithStats, fetchSupportNotes, createSupportNote, updateSupportNoteStatus,
  updateUserStatus, updateUserBusinessType, fetchUserActions, fetchErrorLogs, fetchRecentActivity,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrencyShort } from '../../utils/currency';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-end;
  z-index: 1200;
`;

const Panel = styled.div`
  width: min(580px, 100%);
  height: 100%;
  background: #FCF9F3;
  display: flex;
  flex-direction: column;
  box-shadow: -12px 0 40px rgba(0,0,0,0.18);
  animation: slideIn 0.22s ease-out;

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

const PanelHeader = styled.div`
  padding: 1.25rem 1.25rem 1rem;
  background: white;
  border-bottom: 1px solid #F0EEE8;
  flex-shrink: 0;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
`;

const Avatar = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.1rem;
  color: white;
  background: ${props => props.$color || '#6F240A'};
`;

const HeaderInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const Name = styled.div`
  font-weight: 800;
  font-size: 1.05rem;
  color: #1C1C18;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Email = styled.div`
  font-size: 0.8rem;
  color: #89726C;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.15rem;
  word-break: break-word;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: #89726C;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 50%;
  flex-shrink: 0;

  &:hover { background: #F5F3F0; }
`;

const Badges = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: ${props =>
    props.$tone === 'services' || props.$tone === 'active' ? '#E8F0EC' :
    props.$tone === 'retail' ? '#F5EFEB' :
    props.$tone === 'suspended' ? '#FFE8E8' : '#F0EEE8'};
  color: ${props =>
    props.$tone === 'services' || props.$tone === 'active' ? '#25432F' :
    props.$tone === 'retail' ? '#6F240A' :
    props.$tone === 'suspended' ? '#BA1A1A' : '#55423D'};
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-top: 1rem;

  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Stat = styled.div`
  background: #FCF9F3;
  border: 1px solid #F0EEE8;
  border-radius: 10px;
  padding: 0.5rem 0.6rem;
`;

const StatLabel = styled.div`
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #89726C;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const StatValue = styled.div`
  font-weight: 800;
  font-size: 0.9rem;
  color: #1C1C18;
  margin-top: 0.15rem;
`;

const ActionsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
`;

const ActionBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  border: none;
  background: #F0EEE8;
  color: #55423D;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;

  &:hover { background: #E4DFD8; }
`;

const ToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => props.$active ? '#25432F' : '#BA1A1A'};
  background: ${props => props.$active ? '#E8F0EC' : '#FFE8E8'};

  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const TypeBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => props.$services ? '#25432F' : '#6F240A'};
  background: ${props => props.$services ? '#E8F0EC' : '#F5EFEB'};

  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const SectionNav = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.6rem 1.25rem;
  background: white;
  border-bottom: 1px solid #F0EEE8;
  flex-shrink: 0;
  overflow-x: auto;
`;

const SectionTab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  border: 1px solid ${props => props.$active ? '#6F240A' : 'transparent'};
  background: ${props => props.$active ? '#6F240A' : '#F5F3F0'};
  color: ${props => props.$active ? 'white' : '#55423D'};
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
`;

const Empty = styled.div`
  text-align: center;
  padding: 2.5rem 1rem;
  color: #89726C;
  font-size: 0.85rem;

  svg { margin-bottom: 0.5rem; }
`;

const Note = styled.div`
  padding: 0.75rem;
  border-radius: 10px;
  background: ${props => props.$fromAdmin ? '#F5EFEB' : 'white'};
  border: 1px solid #F0EEE8;
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
  font-weight: 800;
  color: #6F240A;
`;

const NoteTime = styled.span`
  font-size: 0.65rem;
  color: #89726C;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
`;

const NoteText = styled.p`
  font-size: 0.85rem;
  color: #1C1C18;
  margin: 0;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
`;

const NoteBadges = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.45rem;
`;

const ResolveBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.5rem;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: 1px solid ${props => props.$resolved ? '#D0C8C4' : '#25432F'};
  background: ${props => props.$resolved ? 'white' : '#25432F'};
  color: ${props => props.$resolved ? '#55423D' : 'white'};
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ReplyRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
  position: sticky;
  bottom: 0;
  background: #FCF9F3;
  padding-top: 0.5rem;
`;

const Input = styled.input`
  flex: 1;
  border: 1px solid #D0C8C4;
  border-radius: 8px;
  padding: 0.65rem 0.9rem;
  font-size: 0.85rem;
  outline: none;

  &:focus { border-color: #6F240A; }
`;

const SendBtn = styled.button`
  background: #6F240A;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.65rem 1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.85rem;

  &:hover { background: #5A1D08; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const FeedRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  background: white;
  border: 1px solid #F0EEE8;
  border-radius: 10px;
  margin-bottom: 0.5rem;
`;

const IconBox = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${props =>
    props.$action === 'insert' ? '#E8F0EC' :
    props.$action === 'delete' ? '#FBE9E7' : '#FFF0E0'};
  color: ${props =>
    props.$action === 'insert' ? '#25432F' :
    props.$action === 'delete' ? '#BA1A1A' : '#875200'};
`;

const FeedBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const FeedTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-weight: 800;
  font-size: 0.82rem;
  color: #1C1C18;
`;

const ActionTag = styled.span`
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: ${props =>
    props.$action === 'insert' ? '#E8F0EC' :
    props.$action === 'delete' ? '#FBE9E7' : '#FFF0E0'};
  color: ${props =>
    props.$action === 'insert' ? '#25432F' :
    props.$action === 'delete' ? '#BA1A1A' : '#875200'};
`;

const FeedMeta = styled.div`
  font-size: 0.7rem;
  color: #89726C;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
`;

const Summary = styled.span`
  font-size: 0.75rem;
  color: #55423D;
  font-weight: 500;
`;

const DetailsToggle = styled.button`
  background: none;
  border: none;
  color: #6F240A;
  font-weight: 700;
  font-size: 0.7rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0;
  margin-top: 0.35rem;
`;

const DetailsBox = styled.pre`
  margin: 0.5rem 0 0;
  padding: 0.6rem 0.75rem;
  background: #1C1C18;
  color: #F0EEE8;
  border-radius: 8px;
  font-size: 0.68rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
`;

const Loading = styled.div`
  text-align: center;
  padding: 2rem;
  color: #89726C;
  font-size: 0.85rem;
`;

const SECTIONS = [
  { id: 'support', label: 'Support', icon: MessageSquare },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
  { id: 'audit', label: 'Audit', icon: History },
  { id: 'errors', label: 'Errors', icon: Bug },
];

const ACTION_LABEL = { insert: 'Created', update: 'Updated', delete: 'Deleted' };

const prettifyEntity = (entity) =>
  String(entity || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const actionIcon = (action) => {
  if (action === 'insert') return <PlusCircle size={16} />;
  if (action === 'delete') return <Trash2 size={16} />;
  return <Pencil size={16} />;
};

const ACTIVITY_ICON = {
  sales: ShoppingCart,
  invoices: Receipt,
  expenses: CreditCard,
  customers: Users,
  service_income: Briefcase,
  recurring_income: RotateCcw,
};

const summarise = (details) => {
  if (!details || typeof details !== 'object') return null;
  const bits = [];
  const label = details.title || details.name || details.item || details.client_name || details.message;
  if (label) bits.push(String(label).slice(0, 60));
  const amount = details.amount || details.total;
  if (amount != null && amount !== '') bits.push(String(amount));
  return bits.length ? bits.join(' · ') : null;
};

const shortenDate = (value) => (value ? new Date(value).toLocaleString() : '—');

const AdminUserDetail = ({ user, initialSection = 'support', onClose }) => {
  const { id, salesCount } = user;
  const { currency } = useSettingsStore();
  const { user: admin } = useAuthStore();

  const [profile, setProfile] = useState(user);
  const [section, setSection] = useState(initialSection);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [audit, setAudit] = useState([]);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (salesCount !== undefined) return;
    let active = true;
    const load = async () => {
      try {
        const all = await fetchUsersWithStats();
        const found = all.find(p => p.id === id);
        if (found && active) setProfile(prev => ({ ...prev, ...found }));
      } catch (err) {
        console.error('Failed to load user profile', err);
      }
    };
    load();
    return () => { active = false; };
  }, [id, salesCount]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setSectionLoading(true);
      try {
        if (section === 'support') {
          const d = await fetchSupportNotes(id);
          if (active) setNotes(d);
        } else if (section === 'activity') {
          const d = await fetchRecentActivity(30, id);
          if (active) setActivity(d);
        } else if (section === 'audit') {
          const d = await fetchUserActions(50, id);
          if (active) setAudit(d);
        } else if (section === 'errors') {
          const d = await fetchErrorLogs(30, id);
          if (active) setErrors(d);
        }
      } catch (err) {
        console.error('Failed to load user section', err);
      } finally {
        if (active) setSectionLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [section, id]);

  const displayName = profile.ownerName || profile.businessName || profile.userBusinessName || profile.email || 'User';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const isSuspended = profile.status === 'suspended';

  const handleSend = async () => {
    if (!message.trim() || !admin) return;
    setSending(true);
    try {
      await createSupportNote({
        userId: id,
        adminId: admin.uid,
        message: message.trim(),
        isFromAdmin: true,
      });
      setMessage('');
      const updated = await fetchSupportNotes(id);
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

  const handleToggleNote = async (note) => {
    const next = note.status === 'resolved' ? 'open' : 'resolved';
    setExpanded(`resolving-${note.id}`);
    try {
      await updateSupportNoteStatus(note.id, next);
      const updated = await fetchSupportNotes(id);
      setNotes(updated);
    } catch (err) {
      console.error('Failed to update note status', err);
    } finally {
      setExpanded(null);
    }
  };

  const handleToggleStatus = async () => {
    setBusy(true);
    try {
      await updateUserStatus(id, isSuspended ? 'active' : 'suspended');
      setProfile(prev => ({ ...prev, status: isSuspended ? 'active' : 'suspended' }));
    } catch (err) {
      console.error('Failed to update user status', err);
    } finally {
      setBusy(false);
      setConfirmSuspend(false);
    }
  };

  const handleToggleType = async () => {
    setBusy(true);
    const next = profile.businessType === 'services' ? 'retail' : 'services';
    try {
      await updateUserBusinessType(id, next);
      setProfile(prev => ({ ...prev, businessType: next }));
    } catch (err) {
      console.error('Failed to update business type', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <PanelHeader>
          <HeaderTop>
            <Avatar $color={profile.avatarColor}>{initial}</Avatar>
            <HeaderInfo>
              <Name>{displayName}</Name>
              <Email><Mail size={12} /> {profile.email || '—'}</Email>
            </HeaderInfo>
            <CloseBtn onClick={onClose} aria-label="Close"><X size={20} /></CloseBtn>
          </HeaderTop>

          <Badges>
            {profile.businessType && (
              <Badge $tone={profile.businessType}>
                {profile.businessType === 'services' ? <Briefcase size={11} /> : <Store size={11} />}
                {profile.businessType}
              </Badge>
            )}
            {profile.status && (
              <Badge $tone={profile.status === 'suspended' ? 'suspended' : 'active'}>
                {profile.status}
              </Badge>
            )}
            {profile.createdAt && (
              <Badge><Calendar size={11} /> joined {new Date(profile.createdAt).toLocaleDateString()}</Badge>
            )}
          </Badges>

          {salesCount !== undefined && (
            <StatsRow>
              <Stat>
                <StatLabel><ShoppingCart size={11} /> Sales</StatLabel>
                <StatValue>{profile.salesCount || 0}</StatValue>
              </Stat>
              <Stat>
                <StatLabel><DollarSign size={11} /> Revenue</StatLabel>
                <StatValue>{formatCurrencyShort(profile.salesRevenue || 0, currency)}</StatValue>
              </Stat>
              <Stat>
                <StatLabel><Package size={11} /> Inventory</StatLabel>
                <StatValue>{profile.inventoryCount || 0}</StatValue>
              </Stat>
              <Stat>
                <StatLabel><Users size={11} /> Customers</StatLabel>
                <StatValue>{profile.customerCount || 0}</StatValue>
              </Stat>
            </StatsRow>
          )}

          <ActionsRow>
            <ActionBtn href={`mailto:${profile.email}`} target="_blank" rel="noreferrer">
              <Mail size={14} /> Email
            </ActionBtn>
            <ToggleBtn $active={isSuspended} disabled={busy} onClick={() => setConfirmSuspend(true)}>
              {isSuspended ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
              {isSuspended ? 'Activate' : 'Suspend'}
            </ToggleBtn>
            <TypeBtn $services={profile.businessType === 'services'} disabled={busy} onClick={handleToggleType}>
              {profile.businessType === 'services' ? <Briefcase size={14} /> : <Store size={14} />}
              Switch to {profile.businessType === 'services' ? 'retail' : 'services'}
            </TypeBtn>
          </ActionsRow>
        </PanelHeader>

        <SectionNav>
          {SECTIONS.map(s => (
            <SectionTab key={s.id} $active={section === s.id} onClick={() => setSection(s.id)}>
              <s.icon size={14} />
              {s.label}
            </SectionTab>
          ))}
        </SectionNav>

        <Body>
          {sectionLoading ? (
            <Loading>Loading {section}...</Loading>
          ) : section === 'support' ? (
            <>
              {notes.length === 0 ? (
                <Empty><MessageSquare size={26} /><div>No support notes yet.</div></Empty>
              ) : (
                notes.map(n => (
                  <Note key={n.id} $fromAdmin={n.isFromAdmin}>
                    <NoteHeader>
                      <NoteAuthor>{n.isFromAdmin ? 'Admin reply' : displayName}</NoteAuthor>
                      <NoteTime><Clock size={10} /> {shortenDate(n.createdAt)}</NoteTime>
                    </NoteHeader>
                    <NoteText>{n.message}</NoteText>
                    {!n.isFromAdmin && (
                      <>
                        <NoteBadges>
                          {n.category && <Badge>{n.category}</Badge>}
                          <Badge $tone={n.status === 'resolved' ? 'active' : 'suspended'}>
                            {n.status === 'resolved' ? 'Resolved' : 'Open'}
                          </Badge>
                          {n.url && <span style={{ fontSize: '0.68rem', color: '#89726C' }}>on {n.url}</span>}
                        </NoteBadges>
                        <ResolveBtn
                          $resolved={n.status === 'resolved'}
                          disabled={expanded === `resolving-${n.id}`}
                          onClick={() => handleToggleNote(n)}
                        >
                          {n.status === 'resolved'
                            ? <><RotateCcw size={12} /> Reopen</>
                            : <><CheckCircle2 size={12} /> Mark resolved</>}
                        </ResolveBtn>
                      </>
                    )}
                  </Note>
                ))
              )}
              <ReplyRow>
                <Input
                  placeholder="Write a reply..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <SendBtn onClick={handleSend} disabled={sending || !message.trim()}>
                  <Send size={15} />
                  {sending ? '...' : 'Send'}
                </SendBtn>
              </ReplyRow>
            </>
          ) : section === 'activity' ? (
            activity.length === 0 ? (
              <Empty><ActivityIcon size={26} /><div>No recorded activity.</div></Empty>
            ) : (
              activity.map(item => {
                const Icon = ACTIVITY_ICON[item.type] || ActivityIcon;
                return (
                  <FeedRow key={`${item.type}-${item.id}`}>
                    <IconBox $action="insert"><Icon size={16} /></IconBox>
                    <FeedBody>
                      <FeedTitle>
                        {prettifyEntity(item.type)}
                        {item.label && <Summary>{item.label}</Summary>}
                      </FeedTitle>
                      <FeedMeta>
                        <Clock size={11} />
                        {shortenDate(item.date)}
                        {item.amount != null && item.amount !== '' && (
                          <span style={{ color: '#55423D', fontWeight: 700 }}>{String(item.amount)}</span>
                        )}
                      </FeedMeta>
                    </FeedBody>
                  </FeedRow>
                );
              })
            )
          ) : section === 'audit' ? (
            audit.length === 0 ? (
              <Empty><History size={26} /><div>No audit entries for this user.</div></Empty>
            ) : (
              audit.map(a => {
                const open = expanded === a.id;
                const summary = summarise(a.details);
                return (
                  <FeedRow key={a.id}>
                    <IconBox $action={a.action}>{actionIcon(a.action)}</IconBox>
                    <FeedBody>
                      <FeedTitle>
                        {prettifyEntity(a.entity)}
                        <ActionTag $action={a.action}>{ACTION_LABEL[a.action] || a.action}</ActionTag>
                        {summary && <Summary>{summary}</Summary>}
                      </FeedTitle>
                      <FeedMeta>
                        <Clock size={11} />
                        {shortenDate(a.createdAt)}
                        {a.entityId != null && <span style={{ color: '#C0B8B4' }}>#{String(a.entityId).slice(0, 12)}</span>}
                      </FeedMeta>
                      {a.details && Object.keys(a.details).length > 0 && (
                        <>
                          <DetailsToggle onClick={() => setExpanded(open ? null : a.id)}>
                            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {open ? 'Hide details' : 'Show details'}
                          </DetailsToggle>
                          {open && <DetailsBox>{JSON.stringify(a.details, null, 2)}</DetailsBox>}
                        </>
                      )}
                    </FeedBody>
                  </FeedRow>
                );
              })
            )
          ) : (
            errors.length === 0 ? (
              <Empty><Bug size={26} /><div>No errors recorded for this user.</div></Empty>
            ) : (
              errors.map(e => (
                <FeedRow key={e.id}>
                  <IconBox $action="delete"><AlertCircle size={16} /></IconBox>
                  <FeedBody>
                    <FeedTitle style={{ color: '#BA1A1A' }}>{e.error}</FeedTitle>
                    <FeedMeta>
                      <Clock size={11} />
                      {shortenDate(e.createdAt)}
                      {e.page && <span>on {e.page}</span>}
                    </FeedMeta>
                    {(e.details?.stack || e.details?.userAgent) && (
                      <>
                        <DetailsToggle onClick={() => setExpanded(expanded === `err-${e.id}` ? null : `err-${e.id}`)}>
                          {expanded === `err-${e.id}` ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {expanded === `err-${e.id}` ? 'Hide details' : 'Show stack & browser'}
                        </DetailsToggle>
                        {expanded === `err-${e.id}` && (
                          <DetailsBox>
                            {e.details?.stack || 'No stack captured.'}
                            {e.details?.userAgent ? `\n\nBrowser: ${e.details.userAgent}` : ''}
                            {e.details?.viewport ? `\nViewport: ${e.details.viewport}` : ''}
                          </DetailsBox>
                        )}
                      </>
                    )}
                  </FeedBody>
                </FeedRow>
              ))
            )
          )}
        </Body>
      </Panel>

      {confirmSuspend && (
        <ConfirmDialog
          title={isSuspended ? 'Activate Account' : 'Suspend Account'}
          message={
            isSuspended
              ? `Activate ${displayName}'s account? They will be able to sign in again.`
              : `Suspend ${displayName}'s account? They will not be able to sign in until reactivated.`
          }
          confirmLabel={isSuspended ? 'Activate' : 'Suspend'}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmSuspend(false)}
          confirmLoading={busy}
        />
      )}
    </Overlay>
  );
};

export default AdminUserDetail;
