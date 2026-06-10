import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Users, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAllProfiles, fetchRecentActivity } from '../../services/api';

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

const AdminOverview = () => {
  const [profiles, setProfiles] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, a] = await Promise.all([
          fetchAllProfiles(),
          fetchRecentActivity(20),
        ]);
        setProfiles(p);
        setRecentActivity(a);
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
  const recentSales = recentActivity.filter(a => a.type === 'sales').length;

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
          <StatTrend>{recentSales} sales in latest</StatTrend>
        </StatCard>

        <StatCard>
          <StatHeader>
            <StatLabel>Avg Revenue/User</StatLabel>
            <StatIcon $bg="#E8F0EC" $color="#25432F"><DollarSign size={20} /></StatIcon>
          </StatHeader>
          <StatValue>{totalUsers > 0 ? 'GH₵' + (recentActivity.filter(a => a.amount).reduce((s, a) => {
            const v = typeof a.amount === 'string' ? parseFloat(a.amount.replace(/[^\d.]/g, '')) : (a.amount || 0);
            return s + v;
          }, 0) / Math.max(totalUsers, 1)).toFixed(0) : 'GH₵0'}</StatValue>
        </StatCard>
      </Grid>

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
    </div>
  );
};

export default AdminOverview;
