import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { ShoppingCart, Receipt, CreditCard, Clock, User } from 'lucide-react';
import { fetchRecentActivity } from '../../services/api';

const Feed = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const FeedItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #F0EEE8;

  &:last-child {
    border-bottom: none;
  }
`;

const IconBox = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${props =>
    props.$type === 'sales' ? '#F5EFEB' :
    props.$type === 'invoices' ? '#E8F0EC' : '#FFF0E0'};
  color: ${props =>
    props.$type === 'sales' ? '#6F240A' :
    props.$type === 'invoices' ? '#25432F' : '#875200'};
`;

const ActivityInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActivityLabel = styled.div`
  font-weight: 700;
  font-size: 0.85rem;
  color: #1C1C18;
`;

const ActivityMeta = styled.div`
  font-size: 0.75rem;
  color: #89726C;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
`;

const ActivityAmount = styled.div`
  font-weight: 800;
  font-size: 0.95rem;
  color: #6F240A;
  white-space: nowrap;
`;

const TypeTag = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: ${props =>
    props.$type === 'sales' ? '#F5EFEB' :
    props.$type === 'invoices' ? '#E8F0EC' : '#FFF0E0'};
  color: ${props =>
    props.$type === 'sales' ? '#6F240A' :
    props.$type === 'invoices' ? '#25432F' : '#875200'};
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const AdminActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRecentActivity(50);
        setActivities(data);
      } catch (err) {
        console.error('Failed to load activity', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const typeIcon = (type) => {
    switch (type) {
      case 'sales': return <ShoppingCart size={18} />;
      case 'invoices': return <Receipt size={18} />;
      case 'expenses': return <CreditCard size={18} />;
      default: return <Clock size={18} />;
    }
  };

  if (loading) return <p style={{ color: '#89726C' }}>Loading activity...</p>;

  return (
    <Feed>
      {activities.length === 0 ? (
        <Empty>No recent activity found.</Empty>
      ) : (
        activities.map((a, i) => (
          <FeedItem key={`${a.type}-${a.id}-${i}`}>
            <IconBox $type={a.type}>{typeIcon(a.type)}</IconBox>
            <ActivityInfo>
              <ActivityLabel>{a.label}</ActivityLabel>
              <ActivityMeta>
                <User size={11} />
                {a.businessName || a.userEmail || `User ${(a.userId || '').slice(0, 8)}`}
                <Clock size={11} />
                {a.date ? new Date(a.date).toLocaleString() : '—'}
              </ActivityMeta>
            </ActivityInfo>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              {a.amount && <ActivityAmount>{a.amount}</ActivityAmount>}
              <TypeTag $type={a.type}>{a.type}</TypeTag>
            </div>
          </FeedItem>
        ))
      )}
    </Feed>
  );
};

export default AdminActivity;
