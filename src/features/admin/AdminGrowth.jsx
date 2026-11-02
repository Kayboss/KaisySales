import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { UserPlus, LogIn, FilePlus2, Repeat, Megaphone, Info } from 'lucide-react';
import { fetchUsersWithStats, fetchAcquisition, fetchVisitDays } from '../../services/api';
import { summariseFunnel, UNATTRIBUTED } from '../../utils/growth';
import EmptyState from '../../components/ui/EmptyState';
import SkeletonScreen from '../../components/ui/SkeletonScreen';
import SkeletonTable from '../../components/ui/SkeletonTable';

/**
 * Growth: where accounts come from, and how many of them actually start using
 * the product.
 *
 * This is deliberately not a chart of visits. Visits say how loud a channel is;
 * the funnel says whether anyone who arrived from it ever recorded a sale. A
 * thousand visits that produce no first record is a landing page problem, and
 * the numbers here are ordered so that is the first thing you see.
 */

const Note = styled.div`
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  background: #FCF9F3;
  border: 1px solid #F0EEE8;
  border-left: 4px solid #D4AF37;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #55423D;
  margin-bottom: 1.5rem;

  svg { flex-shrink: 0; margin-top: 0.1rem; color: #875200; }
`;

const StageRail = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.75rem;
`;

const StageCard = styled.div`
  background: white;
  border: 1px solid #F0EEE8;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  position: relative;
`;

const StageTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
  color: #89726C;
`;

const StageLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StageCount = styled.div`
  font-size: 1.75rem;
  font-weight: 600;
  color: #1C1C18;
  letter-spacing: -0.5px;
`;

const StageMeta = styled.div`
  font-size: 0.72rem;
  color: ${props => (props.$warn ? '#BA1A1A' : '#55423D')};
  margin-top: 0.25rem;
  font-weight: 600;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 800;
  color: #1C1C18;
  margin-bottom: 0.25rem;
`;

const CardSub = styled.p`
  font-size: 0.78rem;
  color: #89726C;
  margin-bottom: 1rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
`;

const Th = styled.th`
  text-align: left;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #89726C;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid #F0EEE8;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.6rem;
  border-bottom: 1px solid #F7F5F0;
  color: #1C1C18;
`;

const SourceName = styled.span`
  font-weight: 700;
`;

const Muted = styled.span`
  color: #89726C;
  font-size: 0.78rem;
`;

const Bar = styled.div`
  height: 6px;
  border-radius: 999px;
  background: #F0EEE8;
  overflow: hidden;
  min-width: 60px;
`;

const BarFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: #25432F;
  width: ${props => `${Math.max(0, Math.min(100, props.$pct || 0))}%`};
`;

const pct = (rate) => (rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`);

const STAGE_ICONS = {
  signup: UserPlus,
  signin: LogIn,
  activated: FilePlus2,
  returned: Repeat,
};

const AdminGrowth = () => {
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // One pass, three sources, all of them what the other admin tabs read:
        // profiles + per-user record counts, the write-once attribution rows,
        // and 90 days of visits for the "came back" stage.
        const [people, acquisition, visits] = await Promise.all([
          fetchUsersWithStats(),
          fetchAcquisition(),
          fetchVisitDays(90),
        ]);
        setFunnel(summariseFunnel({ profiles: people, stats: people, acquisition, visits }));
      } catch (err) {
        console.error('Failed to load growth funnel', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <SkeletonScreen label="Loading growth funnel">
        <SkeletonTable rows={8} cols={4} />
      </SkeletonScreen>
    );
  }

  if (!funnel || funnel.total === 0) {
    return (
      <EmptyState icon={<Megaphone size={28} />}>
        No accounts yet. The funnel starts filling as soon as someone signs up.
      </EmptyState>
    );
  }

  return (
    <>
      <Note>
        <Info size={16} />
        <span>
          Signup → first record → came back. A stage only counts people who reached the
          one before it, so the numbers can never add up to more people than you have.
          &ldquo;Came back&rdquo; means a second <em>day</em> in the last 90 days, not a second page
          view &mdash; opening ten screens in one sitting is still one visit.
        </span>
      </Note>

      <StageRail>
        {funnel.stages.map((stage) => {
          const Icon = STAGE_ICONS[stage.key] || UserPlus;
          return (
            <StageCard key={stage.key}>
              <StageTop>
                <StageLabel>{stage.label}</StageLabel>
                <Icon size={16} />
              </StageTop>
              <StageCount>{stage.count}</StageCount>
              <StageMeta>
                {stage.key === 'signup' || stage.ofSignups === null
                  ? 'every account'
                  : `${pct(stage.ofSignups)} of signups`}
              </StageMeta>
              {stage.lost > 0 && (
                <StageMeta $warn>−{stage.lost} dropped off here</StageMeta>
              )}
            </StageCard>
          );
        })}
      </StageRail>

      <Card>
        <CardTitle>Where accounts come from</CardTitle>
        <CardSub>
          First touch, written once at signup and never rewritten. A channel with many
          signups and few first records is bringing the wrong people (or losing them in
          the first ten minutes) &mdash; that is the column to read, not the signup count.
        </CardSub>

        {funnel.channels.length === 0 ? (
          <EmptyState icon={<Megaphone size={24} />}>
            No attribution recorded for these accounts yet.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th>Signups</Th>
                <Th>First record</Th>
                <Th>Activation</Th>
                <Th>Came back</Th>
              </tr>
            </thead>
            <tbody>
              {funnel.channels.map((row) => (
                <tr key={row.source}>
                  <Td>
                    <SourceName>{row.source === UNATTRIBUTED ? 'Not attributed' : row.source}</SourceName>
                    {row.source === UNATTRIBUTED && (
                      <>
                        <br />
                        <Muted>Signed up before attribution was recorded</Muted>
                      </>
                    )}
                  </Td>
                  <Td className="data-tabular">{row.signups}</Td>
                  <Td className="data-tabular">{row.activated}</Td>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Bar><BarFill $pct={(row.activationRate || 0) * 100} /></Bar>
                      <span className="data-tabular" style={{ minWidth: '2.5rem' }}>
                        {pct(row.activationRate)}
                      </span>
                    </div>
                  </Td>
                  <Td className="data-tabular">{row.returned}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Note>
        <Info size={16} />
        <span>
          Attribution is captured from the landing page URL (<code>utm_source</code>,{' '}
          <code>utm_medium</code>, <code>utm_campaign</code>) or from the referring site, and
          held for that browser session only. An account whose tab was closed before
          signing up, or whose browser blocks storage, lands in <strong>Not attributed</strong>{' '}
          rather than being guessed at.
        </span>
      </Note>
    </>
  );
};

export default AdminGrowth;
