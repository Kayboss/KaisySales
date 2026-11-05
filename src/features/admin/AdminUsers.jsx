import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Search, Mail, Calendar, ShoppingCart, CreditCard, ToggleLeft, ToggleRight, Briefcase, Store, Users, Package, DollarSign, LayoutGrid, List, Trash2, RotateCcw, UserX } from 'lucide-react';
import { fetchUsersWithStats, updateUserStatus, updateUserBusinessType, deactivateUser, restoreUser, purgeUser } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import SkeletonCards from '../../components/ui/SkeletonCards';
import SkeletonScreen from '../../components/ui/SkeletonScreen';
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

/**
 * Restore and "delete permanently" are different actions with different
 * colours on purpose: one is safe, the other throws records away.
 */
const DangerBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => props.$restore ? '#25432F' : '#BA1A1A'};
  background: ${props => props.$restore ? '#E8F0EC' : '#FFE8E8'};
  transition: all 0.15s ease;

  &:hover:not(:disabled) { opacity: 0.8; }

  &:disabled { opacity: 0.6; cursor: not-allowed; }
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
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: #D0C8C4;
    box-shadow: 0 4px 14px rgba(0,0,0,0.08);
  }
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

// The badge used to be derived from `last_sign_in_at` alone, so a suspended
// account still read "Active" and the admin had no way to tell that the action
// had landed. An admin-set state wins over the sign-in recency.
const getAccountStatus = (u) => {
  if (u.deletedAt) return { label: 'Deleted', status: 'deleted' };
  if (u.status === 'suspended') return { label: 'Suspended', status: 'suspended' };
  return getUserStatus(u.lastSignInAt);
};

/**
 * One set of account actions for both views. A deactivated account offers
 * Restore / Delete permanently; a live one offers Suspend / Deactivate.
 * Clicks stop here so they never open the detail drawer underneath.
 */
const AccountActions = ({ user, busy, onSuspend, onDeactivate, onRestore, onPurge }) => {
  const stop = (event) => event.stopPropagation();

  if (user.deletedAt) {
    return (
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }} onClick={stop}>
        <DangerBtn $restore disabled={busy} onClick={() => onRestore(user)}>
          <RotateCcw size={12} /> {busy ? 'Working...' : 'Restore'}
        </DangerBtn>
        <DangerBtn disabled={busy} onClick={() => onPurge(user)}>
          <Trash2 size={12} /> Delete permanently
        </DangerBtn>
      </div>
    );
  }

  const isSuspended = user.status === 'suspended';
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }} onClick={stop}>
      <ToggleBtn $suspended={isSuspended} disabled={busy} onClick={() => onSuspend(user)}>
        {isSuspended ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
        {busy ? 'Working...' : isSuspended ? 'Activate' : 'Suspend'}
      </ToggleBtn>
      <DangerBtn disabled={busy} onClick={() => onDeactivate(user)}>
        <UserX size={12} /> Deactivate
      </DangerBtn>
    </div>
  );
};

