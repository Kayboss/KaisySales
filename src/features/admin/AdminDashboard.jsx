import { useState } from 'react';
import styled from 'styled-components';
import { Shield, Users, Activity, MessageSquare } from 'lucide-react';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminActivity from './AdminActivity';
import AdminSupport from './AdminSupport';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  color: #1C1C18;
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

  return (
    <Container>
      <Header>
        <div>
          <Title>Admin Dashboard</Title>
          <p style={{ color: '#55423D' }}>Manage users, monitor activity, and provide support.</p>
        </div>
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
  );
};

export default AdminDashboard;
