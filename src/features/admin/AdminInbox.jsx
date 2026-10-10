import { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Inbox, MessageSquare, Bug, UserX, ChevronRight, Clock, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { fetchOpenSupportRequests, fetchErrorLogs, fetchAllProfiles } from '../../services/api';

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;

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
  background: #FFF0E0;
  color: #875200;
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

const Empty = styled.div`
  text-align: center;
  padding: 2.5rem 1rem;
  color: #89726C;
  font-size: 0.85rem;
  background: white;
  border: 1px solid #F0EEE8;
  border-radius: 12px;

  svg { margin-bottom: 0.5rem; }
`;

const Loading = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const shorten = (value) => (value ? new Date(value).toLocaleString() : '—');

const countAttention = (reports, errors, profiles) => {
  const errorUsers = new Set(errors.map(e => e.userId).filter(Boolean));
  const neverSignedIn = profiles.filter(p => !p.lastSignInAt).length;
  return reports.length + errorUsers.size + neverSignedIn;
};

const AdminInbox = ({ onOpenUser, onAttentionCount }) => {
  const [reports, setReports] = useState([]);
  const [errors, setErrors] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [r, e, p] = await Promise.all([
          fetchOpenSupportRequests(100),
          fetchErrorLogs(50),
          fetchAllProfiles(),
        ]);
        if (!active) return;
        setReports(r);
        setErrors(e);
        setProfiles(p);
        if (onAttentionCount) onAttentionCount(countAttention(r, e, p));
      } catch (err) {
        console.error('Failed to load inbox', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [onAttentionCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [r, e, p] = await Promise.all([
        fetchOpenSupportRequests(100),
        fetchErrorLogs(50),
        fetchAllProfiles(),
      ]);
      setReports(r);
      setErrors(e);
      setProfiles(p);
      if (onAttentionCount) onAttentionCount(countAttention(r, e, p));
    } catch (err) {
      console.error('Failed to refresh inbox', err);
    } finally {
      setRefreshing(false);
    }
  };

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  const profileOf = (uid) => profileMap[uid] || { id: uid };

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

  const neverSignedIn = profiles.filter(p => !p.lastSignInAt);

  if (loading) return <Loading>Loading inbox...</Loading>;

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
          <Empty><CheckCircle2 size={26} /><div>No open reports. All clear.</div></Empty>
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
          <Bug size={16} /> Recent errors
          <CountPill>{errorsByUser.length}</CountPill>
        </SectionHeader>
        {errorsByUser.length === 0 ? (
          <Empty><CheckCircle2 size={26} /><div>No errors recorded.</div></Empty>
        ) : (
          <RowCard>
            {errorsByUser.map(group => (
              <Row
                key={group.userId || 'unknown'}
                onClick={() => onOpenUser(profileOf(group.userId), 'errors')}
              >
                <RowIcon $tone="error"><Bug size={17} /></RowIcon>
                <RowBody>
                  <RowTitle>
                    {profileOf(group.userId).businessName || profileOf(group.userId).email || `User ${(group.userId || '').slice(0, 8)}`}
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
          <Empty><CheckCircle2 size={26} /><div>Every user has signed in at least once.</div></Empty>
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
    </div>
  );
};

export default AdminInbox;
