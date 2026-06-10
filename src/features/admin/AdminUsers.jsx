import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Search, Mail, Calendar, Package, ShoppingCart, CreditCard, DollarSign, Clock, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { fetchUsersWithStats, updateUserStatus } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  margin-bottom: 1.5rem;
  max-width: 400px;
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.9rem;
  background: transparent;
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
`;

const Th = styled.th`
  text-align: left;
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #89726C;
  border-bottom: 2px solid #F0EEE8;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
  color: #1C1C18;
  border-bottom: 1px solid #F0EEE8;
  vertical-align: middle;
`;

const UserCell = styled.div`
  display: flex;
  flex-direction: column;
`;

const UserName = styled.span`
  font-weight: 700;
  color: #1C1C18;
`;

const UserEmail = styled.span`
  font-size: 0.75rem;
  color: #89726C;
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$active ? '#25432F' : '#BA1A1A'};
  margin-right: 0.35rem;
`;

const ToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => props.$suspended ? '#25432F' : '#BA1A1A'};
  background: ${props => props.$suspended ? '#E8F0EC' : '#FFE8E8'};
  transition: all 0.15s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const RoleBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props => props.$admin ? '#25432F' : '#89726C'};
  background: ${props => props.$admin ? '#E8F0EC' : '#F0EEE8'};
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props =>
    props.$status === 'active' ? '#25432F' :
    props.$status === 'dormant' ? '#875200' : '#BA1A1A'};
  background: ${props =>
    props.$status === 'active' ? '#E8F0EC' :
    props.$status === 'dormant' ? '#FFF0E0' : '#FFE8E8'};
`;

const StatCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  color: #55423D;
  font-size: 0.85rem;
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const getUserStatus = (lastSignInAt) => {
  if (!lastSignInAt) return { label: 'Never', status: 'churned' };
  const daysAgo = (Date.now() - new Date(lastSignInAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return { label: 'Active', status: 'active' };
  if (daysAgo <= 30) return { label: 'Dormant', status: 'dormant' };
  return { label: 'Churned', status: 'churned' };
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchUsersWithStats();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  useEffect(() => {
    loadData();
    setLoading(false);
  }, []);

  const handleToggleStatus = async (u) => {
    const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateUserStatus(u.id, newStatus);
      await loadData();
    } catch (err) {
      console.error('Failed to update user status', err);
    }
    setSuspendTarget(null);
  };

  const filtered = users.filter(u =>
    !search || (u.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p style={{ color: '#89726C' }}>Loading users...</p>;

  return (
    <div>
      <SearchBar>
        <Search size={18} color="#89726C" />
        <SearchInput placeholder="Search by name, business, or email..." value={search} onChange={e => setSearch(e.target.value)} />
      </SearchBar>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['Active', 'Dormant', 'Churned', 'Never'].map(s => {
          const count = filtered.filter(u => getUserStatus(u.lastSignInAt).label === s).length;
          return (
            <span key={s} style={{ fontSize: '0.8rem', color: '#55423D', background: '#F0EEE8', padding: '0.25rem 0.6rem', borderRadius: '20px', fontWeight: 600 }}>
              {s}: {count}
            </span>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          {search ? 'No users match your search.' : 'No users found.'}
        </Empty>
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Business</Th>
                <Th>Activity</Th>
                <Th>Last Active</Th>
                <Th>Sales</Th>
                <Th>Revenue</Th>
                <Th>Expenses</Th>
                <Th>Inventory</Th>
                <Th>Access</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const { label: statusLabel, status: statusType } = getUserStatus(u.lastSignInAt);
                const isSuspended = u.status === 'suspended';
                return (
                  <tr key={u.id} style={{ opacity: isSuspended ? 0.6 : 1 }}>
                    <Td>
                      <UserCell>
                        <UserName>{u.ownerName || '—'}</UserName>
                        <UserEmail><Mail size={11} /> {u.email || '—'}</UserEmail>
                      </UserCell>
                    </Td>
                    <Td>
                      <span style={{ fontWeight: 600 }}>{u.businessName || '—'}</span>
                    </Td>
                    <Td>
                      <StatusBadge $status={statusType}>
                        {statusType === 'churned' ? <AlertCircle size={11} /> : <Clock size={11} />}
                        {statusLabel}
                      </StatusBadge>
                    </Td>
                    <Td>
                      <StatCell>
                        <Calendar size={13} />
                        {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}
                      </StatCell>
                    </Td>
                    <Td>
                      <StatCell>
                        <ShoppingCart size={13} color="#6F240A" />
                        {u.salesCount || 0}
                      </StatCell>
                    </Td>
                    <Td>
                      <StatCell>
                        <DollarSign size={13} color="#25432F" />
                        GH₵{(u.salesRevenue || 0).toLocaleString()}
                      </StatCell>
                    </Td>
                    <Td>
                      <StatCell>
                        <CreditCard size={13} color="#BA1A1A" />
                        GH₵{(u.expenseTotal || 0).toLocaleString()}
                      </StatCell>
                    </Td>
                    <Td>
                      <StatCell>
                        <Package size={13} color="#875200" />
                        {u.inventoryCount || 0}
                      </StatCell>
                    </Td>
                    <Td>
                      <ToggleBtn
                        $suspended={isSuspended}
                        onClick={() => setSuspendTarget(u)}
                      >
                        {isSuspended ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                        {isSuspended ? 'Activate' : 'Suspend'}
                      </ToggleBtn>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      )}

      {suspendTarget && (
        <ConfirmDialog
          title={suspendTarget.status === 'suspended' ? 'Activate Account' : 'Suspend Account'}
          message={
            suspendTarget.status === 'suspended'
              ? `Activate ${suspendTarget.ownerName || suspendTarget.businessName || 'this user'}'s account? They will be able to sign in again.`
              : `Suspend ${suspendTarget.ownerName || suspendTarget.businessName || 'this user'}'s account? They will not be able to sign in until reactivated.`
          }
          confirmLabel={suspendTarget.status === 'suspended' ? 'Activate' : 'Suspend'}
          onConfirm={() => handleToggleStatus(suspendTarget)}
          onCancel={() => setSuspendTarget(null)}
        />
      )}
    </div>
  );
};

export default AdminUsers;
