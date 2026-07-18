import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Users, TrendingUp, ShoppingCart, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAllProfiles, fetchRecentActivity, fetchUsersWithStats, fetchVisitStats } from '../../services/api';
import { formatCurrencyShort } from '../../utils/currency';
import { useSettingsStore } from '../../store/settingsStore';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const StatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${props => props.$bg || '#F5EFEB'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$color || '#6F240A'};
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #89726C;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 900;
  color: #1C1C18;
  letter-spacing: -0.5px;
`;

const StatTrend = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${props => props.$positive ? '#25432F' : '#BA1A1A'};
  margin-top: 0.25rem;
`;

const ChartCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  margin-bottom: 2rem;
`;

const ChartTitle = styled.h3`
  font-size: 1rem;
  font-weight: 800;
  color: #1C1C18;
  margin-bottom: 1rem;
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 800;
  color: #1C1C18;
  margin: 1.5rem 0 0.75rem;
`;

const StatusRow = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;

const StatusPill = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  background: ${props =>
    props.$status === 'active' ? '#E8F0EC' :
    props.$status === 'dormant' ? '#FFF0E0' : '#FFE8E8'};
  color: ${props =>
    props.$status === 'active' ? '#25432F' :
    props.$status === 'dormant' ? '#875200' : '#BA1A1A'};
  font-weight: 700;
  font-size: 0.85rem;
`;

const ThreeCol = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 1.5rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const InsightCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const InsightTitle = styled.h4`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #89726C;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #F0EEE8;
`;

const InsightUser = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  font-size: 0.82rem;
  border-bottom: 1px solid #F5F3F0;

  &:last-child { border-bottom: none; }
`;

const InsightName = styled.span`
  font-weight: 600;
  color: #1C1C18;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const InsightValue = styled.span`
  font-weight: 800;
  color: #6F240A;
  font-size: 0.82rem;
  white-space: nowrap;
  margin-left: 0.5rem;
`;

const UserStatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props =>
    props.$status === 'active' ? '#25432F' :
    props.$status === 'dormant' ? '#875200' : '#BA1A1A'};
  flex-shrink: 0;
`;

