import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Shield, Users, Activity, MessageSquare, LogOut, ArrowLeft, Leaf } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminActivity from './AdminActivity';
import AdminSupport from './AdminSupport';

const PageWrapper = styled.div`
  min-height: 100vh;
  background: #FCF9F3;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #1C1C18;
  color: #F5E6D3;
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
  gap: 0.5rem;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 1px;
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
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  color: #1C1C18;
  margin: 0;
`;

const Subtitle = styled.p`
  color: #55423D;
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #F0EEE8;
  margin-bottom: 2rem;
  overflow-x: auto;
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#6F240A' : 'transparent'};
  color: ${props => props.$active ? '#6F240A' : '#89726C'};
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;

  &:hover {
    color: #6F240A;
  }
`;

const TABS = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'support', label: 'Support', icon: MessageSquare },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <PageWrapper>
      <TopBar>
        <TopBarLeft>
          <BackBtn onClick={() => navigate('/')}>
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
          <Title>Admin Dashboard</Title>
          <Subtitle>Manage users, monitor activity, and provide support.</Subtitle>
        </Header>

        <Tabs>
          {TABS.map(tab => (
            <Tab key={tab.id} $active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              <tab.icon size={18} />
              {tab.label}
            </Tab>
          ))}
        </Tabs>

        {activeTab === 'overview' && <AdminOverview />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'activity' && <AdminActivity />}
        {activeTab === 'support' && <AdminSupport />}
      </Container>
    </PageWrapper>
  );
};

export default AdminDashboard;
