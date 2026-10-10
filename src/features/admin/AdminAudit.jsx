import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { PlusCircle, Pencil, Trash2, Clock, User, ChevronDown, ChevronUp, History } from 'lucide-react';
import { fetchUserActions } from '../../services/api';

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const FilterButton = styled.button`
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid ${props => props.$active ? '#6F240A' : '#D0C8C4'};
  background: ${props => props.$active ? '#6F240A' : 'white'};
  color: ${props => props.$active ? 'white' : '#55423D'};
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #6F240A;
  }
`;

const Search = styled.input`
  flex: 1;
  min-width: 160px;
  border: 1px solid #D0C8C4;
  border-radius: 999px;
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  outline: none;

  &:focus {
    border-color: #6F240A;
  }
`;

const Feed = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const Item = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #F0EEE8;
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};
  transition: background 0.15s ease;

  &:hover { background: ${props => props.$clickable ? '#FCF9F3' : 'transparent'}; }

  &:last-child { border-bottom: none; }
`;

const IconBox = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 9px;
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

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Entity = styled.span`
  font-weight: 800;
  font-size: 0.85rem;
  color: #1C1C18;
`;

const ActionTag = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.12rem 0.4rem;
  border-radius: 4px;
  background: ${props =>
    props.$action === 'insert' ? '#E8F0EC' :
    props.$action === 'delete' ? '#FBE9E7' : '#FFF0E0'};
  color: ${props =>
    props.$action === 'insert' ? '#25432F' :
    props.$action === 'delete' ? '#BA1A1A' : '#875200'};
`;

const Meta = styled.div`
  font-size: 0.72rem;
  color: #89726C;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
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

const Details = styled.pre`
  margin: 0.5rem 0 0;
  padding: 0.6rem;
  background: #F7F5F0;
  border-radius: 8px;
  font-size: 0.68rem;
  line-height: 1.4;
  color: #55423D;
  overflow-x: auto;
  max-height: 220px;
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const ACTION_LABEL = { insert: 'Created', update: 'Updated', delete: 'Deleted' };
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'insert', label: 'Created' },
  { id: 'update', label: 'Updated' },
  { id: 'delete', label: 'Deleted' },
];

const prettifyEntity = (entity) =>
  String(entity || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const actionIcon = (action) => {
  if (action === 'insert') return <PlusCircle size={17} />;
  if (action === 'delete') return <Trash2 size={17} />;
  return <Pencil size={17} />;
};

// A short human summary of the row snapshot, so the operator can tell one
// expense from another without opening the raw JSON.
const summarise = (details) => {
  if (!details || typeof details !== 'object') return null;
  const bits = [];
  const label = details.title || details.name || details.item || details.client_name || details.message;
  if (label) bits.push(String(label).slice(0, 60));
  const amount = details.amount || details.total;
  if (amount != null && amount !== '') bits.push(String(amount));
  return bits.length ? bits.join(' · ') : null;
};

const AdminAudit = ({ onOpenUser }) => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchUserActions(100);
        setActions(data);
      } catch (err) {
        console.error('Failed to load user actions', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = actions.filter((a) => {
    if (filter !== 'all' && a.action !== filter) return false;
    if (!query.trim()) return true;
    const hay = `${a.entity} ${a.userEmail || ''} ${a.userBusinessName || ''} ${summarise(a.details) || ''}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  if (loading) return <p style={{ color: '#89726C' }}>Loading audit trail...</p>;

  return (
    <>
      <Toolbar>
        {FILTERS.map(f => (
          <FilterButton key={f.id} $active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </FilterButton>
        ))}
        <Search
          placeholder="Filter by user, business or entity..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </Toolbar>

      <Feed>
        {filtered.length === 0 ? (
          <Empty>
            <History size={28} style={{ marginBottom: '0.5rem' }} />
            <div>No audit entries match.</div>
          </Empty>
        ) : (
          filtered.map(a => {
            const open = expanded === a.id;
            const summary = summarise(a.details);
            const openUser = a.userId && onOpenUser
              ? () => onOpenUser({ id: a.userId, email: a.userEmail, businessName: a.userBusinessName }, 'audit')
              : undefined;
            return (
              <Item key={a.id} $clickable={!!openUser} onClick={openUser}>
                <IconBox $action={a.action}>{actionIcon(a.action)}</IconBox>
                <Body>
                  <Line>
                    <Entity>{prettifyEntity(a.entity)}</Entity>
                    <ActionTag $action={a.action}>{ACTION_LABEL[a.action] || a.action}</ActionTag>
                    {summary && <span style={{ fontSize: '0.78rem', color: '#55423D' }}>{summary}</span>}
                  </Line>
                  <Meta>
                    <User size={11} />
                    {a.userBusinessName || a.userEmail || `User ${(a.userId || '').slice(0, 8)}`}
                    <Clock size={11} />
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}
                    {a.entityId != null && <span style={{ color: '#C0B8B4' }}>#{String(a.entityId).slice(0, 12)}</span>}
                  </Meta>
                  {a.details && Object.keys(a.details).length > 0 && (
                    <>
                      <DetailsToggle onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : a.id); }}>
                        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {open ? 'Hide details' : 'Show details'}
                      </DetailsToggle>
                      {open && <Details>{JSON.stringify(a.details, null, 2)}</Details>}
                    </>
                  )}
                </Body>
              </Item>
            );
          })
        )}
      </Feed>
    </>
  );
};

export default AdminAudit;