const getUserStatus = (lastSignInAt) => {
  if (!lastSignInAt) return 'churned';
  const daysAgo = (Date.now() - new Date(lastSignInAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return 'active';
  if (daysAgo <= 30) return 'dormant';
  return 'churned';
};

const AdminOverview = () => {
  const { currency } = useSettingsStore();
  const [profiles, setProfiles] = useState([]);
  const [usersWithStats, setUsersWithStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [visitStats, setVisitStats] = useState({ deviceData: [], locationData: [], dailyVisits: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, u, a, v] = await Promise.all([
          fetchAllProfiles(),
          fetchUsersWithStats(),
          fetchRecentActivity(20),
          fetchVisitStats(),
        ]);
        setProfiles(p);
        setUsersWithStats(u);
        setRecentActivity(a);
        setVisitStats(v);
      } catch (err) {
        console.error('Failed to load overview data', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalUsers = profiles.length;
  const activeUsers = profiles.filter(p => getUserStatus(p.lastSignInAt) === 'active').length;
  const dormantUsers = profiles.filter(p => getUserStatus(p.lastSignInAt) === 'dormant').length;
  const churnedUsers = profiles.filter(p => getUserStatus(p.lastSignInAt) === 'churned').length;

  const newThisMonth = profiles.filter(p => {
    const d = new Date(p.createdAt || 0);
    return d >= thirtyDaysAgo;
  }).length;
  const newThisWeek = profiles.filter(p => {
    const d = new Date(p.createdAt || 0);
    return d >= sevenDaysAgo;
  }).length;

  const signedUpToday = profiles.filter(p => {
    const d = new Date(p.createdAt || 0);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const activityCount = recentActivity.length;
  const recentSales = recentActivity.filter(a => a.type === 'sales' || a.type === 'service_income').length;

  const chartData = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayLabel = dayNames[d.getDay()];
    const count = profiles.filter(p => {
      const pd = new Date(p.createdAt || 0);
      return pd.toDateString() === d.toDateString();
    }).length;
    chartData.push({ day: dayLabel, signups: count });
  }

  const topRevenue = [...usersWithStats]
    .sort((a, b) => ((b.salesRevenue || 0) + (b.serviceIncomeTotal || 0)) - ((a.salesRevenue || 0) + (a.serviceIncomeTotal || 0)))
    .slice(0, 5);

  const activeUserList = profiles
    .filter(p => getUserStatus(p.lastSignInAt) === 'active')
    .sort((a, b) => new Date(b.lastSignInAt || 0) - new Date(a.lastSignInAt || 0));

  const dormantUserList = profiles
    .filter(p => getUserStatus(p.lastSignInAt) === 'dormant')
    .sort((a, b) => new Date(b.lastSignInAt || 0) - new Date(a.lastSignInAt || 0));

  if (loading) {
    return <p style={{ color: '#89726C' }}>Loading overview...</p>;
  }

  return (
    <div>
      <Grid>
        <StatCard>
          <StatHeader>
            <StatLabel>Total Users</StatLabel>
            <StatIcon $bg="#E8F0EC" $color="#25432F"><Users size={20} /></StatIcon>
          </StatHeader>
          <StatValue>{totalUsers}</StatValue>
          <StatTrend $positive={newThisWeek > 0}>
            +{newThisWeek} this week
          </StatTrend>
        </StatCard>

        <StatCard>
          <StatHeader>
            <StatLabel>New This Month</StatLabel>
            <StatIcon $bg="#F5EFEB" $color="#6F240A"><TrendingUp size={20} /></StatIcon>
          </StatHeader>
          <StatValue>{newThisMonth}</StatValue>
          <StatTrend>{signedUpToday > 0 ? `${signedUpToday} today` : 'No signups today'}</StatTrend>
        </StatCard>

        <StatCard>
          <StatHeader>
            <StatLabel>Recent Activity</StatLabel>
            <StatIcon $bg="#FFF0E0" $color="#875200"><ShoppingCart size={20} /></StatIcon>
          </StatHeader>
          <StatValue>{activityCount}</StatValue>
          <StatTrend>{recentSales} sales & income in latest</StatTrend>
        </StatCard>
      </Grid>

      <StatusRow>
        <StatusPill $status="active"><Clock size={15} /> {activeUsers} Active (7d)</StatusPill>
        <StatusPill $status="dormant"><Clock size={15} /> {dormantUsers} Dormant (7-30d)</StatusPill>
        <StatusPill $status="churned"><AlertCircle size={15} /> {churnedUsers} Churned (30d+)</StatusPill>
      </StatusRow>

      <ChartCard>
        <ChartTitle>New Signups (Last 7 Days)</ChartTitle>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
            <XAxis dataKey="day" tick={{ fill: '#89726C', fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#89726C', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #F0EEE8', fontSize: '13px' }}
              formatter={(value) => [value, 'Signups']}
            />
            <Bar dataKey="signups" fill="#6F240A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ThreeCol>
        <InsightCard>
          <InsightTitle>Devices (30d)</InsightTitle>
          {visitStats.deviceData.length === 0 ? <p style={{ color: '#89726C', fontSize: '0.82rem' }}>No data</p> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={visitStats.deviceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
                <XAxis dataKey="name" tick={{ fill: '#89726C', fontSize: 11 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #F0EEE8', fontSize: '13px' }} />
                <Bar dataKey="value" fill="#6F240A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </InsightCard>

        <InsightCard>
          <InsightTitle>Locations (30d)</InsightTitle>
          {visitStats.locationData.length === 0 ? <p style={{ color: '#89726C', fontSize: '0.82rem' }}>No data</p> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={visitStats.locationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
                <XAxis dataKey="name" tick={{ fill: '#89726C', fontSize: 11 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #F0EEE8', fontSize: '13px' }} />
                <Bar dataKey="value" fill="#25432F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </InsightCard>

        <InsightCard>
          <InsightTitle>Daily Visits (30d)</InsightTitle>
          {visitStats.dailyVisits.length === 0 ? <p style={{ color: '#89726C', fontSize: '0.82rem' }}>No data</p> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={visitStats.dailyVisits}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
                <XAxis dataKey="day" tick={{ fill: '#89726C', fontSize: 11 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #F0EEE8', fontSize: '13px' }} />
                <Bar dataKey="visits" fill="#875200" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </InsightCard>
      </ThreeCol>

      <ThreeCol>
        <InsightCard>
          <InsightTitle>Top 5 by Revenue</InsightTitle>
          {topRevenue.length === 0 ? <p style={{ color: '#89726C', fontSize: '0.8rem' }}>No data</p> : topRevenue.map((u, i) => (
            <InsightUser key={u.id}>
              <InsightName>{i + 1}. {u.ownerName || u.businessName || '—'}</InsightName>
              <InsightValue>{formatCurrencyShort(u.salesRevenue + u.serviceIncomeTotal, currency)}</InsightValue>
            </InsightUser>
          ))}
        </InsightCard>

        <InsightCard>
          <InsightTitle>Active Users ({activeUsers})</InsightTitle>
          {activeUserList.length === 0 ? <p style={{ color: '#89726C', fontSize: '0.8rem' }}>No active users</p> : activeUserList.map(u => (
            <InsightUser key={u.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                <UserStatusDot $status="active" />
                <InsightName>{u.ownerName || u.businessName || '—'}</InsightName>
              </div>
              <InsightValue>{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}</InsightValue>
            </InsightUser>
          ))}
        </InsightCard>

        <InsightCard>
          <InsightTitle>Dormant Users ({dormantUsers})</InsightTitle>
          {dormantUserList.length === 0 ? <p style={{ color: '#89726C', fontSize: '0.8rem' }}>No dormant users</p> : dormantUserList.map(u => (
            <InsightUser key={u.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                <UserStatusDot $status="dormant" />
                <InsightName>{u.ownerName || u.businessName || '—'}</InsightName>
              </div>
              <InsightValue>{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}</InsightValue>
            </InsightUser>
          ))}
        </InsightCard>
      </ThreeCol>
    </div>
  );
};

export default AdminOverview;
