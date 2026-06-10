import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Search, Mail, Calendar, Package, ShoppingCart, CreditCard, DollarSign } from 'lucide-react';
import { fetchUsersWithStats } from '../../services/api';

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

const Badge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props => props.$active ? '#25432F' : '#89726C'};
  background: ${props => props.$active ? '#E8F0EC' : '#F0EEE8'};
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

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchUsersWithStats();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load users', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
                <Th>Role</Th>
                <Th>Joined</Th>
                <Th>Sales</Th>
                <Th>Revenue</Th>
                <Th>Expenses</Th>
                <Th>Inventory</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
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
                    <Badge $active={u.role === 'admin'}>{u.role || 'user'}</Badge>
                  </Td>
                  <Td>
                    <StatCell>
                      <Calendar size={13} />
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
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
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
};

export default AdminUsers;
