import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Bug } from 'lucide-react';
import { fetchErrorLogs } from '../../services/api';

const ErrorFeed = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const ErrorItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid #F0EEE8;
  font-size: 0.8rem;

  &:last-child { border-bottom: none; }

  @media (min-width: 768px) {
    align-items: center;
    padding: 0.75rem 1rem;
  }
`;

const ErrorText = styled.span`
  flex: 1;
  color: #BA1A1A;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const ErrorPage = styled.span`
  color: #89726C;
  font-size: 0.7rem;
  font-weight: 600;
`;

const ErrorTime = styled.span`
  color: #89726C;
  font-size: 0.7rem;
  white-space: nowrap;
`;

const ErrorUser = styled.span`
  color: #55423D;
  font-size: 0.7rem;
  font-weight: 600;
  background: #F0EEE8;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const AdminErrors = () => {
  const [errorLogs, setErrorLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchErrorLogs(50);
        setErrorLogs(data);
      } catch (err) {
        console.error('Failed to load error logs', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p style={{ color: '#89726C' }}>Loading errors...</p>;

  return (
    <ErrorFeed>
      {errorLogs.length === 0 ? (
        <Empty>No errors recorded.</Empty>
      ) : (
        errorLogs.map(e => (
          <ErrorItem key={e.id}>
            <Bug size={14} color="#BA1A1A" style={{ marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <ErrorText title={e.error}>{e.error}</ErrorText>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <ErrorPage>{e.page || '—'}</ErrorPage>
                <ErrorUser title={e.userEmail || e.userBusinessName || e.userId}>
                  {e.userBusinessName || e.userEmail || e.userId?.slice(0, 8) || '—'}
                </ErrorUser>
                <ErrorTime>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</ErrorTime>
              </div>
            </div>
          </ErrorItem>
        ))
      )}
    </ErrorFeed>
  );
};

export default AdminErrors;
