import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Search, Mail, Calendar, Package, ShoppingCart, CreditCard, ToggleLeft, ToggleRight } from 'lucide-react';
import { fetchUsersWithStats, updateUserStatus } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatCurrencyShort } from '../../utils/currency';
import { useSettingsStore } from '../../store/settingsStore';

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  margin-bottom: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-sizing: border-box;
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

  @media (max-width: 768px) {
    display: none;
  }
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

  &:hover:not(:disabled) {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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

const MobileCardGrid = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const UserCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  opacity: ${props => props.$suspended ? 0.6 : 1};
`;

const CardRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.82rem;
  border-bottom: 1px solid #F5F3F0;

  &:last-child { border-bottom: none; }
`;

const CardLabel = styled.span`
  color: #89726C;
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const CardValue = styled.span`
  font-weight: 700;
  color: #1C1C18;
  text-align: right;
`;

const getUserStatus = (lastSignInAt) => {
  if (!lastSignInAt) return { label: 'Never', status: 'churned' };
  const daysAgo = (Date.now() - new Date(lastSignInAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return { label: 'Active', status: 'active' };
  if (daysAgo <= 30) return { label: 'Dormant', status: 'dormant' };
  return { label: 'Churned', status: 'churned' };
};

const AdminUsers = () => {
  const { currency } = useSettingsStore();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchUsersWithStats();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    init();
  }, []);

  const handleToggleStatus = async (u) => {
    setTogglingId(u.id);
    const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateUserStatus(u.id, newStatus);
      await loadData();
    } catch (err) {
      console.error('Failed to update user status', err);
    }
    setTogglingId(null);
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
        <>
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Business</Th>
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
                          {formatCurrencyShort(u.salesRevenue || 0, currency)}
                        </StatCell>
                      </Td>
                      <Td>
                        <StatCell>
                          <CreditCard size={13} color="#BA1A1A" />
                          {formatCurrencyShort(u.expenseTotal || 0, currency)}
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
                          disabled={togglingId === u.id}
                          onClick={() => setSuspendTarget(u)}
                        >
                          {togglingId === u.id ? '...' : isSuspended ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                          {togglingId === u.id ? 'Processing' : isSuspended ? 'Activate' : 'Suspend'}
                        </ToggleBtn>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>

          <MobileCardGrid>
            {filtered.map(u => {
              const isSuspended = u.status === 'suspended';
              const statusInfo = getUserStatus(u.lastSignInAt);
              return (
                <UserCard key={u.id} $suspended={isSuspended}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1C1C18' }}>{u.ownerName || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#89726C' }}>{u.email || '—'}</div>
                    </div>
                    <ToggleBtn
                      $suspended={isSuspended}
                      disabled={togglingId === u.id}
                      onClick={() => setSuspendTarget(u)}
                    >
                      {togglingId === u.id ? '...' : isSuspended ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                      {togglingId === u.id ? 'Processing' : isSuspended ? 'Activate' : 'Suspend'}
                    </ToggleBtn>
                  </div>
                  <CardRow>
                    <CardLabel>Business</CardLabel>
                    <CardValue>{u.businessName || '—'}</CardValue>
                  </CardRow>
                  <CardRow>
                    <CardLabel>Last Active</CardLabel>
                    <CardValue>{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}</CardValue>
                  </CardRow>
                  <CardRow>
                    <CardLabel>Sales</CardLabel>
                    <CardValue>{u.salesCount || 0}</CardValue>
                  </CardRow>
                  <CardRow>
                    <CardLabel>Revenue</CardLabel>
                    <CardValue>{formatCurrencyShort(u.salesRevenue || 0, currency)}</CardValue>
                  </CardRow>
                  <CardRow>
                    <CardLabel>Expenses</CardLabel>
                    <CardValue>{formatCurrencyShort(u.expenseTotal || 0, currency)}</CardValue>
                  </CardRow>
                  <CardRow>
                    <CardLabel>Inventory</CardLabel>
                    <CardValue>{u.inventoryCount || 0}</CardValue>
                  </CardRow>
                  <CardRow>
                    <CardLabel>Status</CardLabel>
                    <CardValue>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '20px',
                        color: statusInfo.status === 'active' ? '#25432F' : statusInfo.status === 'dormant' ? '#875200' : '#BA1A1A',
                        background: statusInfo.status === 'active' ? '#E8F0EC' : statusInfo.status === 'dormant' ? '#FFF0E0' : '#FFE8E8'
                      }}>
                        {statusInfo.label}
                      </span>
                    </CardValue>
                  </CardRow>
                </UserCard>
              );
            })}
          </MobileCardGrid>
        </>
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
