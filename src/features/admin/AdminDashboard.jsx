import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Shield, Users, Activity, Crown, LogOut, ArrowLeft, History, Inbox, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import AdminOverview from './AdminOverview';
import AdminInbox from './AdminInbox';
import AdminUsers from './AdminUsers';
import AdminActivity from './AdminActivity';
import AdminSubscriptions from './AdminSubscriptions';
import AdminAudit from './AdminAudit';
import AdminUserDetail from './AdminUserDetail';

const PageWrapper = styled.div`
  min-height: 100vh;
  background: #FCF9F3;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #1C1C18;
  color: #F5E6D3;

  @media (min-width: 768px) {
    padding: 1rem 2rem;
  }
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const BackBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #F5E6D3;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255,255,255,0.2);
  }
`;

const TopBarTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 800;
  font-size: 0.85rem;
  letter-spacing: 1px;

  @media (min-width: 768px) {
    gap: 0.5rem;
    font-size: 1rem;
  }
`;

const LogoutBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #F5E6D3;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255,255,255,0.2);
  }
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;

  @media (min-width: 768px) {
    padding: 2rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const RefreshBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  background: white;
  color: #55423D;
  font-weight: 700;
  font-size: 0.78rem;
  cursor: pointer;
  flex-shrink: 0;

  &:hover { border-color: #6F240A; }
`;

const Title = styled.h1`
  font-size: 1.35rem;
  color: #1C1C18;
  margin: 0;

  @media (min-width: 768px) {
    font-size: 1.75rem;
  }
`;

const Subtitle = styled.p`
  color: #55423D;
  margin: 0.25rem 0 0;
  font-size: 0.8rem;

  @media (min-width: 768px) {
    font-size: 0.9rem;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #F0EEE8;
  margin-bottom: 2rem;
  flex-wrap: wrap;

  @media (min-width: 768px) {
    gap: 0.5rem;
    overflow-x: auto;
    flex-wrap: nowrap;
  }
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  background: none;
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#6F240A' : 'transparent'};
  color: ${props => props.$active ? '#6F240A' : '#89726C'};
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;

  &:hover {
    color: #6F240A;
  }

  .tab-icon {
    display: none;
  }

  @media (min-width: 768px) {
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;

    .tab-icon {
      display: inline-flex;
    }
  }
`;

const TabBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  color: white;
  background: #BA1A1A;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
`;

const TABS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'audit', label: 'Audit', icon: History },
  { id: 'subscriptions', label: 'Subs', icon: Crown },
];

const TabPanel = styled.div`
  display: ${props => (props.$hidden ? 'none' : 'block')};
`;

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('inbox');
  // Tabs stay mounted once visited and are hidden with CSS when inactive, so
  // switching back shows the data already loaded instead of re-fetching it.
  const [visited, setVisited] = useState(() => new Set(['inbox']));
  const [reloadKey, setReloadKey] = useState(0);
  const [activeUser, setActiveUser] = useState(null);
  const [attentionCount, setAttentionCount] = useState(0);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const selectTab = (id) => {
    setActiveTab(id);
    setVisited(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  const openUser = (user, section = 'support') => setActiveUser({ user, section });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <PageWrapper>
      <TopBar>
        <TopBarLeft>
          <BackBtn onClick={() => navigate('/', { state: { adminView: true } })}>
            <ArrowLeft size={15} /> Back to App
          </BackBtn>
          <TopBarTitle>
            <Shield size={18} />
            Admin Panel
          </TopBarTitle>
        </TopBarLeft>
        <TopBarRight>
          <LogoutBtn onClick={handleLogout}>
            <LogOut size={15} /> Sign Out
          </LogoutBtn>
        </TopBarRight>
      </TopBar>

      <Container>
        <Header>
          <div>
            <Title>Admin Dashboard</Title>
            <Subtitle>Track down where users get stuck, then support them from one place.</Subtitle>
          </div>
          <RefreshBtn onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw size={14} /> Refresh
          </RefreshBtn>
        </Header>

        <Tabs>
          {TABS.map(tab => (
            <Tab key={tab.id} $active={activeTab === tab.id} onClick={() => selectTab(tab.id)}>
              <span className="tab-icon"><tab.icon size={18} /></span>
              {tab.label}
              {tab.id === 'inbox' && attentionCount > 0 && <TabBadge>{attentionCount}</TabBadge>}
            </Tab>
          ))}
        </Tabs>

        {TABS.map(tab => (visited.has(tab.id) ? (
          <TabPanel key={`${tab.id}-${reloadKey}`} $hidden={activeTab !== tab.id}>
            {tab.id === 'inbox' && <AdminInbox onOpenUser={openUser} onAttentionCount={setAttentionCount} />}
            {tab.id === 'overview' && <AdminOverview />}
            {tab.id === 'users' && <AdminUsers onOpenUser={openUser} />}
            {tab.id === 'activity' && <AdminActivity onOpenUser={openUser} />}
            {tab.id === 'audit' && <AdminAudit onOpenUser={openUser} />}
            {tab.id === 'subscriptions' && <AdminSubscriptions />}
          </TabPanel>
        ) : null))}
      </Container>

      {activeUser && (
        <AdminUserDetail
          user={activeUser.user}
          initialSection={activeUser.section}
          onClose={() => setActiveUser(null)}
        />
      )}
    </PageWrapper>
  );
};

export default AdminDashboard;
