import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Search, Mail, Calendar, ShoppingCart, CreditCard, ToggleLeft, ToggleRight, Briefcase, Store, Users, Package, DollarSign, LayoutGrid, List } from 'lucide-react';
import { fetchUsersWithStats, updateUserStatus, updateUserBusinessType } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatCurrencyShort } from '../../utils/currency';
import { useSettingsStore } from '../../store/settingsStore';

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  max-width: 320px;
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

const FilterGroup = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
`;

const FilterBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  border: 1px solid ${props => props.$active ? '#6F240A' : '#D0C8C4'};
  background: ${props => props.$active ? '#6F240A' : 'white'};
  color: ${props => props.$active ? 'white' : '#55423D'};
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { border-color: #6F240A; }
`;

const ViewToggle = styled.div`
  display: flex;
  gap: 0;
  margin-left: auto;
  border: 1px solid #D0C8C4;
  border-radius: 6px;
  overflow: hidden;
`;

const ViewBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.6rem;
  border: none;
  background: ${props => props.$active ? '#F5EFEB' : 'white'};
  color: ${props => props.$active ? '#6F240A' : '#89726C'};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { background: #F5EFEB; }
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

  &:hover:not(:disabled) { opacity: 0.8; }

  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
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

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.65rem;
`;

const CardName = styled.div`
  font-weight: 700;
  font-size: 0.9rem;
  color: #1C1C18;
`;

const CardEmail = styled.div`
  font-size: 0.75rem;
  color: #89726C;
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
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const CardValue = styled.span`
  font-weight: 700;
  color: #1C1C18;
  text-align: right;
`;

const StatusBadge = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  color: ${props =>
    props.$status === 'active' ? '#25432F' :
    props.$status === 'dormant' ? '#875200' : '#BA1A1A'};
  background: ${props =>
    props.$status === 'active' ? '#E8F0EC' :
    props.$status === 'dormant' ? '#FFF0E0' : '#FFE8E8'};
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.4rem;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid #F0EEE8;
`;

const TypeBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props => props.$services ? '#25432F' : '#6F240A'};
  background: ${props => props.$services ? '#E8F0EC' : '#F5EFEB'};
  transition: all 0.15s ease;
  flex: 1;
  justify-content: center;

  &:hover:not(:disabled) { opacity: 0.8; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// ---- List View Styles ----

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
  min-width: 800px;
`;

const Th = styled.th`
  text-align: left;
  padding: 0.75rem 0.85rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #89726C;
  border-bottom: 2px solid #F0EEE8;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.65rem 0.85rem;
  font-size: 0.8rem;
  color: #1C1C18;
  border-bottom: 1px solid #F0EEE8;
  vertical-align: middle;
`;

const SumRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const SumPill = styled.span`
  font-size: 0.8rem;
  color: #55423D;
  background: #F0EEE8;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-weight: 600;
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
  const [viewMode, setViewMode] = useState('cards');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [btTogglingId, setBtTogglingId] = useState(null);

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

  const handleToggleBusinessType = async (u) => {
    setBtTogglingId(u.id);
    const newType = u.businessType === 'services' ? 'retail' : 'services';
    try {
      await updateUserBusinessType(u.id, newType);
      await loadData();
    } catch (err) {
      console.error('Failed to update business type', err);
    }
    setBtTogglingId(null);
  };

  const matchesStatus = (u) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'suspended') return u.status === 'suspended';
    return getUserStatus(u.lastSignInAt).label.toLowerCase() === statusFilter;
  };

  const filtered = users.filter(u =>
    (typeFilter === 'all' || u.businessType === typeFilter) &&
    matchesStatus(u) &&
    (!search || (u.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <p style={{ color: '#89726C' }}>Loading users...</p>;

  return (
    <div>
      <Toolbar>
        <SearchBar>
          <Search size={18} color="#89726C" />
          <SearchInput placeholder="Search by name, business, or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </SearchBar>

        <FilterGroup>
          <FilterBtn $active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</FilterBtn>
          <FilterBtn $active={typeFilter === 'retail'} onClick={() => setTypeFilter('retail')}><Store size={14} /> Retail</FilterBtn>
          <FilterBtn $active={typeFilter === 'services'} onClick={() => setTypeFilter('services')}><Briefcase size={14} /> Services</FilterBtn>
        </FilterGroup>

        <FilterGroup>
          <FilterBtn $active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterBtn>
          <FilterBtn $active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Active</FilterBtn>
          <FilterBtn $active={statusFilter === 'dormant'} onClick={() => setStatusFilter('dormant')}>Dormant</FilterBtn>
          <FilterBtn $active={statusFilter === 'churned'} onClick={() => setStatusFilter('churned')}>Churned</FilterBtn>
          <FilterBtn $active={statusFilter === 'suspended'} onClick={() => setStatusFilter('suspended')}>Suspended</FilterBtn>
        </FilterGroup>

        <ViewToggle>
          <ViewBtn $active={viewMode === 'cards'} onClick={() => setViewMode('cards')} title="Card view"><LayoutGrid size={16} /></ViewBtn>
          <ViewBtn $active={viewMode === 'list'} onClick={() => setViewMode('list')} title="List view"><List size={16} /></ViewBtn>
        </ViewToggle>
      </Toolbar>

      <SumRow>
        {['Active', 'Dormant', 'Churned', 'Never'].map(s => {
          const count = filtered.filter(u => getUserStatus(u.lastSignInAt).label === s).length;
          return <SumPill key={s}>{s}: {count}</SumPill>;
        })}
      </SumRow>

      {filtered.length === 0 ? (
        <Empty>{search ? 'No users match your search.' : 'No users found.'}</Empty>
      ) : viewMode === 'list' ? (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Business</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Sales</Th>
                <Th>Revenue</Th>
                <Th>Expenses</Th>
                <Th>Customers</Th>
                <Th>Service Inc.</Th>
                <Th>Last Active</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isSuspended = u.status === 'suspended';
                const statusInfo = getUserStatus(u.lastSignInAt);
                return (
                  <tr key={u.id} style={{ opacity: isSuspended ? 0.6 : 1 }}>
                    <Td>
                      <div style={{ fontWeight: 700 }}>{u.ownerName || '—'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#89726C' }}>{u.email || '—'}</div>
                    </Td>
                    <Td><span style={{ fontWeight: 600 }}>{u.businessName || '—'}</span></Td>
                    <Td>{u.businessType === 'services' ? <Briefcase size={15} /> : <Store size={15} />}</Td>
                    <Td><StatusBadge $status={statusInfo.status}>{statusInfo.label}</StatusBadge></Td>
                    <Td>{u.salesCount || 0}</Td>
                    <Td style={{ fontWeight: 700 }}>{formatCurrencyShort(u.salesRevenue || 0, currency)}</Td>
                    <Td>{formatCurrencyShort(u.expenseTotal || 0, currency)}</Td>
                    <Td>{u.customerCount || 0}</Td>
                    <Td>{formatCurrencyShort(u.serviceIncomeTotal || 0, currency)}</Td>
                    <Td style={{ fontSize: '0.75rem', color: '#55423D' }}>
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <ToggleBtn
                          $suspended={isSuspended}
                          disabled={togglingId === u.id}
                          onClick={() => setSuspendTarget(u)}
                          style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}
                        >
                          {togglingId === u.id ? '...' : isSuspended ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                          {togglingId === u.id ? 'Processing' : isSuspended ? 'Activate' : 'Suspend'}
                        </ToggleBtn>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      ) : (
        <CardGrid>
          {filtered.map(u => {
            const isSuspended = u.status === 'suspended';
            const statusInfo = getUserStatus(u.lastSignInAt);
            return (
              <UserCard key={u.id} $suspended={isSuspended}>
                <CardHeader>
                  <div>
                    <CardName>{u.ownerName || '—'}</CardName>
                    <CardEmail><Mail size={11} /> {u.email || '—'}</CardEmail>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <StatusBadge $status={statusInfo.status}>{statusInfo.label}</StatusBadge>
                    <ToggleBtn
                      $suspended={isSuspended}
                      disabled={togglingId === u.id}
                      onClick={() => setSuspendTarget(u)}
                      style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}
                    >
                      {togglingId === u.id ? '...' : isSuspended ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                      {togglingId === u.id ? 'Processing' : isSuspended ? 'Activate' : 'Suspend'}
                    </ToggleBtn>
                  </div>
                </CardHeader>

                <CardRow>
                  <CardLabel><Briefcase size={13} /> Business</CardLabel>
                  <CardValue>{u.businessName || '—'}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><Calendar size={13} /> Last Active</CardLabel>
                  <CardValue>{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><ShoppingCart size={13} /> Sales</CardLabel>
                  <CardValue>{u.salesCount || 0}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><DollarSign size={13} /> Revenue</CardLabel>
                  <CardValue>{formatCurrencyShort(u.salesRevenue || 0, currency)}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><CreditCard size={13} /> Expenses</CardLabel>
                  <CardValue>{formatCurrencyShort(u.expenseTotal || 0, currency)}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><Package size={13} /> Inventory</CardLabel>
                  <CardValue>{u.inventoryCount || 0}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><Users size={13} /> Customers</CardLabel>
                  <CardValue>{u.customerCount || 0}</CardValue>
                </CardRow>
                <CardRow>
                  <CardLabel><Briefcase size={13} /> Service Inc.</CardLabel>
                  <CardValue>{formatCurrencyShort(u.serviceIncomeTotal || 0, currency)}</CardValue>
                </CardRow>

                <ActionRow>
                  <TypeBtn
                    $services={u.businessType === 'services'}
                    disabled={btTogglingId === u.id}
                    onClick={() => handleToggleBusinessType(u)}
                  >
                    {btTogglingId === u.id ? '...' : u.businessType === 'services' ? <Briefcase size={14} /> : <Store size={14} />}
                    {btTogglingId === u.id ? 'Processing' : u.businessType === 'services' ? 'Services' : 'Retail'}
                  </TypeBtn>
                </ActionRow>
              </UserCard>
            );
          })}
        </CardGrid>
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