const AdminUsers = ({ onOpenUser }) => {
  const { currency } = useSettingsStore();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [btTogglingId, setBtTogglingId] = useState(null);
  const [actionError, setActionError] = useState(null);

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
    setActionError(null);
    const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateUserStatus(u.id, newStatus);
      await loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to update user status. Please try again.');
    }
    setTogglingId(null);
    setSuspendTarget(null);
  };

  const handleDeactivateUser = async (u) => {
    setTogglingId(u.id);
    setActionError(null);
    try {
      await deactivateUser(u.id);
      await loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to deactivate the account. Please try again.');
    }
    setTogglingId(null);
    setDeactivateTarget(null);
  };

  const handleRestoreUser = async (u) => {
    setTogglingId(u.id);
    setActionError(null);
    try {
      await restoreUser(u.id);
      await loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to restore the account. Please try again.');
    }
    setTogglingId(null);
    setRestoreTarget(null);
  };

  const handlePurgeUser = async (u) => {
    setTogglingId(u.id);
    setActionError(null);
    try {
      await purgeUser(u.id);
      await loadData();
    } catch (err) {
      // The database refuses an owner who still has active staff, and that
      // reason ("This owner still has 2 active team member(s)...") is the only
      // thing that tells the admin what to do next, so it is shown verbatim.
      setActionError(err.message || 'Failed to delete the account. Please try again.');
    }
    setTogglingId(null);
    setPurgeTarget(null);
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
    const account = getAccountStatus(u);
    // Soft-deleted accounts are hidden from every view except their own filter:
    // after "Delete" the account should disappear from the working list.
    if (statusFilter === 'all') return !u.deletedAt;
    if (statusFilter === 'deleted') return account.status === 'deleted';
    if (statusFilter === 'suspended') return account.status === 'suspended';
    return account.label.toLowerCase() === statusFilter;
  };

  const filtered = users.filter(u =>
    (typeFilter === 'all' || u.businessType === typeFilter) &&
    matchesStatus(u) &&
    (!search || (u.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <SkeletonScreen label="Loading users">
      <SkeletonCards count={6} $min="300px" />
    </SkeletonScreen>
  );

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
          <FilterBtn $active={statusFilter === 'deleted'} onClick={() => setStatusFilter('deleted')}>Deleted</FilterBtn>
        </FilterGroup>

        <ViewToggle>
          <ViewBtn $active={viewMode === 'cards'} onClick={() => setViewMode('cards')} title="Card view"><LayoutGrid size={16} /></ViewBtn>
          <ViewBtn $active={viewMode === 'list'} onClick={() => setViewMode('list')} title="List view"><List size={16} /></ViewBtn>
        </ViewToggle>
      </Toolbar>

      <SumRow>
        {['Active', 'Dormant', 'Churned', 'Never'].map(s => {
          const count = filtered.filter(u => getAccountStatus(u).label === s).length;
          return <SumPill key={s}>{s}: {count}</SumPill>;
        })}
      </SumRow>

      {actionError && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', background: '#FFE8E8',
          border: '1px solid #FFC7C7', borderRadius: '8px', color: '#BA1A1A',
          fontSize: '0.85rem', fontWeight: 600,
        }}>
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState>{search ? 'No users match your search.' : 'No users found.'}</EmptyState>
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
                const statusInfo = getAccountStatus(u);
                return (
                  <tr key={u.id} style={{ opacity: isSuspended ? 0.6 : 1, cursor: 'pointer' }} onClick={() => onOpenUser && onOpenUser(u)}>
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
                      <AccountActions
                        user={u}
                        busy={togglingId === u.id}
                        onSuspend={setSuspendTarget}
                        onDeactivate={setDeactivateTarget}
                        onRestore={setRestoreTarget}
                        onPurge={setPurgeTarget}
                      />
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
            const statusInfo = getAccountStatus(u);
            return (
              <UserCard key={u.id} $suspended={isSuspended} onClick={() => onOpenUser && onOpenUser(u)}>
                <CardHeader>
                  <div>
                    <CardName>{u.ownerName || '—'}</CardName>
                    <CardEmail><Mail size={11} /> {u.email || '—'}</CardEmail>
                  </div>
                  <StatusBadge $status={statusInfo.status}>{statusInfo.label}</StatusBadge>
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
                    onClick={(e) => { e.stopPropagation(); handleToggleBusinessType(u); }}
                  >
                    {btTogglingId === u.id ? '...' : u.businessType === 'services' ? <Briefcase size={14} /> : <Store size={14} />}
                    {btTogglingId === u.id ? 'Processing' : u.businessType === 'services' ? 'Services' : 'Retail'}
                  </TypeBtn>
                </ActionRow>

                {/* Account actions sit at the foot of the card so the header
                    keeps just the name and status, and a long row of buttons
                    cannot crowd the badge on a narrow card. */}
                <ActionRow style={{ borderTop: 'none', marginTop: 0, paddingTop: '0.4rem' }}>
                  <AccountActions
                    user={u}
                    busy={togglingId === u.id}
                    onSuspend={setSuspendTarget}
                    onDeactivate={setDeactivateTarget}
                    onRestore={setRestoreTarget}
                    onPurge={setPurgeTarget}
                  />
                </ActionRow>
              </UserCard>
            );
          })}
        </CardGrid>
      )}

      {suspendTarget && (
        <ConfirmDialog
          isOpen
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
      {deactivateTarget && (
        <ConfirmDialog
          isOpen
          title="Deactivate Account"
          message={`Deactivate ${deactivateTarget.ownerName || deactivateTarget.businessName || 'this user'}'s account? They are signed out and blocked from signing in, but every record is kept and you can restore the account from the Deleted filter.`}
          confirmLabel="Deactivate"
          onConfirm={() => handleDeactivateUser(deactivateTarget)}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
      {restoreTarget && (
        <ConfirmDialog
          isOpen
          title="Restore Account"
          message={`Restore ${restoreTarget.ownerName || restoreTarget.businessName || 'this user'}'s account? They will be able to sign in again with the same email and password.`}
          confirmLabel="Restore"
          onConfirm={() => handleRestoreUser(restoreTarget)}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
      {purgeTarget && (
        <ConfirmDialog
          isOpen
          title="Delete Permanently"
          message={`Permanently delete ${purgeTarget.ownerName || purgeTarget.businessName || 'this user'}? This removes the login, frees the email address and deletes their business records. It cannot be undone. If they own a business that still has active team members, remove or transfer those people first.`}
          confirmLabel="Delete permanently"
          onConfirm={() => handlePurgeUser(purgeTarget)}
          onCancel={() => setPurgeTarget(null)}
        />
      )}
    </div>
  );
};

export default AdminUsers;
