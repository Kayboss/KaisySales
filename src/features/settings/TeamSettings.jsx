import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  ArrowRightLeft,
  Building2,
  Check,
  Copy,
  KeyRound,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Skeleton from '../../components/ui/Skeleton';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import {
  archiveBranch,
  createBranch,
  createInvite,
  fetchBranches,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  setMemberBranch,
  setMemberModules,
  transferOwnership,
} from '../../services/api';

const Section = styled.section`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  padding: 1.75rem;
  margin-bottom: 1.5rem;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;

  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.1rem;
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.85rem;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;

  @media (max-width: 768px) {
    display: none;
  }
`;

const Th = styled.th`
  text-align: left;
  padding: 0.75rem 0.75rem;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 0.85rem 0.75rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.85rem;
  vertical-align: middle;
`;

const CardList = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: grid;
    gap: 0.75rem;
  }
`;

const MemberCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 0.9rem;
  display: grid;
  gap: 0.6rem;
`;

const NameCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  strong { color: ${({ theme }) => theme.colors.text.main}; }
  span { color: ${({ theme }) => theme.colors.text.muted}; font-size: 0.78rem; }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: ${({ $tone, theme }) =>
    $tone === 'owner' ? 'rgba(111,36,10,0.1)' : theme.colors.background.surfaceVariant};
  color: ${({ $tone, theme }) => ($tone === 'owner' ? theme.colors.primary : theme.colors.text.muted)};
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: capitalize;
`;

const Select = styled.select`
  padding: 0.4rem 0.55rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  background: white;
  color: ${({ theme }) => theme.colors.text.main};
  font-size: 0.82rem;
  font-weight: 600;
  max-width: 100%;
`;

const TextInput = styled.input`
  padding: 0.6rem 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: white;
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: white;
  color: ${({ theme }) => theme.colors.text.main};
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryButton = styled(Button)`
  background: ${({ theme }) => theme.colors.primary};
  border-color: ${({ theme }) => theme.colors.primary};
  color: white;
`;

const DangerButton = styled(Button)`
  color: #BA1A1A;
`;

const ToggleLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.main};
  cursor: pointer;

  input { width: 16px; height: 16px; accent-color: ${({ theme }) => theme.colors.primary}; }
`;

const InlineForm = styled.form`
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1rem;

  ${TextInput} { flex: 1 1 200px; width: auto; }
`;

const InviteRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  border: 1px dashed ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: 0.6rem;
`;

const Code = styled.code`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.primary};
`;

const Note = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.78rem;
  line-height: 1.5;
`;

const Empty = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.85rem;
`;

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const TeamSettings = () => {
  const { businessRole, reloadTenant } = useSettingsStore();
  const currentUserId = useAuthStore((s) => s.user?.uid);

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [inviteBranchId, setInviteBranchId] = useState('');
  const [newCode, setNewCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [newBranchName, setNewBranchName] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  const [removeTarget, setRemoveTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const isOwner = businessRole === 'owner';

  const load = useCallback(async () => {
    try {
      const [memberRows, inviteRows, branchRows] = await Promise.all([
        listMembers(),
        listInvites(),
        fetchBranches(),
      ]);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      setInvites(Array.isArray(inviteRows) ? inviteRows : []);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
    } catch (error) {
      console.error('Failed to load team', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Keep the invite picker on a live branch without silently choosing for the
  // owner: default to the branch already selected in the sidebar, else the
  // first live branch.
  useEffect(() => {
    if (inviteBranchId || branches.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInviteBranchId(String(branches[0].id));
  }, [branches, inviteBranchId]);

  const liveBranches = branches.filter((branch) => !branch.archivedAt);
  const activeMembers = members.filter((member) => member.status === 'active');

  const withBusy = async (id, action) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (error) {
      console.error('Team action failed', error);
      alert(error?.message || 'That change could not be saved. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBranchChange = (member, value) =>
    withBusy(`${member.userId}-branch`, () => setMemberBranch(member.userId, Number(value)));

  const handleReportingChange = (member, checked) =>
    withBusy(`${member.userId}-modules`, () =>
      setMemberModules(member.userId, checked ? ['sales', 'reporting'] : ['sales'])
    );

  const handleCreateInvite = async (event) => {
    event.preventDefault();
    setCreatingInvite(true);
    try {
      const invite = await createInvite(inviteBranchId ? Number(inviteBranchId) : null);
      setNewCode(invite);
      await load();
    } catch (error) {
      console.error('Failed to create invite', error);
      alert(error?.message || 'Could not create an invite code.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch {
      // Clipboard permissions vary by browser; the code is visible to copy by hand.
    }
  };

  const handleRevokeInvite = (invite) =>
    withBusy(invite.id, () => revokeInvite(invite.id));

  const handleCreateBranch = async (event) => {
    event.preventDefault();
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      await createBranch({ name: newBranchName.trim() });
      setNewBranchName('');
      await reloadTenant(currentUserId);
      await load();
    } catch (error) {
      console.error('Failed to create branch', error);
      alert(error?.message || 'Could not create that branch.');
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setConfirming(true);
    try {
      await removeMember(removeTarget);
      setRemoveTarget(null);
      await reloadTenant(currentUserId);
      await load();
    } catch (error) {
      console.error('Failed to remove member', error);
      alert(error?.message || 'Could not remove that member.');
    } finally {
      setConfirming(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setConfirming(true);
    try {
      await transferOwnership(transferTarget);
      setTransferTarget(null);
      // The current login is now staff, so the app shell and navigation change
      // on this reload. Say so instead of letting the screen vanish.
      await reloadTenant(currentUserId);
      alert('Ownership transferred. You now have staff access to this business.');
    } catch (error) {
      console.error('Failed to transfer ownership', error);
      alert(error?.message || 'Could not transfer ownership.');
    } finally {
      setConfirming(false);
    }
  };

  const handleArchiveBranch = async () => {
    if (!archiveTarget) return;
    const target = liveBranches.find((branch) => String(branch.id) === String(archiveTarget));
    if (!target || target.isDefault) {
      alert('The default branch cannot be archived.');
      setArchiveTarget(null);
      return;
    }
    // A staff member stranded on an archived branch would have no reachable
    // screen, so move them first instead of locking them out.
    const assigned = activeMembers.filter(
      (member) => member.role === 'staff' && String(member.branchId) === String(archiveTarget)
    );
    if (assigned.length > 0) {
      const names = assigned.map((member) => member.fullName || member.email).join(', ');
      alert(`Move ${names} to another branch before archiving this one.`);
      setArchiveTarget(null);
      return;
    }

    setConfirming(true);
    try {
      await archiveBranch(archiveTarget);
      setArchiveTarget(null);
      await reloadTenant(currentUserId);
      await load();
    } catch (error) {
      console.error('Failed to archive branch', error);
      alert(error?.message || 'Could not archive that branch.');
    } finally {
      setConfirming(false);
    }
  };

  if (!isOwner) {
    return (
      <Section>
        <SectionHead>
          <div>
            <h2>Team</h2>
            <p>Only the business owner can manage people and branches.</p>
          </div>
        </SectionHead>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section>
        <Skeleton height="1.5rem" width="30%" />
        <Skeleton height="1rem" width="60%" style={{ marginTop: '0.75rem' }} />
        <Skeleton height="12rem" style={{ marginTop: '1.5rem' }} />
      </Section>
    );
  }

  return (
    <div>
      <Section>
        <SectionHead>
          <div>
            <h2><Users size={18} /> Team</h2>
            <p>Staff have their own login and are locked to one branch.</p>
          </div>
        </SectionHead>

        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Branch</Th>
              <Th>Can see reports</Th>
              <Th>Joined</Th>
              <Th aria-label="Actions"></Th>
            </tr>
          </thead>
          <tbody>
            {activeMembers.map((member) => {
              const isMemberOwner = member.role === 'owner';
              return (
                <tr key={member.userId}>
                  <Td>
                    <NameCell>
                      <strong>{member.fullName || member.email || 'Unknown'}</strong>
                      {member.fullName && member.email ? <span>{member.email}</span> : null}
                    </NameCell>
                  </Td>
                  <Td>
                    <Badge $tone={isMemberOwner ? 'owner' : 'staff'}>
                      {isMemberOwner ? <Shield size={11} /> : null}
                      {isMemberOwner ? 'Owner' : 'Staff'}
                    </Badge>
                  </Td>
                  <Td>
                    {isMemberOwner ? (
                      <span style={{ color: '#89726C' }}>All branches</span>
                    ) : (
                      <Select
                        aria-label={`Branch for ${member.fullName || member.email}`}
                        value={member.branchId == null ? '' : String(member.branchId)}
                        disabled={busyId === `${member.userId}-branch`}
                        onChange={(event) => handleBranchChange(member, event.target.value)}
                      >
                        <option value="" disabled>Choose a branch</option>
                        {liveBranches.map((branch) => (
                          <option key={branch.id} value={String(branch.id)}>
                            {branch.name}{branch.isDefault ? ' (default)' : ''}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Td>
                  <Td>
                    {isMemberOwner ? (
                      <span style={{ color: '#89726C' }}>Always</span>
                    ) : (
                      <ToggleLabel>
                        <input
                          type="checkbox"
                          checked={Array.isArray(member.modules) && member.modules.includes('reporting')}
                          disabled={busyId === `${member.userId}-modules`}
                          onChange={(event) => handleReportingChange(member, event.target.checked)}
                        />
                        Reports &amp; expenses
                      </ToggleLabel>
                    )}
                  </Td>
                  <Td style={{ color: '#55423D' }}>{formatDate(member.joinedAt)}</Td>
                  <Td style={{ textAlign: 'right' }}>
                    {!isMemberOwner && (
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button
                          type="button"
                          onClick={() => setTransferTarget(member.userId)}
                          title="Make this member the owner"
                        >
                          <ArrowRightLeft size={13} /> Make owner
                        </Button>
                        <DangerButton type="button" onClick={() => setRemoveTarget(member.userId)}>
                          <Trash2 size={13} /> Remove
                        </DangerButton>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        <CardList>
          {activeMembers.map((member) => {
            const isMemberOwner = member.role === 'owner';
            return (
              <MemberCard key={member.userId}>
                <NameCell>
                  <strong>{member.fullName || member.email || 'Unknown'}</strong>
                  {member.fullName && member.email ? <span>{member.email}</span> : null}
                </NameCell>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge $tone={isMemberOwner ? 'owner' : 'staff'}>
                    {isMemberOwner ? <Shield size={11} /> : null}
                    {isMemberOwner ? 'Owner' : 'Staff'}
                  </Badge>
                  {isMemberOwner ? (
                    <span style={{ color: '#89726C', fontSize: '0.78rem' }}>All branches · always reports</span>
                  ) : (
                    <Select
                      aria-label={`Branch for ${member.fullName || member.email}`}
                      value={member.branchId == null ? '' : String(member.branchId)}
                      disabled={busyId === `${member.userId}-branch`}
                      onChange={(event) => handleBranchChange(member, event.target.value)}
                    >
                      <option value="" disabled>Choose a branch</option>
                      {liveBranches.map((branch) => (
                        <option key={branch.id} value={String(branch.id)}>
                          {branch.name}{branch.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                {!isMemberOwner && (
                  <>
                    <ToggleLabel>
                      <input
                        type="checkbox"
                        checked={Array.isArray(member.modules) && member.modules.includes('reporting')}
                        disabled={busyId === `${member.userId}-modules`}
                        onChange={(event) => handleReportingChange(member, event.target.checked)}
                      />
                      Can see reports and expenses
                    </ToggleLabel>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Button type="button" onClick={() => setTransferTarget(member.userId)}>
                        <ArrowRightLeft size={13} /> Make owner
                      </Button>
                      <DangerButton type="button" onClick={() => setRemoveTarget(member.userId)}>
                        <Trash2 size={13} /> Remove
                      </DangerButton>
                    </div>
                  </>
                )}
              </MemberCard>
            );
          })}
        </CardList>

        {activeMembers.length === 0 && <Empty>No active members yet.</Empty>}

        <Note style={{ marginTop: '1rem' }}>
          A staff member with inventory access can work out your margin from product cost prices.
          “Own sales only” on Sales History is a page filter, not a database restriction.
        </Note>
      </Section>

      <Section>
        <SectionHead>
          <div>
            <h2><UserPlus size={18} /> Invite a teammate</h2>
            <p>Generate a single-use code. They enter it when they sign up or join.</p>
          </div>
        </SectionHead>

        <InlineForm onSubmit={handleCreateInvite}>
          <Select
            aria-label="Branch for the invite"
            value={inviteBranchId}
            onChange={(event) => setInviteBranchId(event.target.value)}
            style={{ flex: '1 1 200px' }}
          >
            {liveBranches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}{branch.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </Select>
          <PrimaryButton type="submit" disabled={creatingInvite || liveBranches.length === 0}>
            <KeyRound size={14} /> {creatingInvite ? 'Creating...' : 'Create code'}
          </PrimaryButton>
        </InlineForm>

        {newCode && (
          <InviteRow>
            <div>
              <Code>{newCode.code}</Code>
              <div style={{ color: '#89726C', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                For {newCode.branchName || 'a branch'} · expires {formatDate(newCode.expiresAt)}
              </div>
            </div>
            <Button type="button" onClick={() => copyCode(newCode.code)}>
              {copiedCode === newCode.code ? <Check size={14} /> : <Copy size={14} />}
              {copiedCode === newCode.code ? 'Copied' : 'Copy'}
            </Button>
          </InviteRow>
        )}

        {invites.length === 0 ? (
          <Empty>No unused invite codes.</Empty>
        ) : (
          invites.map((invite) => (
            <InviteRow key={invite.id}>
              <div>
                <Code>{invite.code}</Code>
                <div style={{ color: '#89726C', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                  {invite.branchName || 'Any branch'} · expires {formatDate(invite.expiresAt)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Button type="button" onClick={() => copyCode(invite.code)}>
                  {copiedCode === invite.code ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCode === invite.code ? 'Copied' : 'Copy'}
                </Button>
                <DangerButton
                  type="button"
                  disabled={busyId === invite.id}
                  onClick={() => handleRevokeInvite(invite)}
                >
                  Revoke
                </DangerButton>
              </div>
            </InviteRow>
          ))
        )}
      </Section>

      <Section>
        <SectionHead>
          <div>
            <h2><Building2 size={18} /> Branches</h2>
            <p>Branches are archived, never deleted, so past sales keep their home.</p>
          </div>
        </SectionHead>

        <InlineForm onSubmit={handleCreateBranch}>
          <TextInput
            value={newBranchName}
            onChange={(event) => setNewBranchName(event.target.value)}
            placeholder="New branch name"
            aria-label="New branch name"
            required
          />
          <PrimaryButton type="submit" disabled={creatingBranch || !newBranchName.trim()}>
            {creatingBranch ? 'Adding...' : 'Add branch'}
          </PrimaryButton>
        </InlineForm>

        {liveBranches.length === 1 && (
          <Note style={{ marginBottom: '0.75rem' }}>
            The default branch cannot be archived. Add a second branch first.
          </Note>
        )}

        {liveBranches.map((branch) => (
          <InviteRow key={branch.id}>
            <div>
              <strong style={{ color: '#1C1C18' }}>{branch.name}</strong>
              {branch.isDefault ? <Badge style={{ marginLeft: '0.5rem' }}>Default</Badge> : null}
              {branch.location ? (
                <div style={{ color: '#89726C', fontSize: '0.78rem' }}>{branch.location}</div>
              ) : null}
            </div>
            {!branch.isDefault && (
              <DangerButton
                type="button"
                disabled={busyId === branch.id}
                onClick={() => setArchiveTarget(branch.id)}
              >
                <Trash2 size={13} /> Archive
              </DangerButton>
            )}
          </InviteRow>
        ))}
      </Section>

      <ConfirmDialog
        isOpen={!!removeTarget}
        title="Remove this teammate?"
        message="They lose access immediately. Their past sales stay in your history, and you can invite them again later."
        confirmLabel="Remove"
        confirmLoading={confirming}
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!transferTarget}
        title="Transfer ownership?"
        message="The chosen teammate becomes the owner and gains Settings, Team and billing. You become staff and lose owner access to this business."
        confirmLabel="Transfer"
        confirmLoading={confirming}
        onConfirm={handleTransfer}
        onCancel={() => setTransferTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title="Archive this branch?"
        message="Staff assigned to it must be moved first. Past sales and stock stay attached to the archived branch."
        confirmLabel="Archive"
        confirmLoading={confirming}
        onConfirm={handleArchiveBranch}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
};

export default TeamSettings;
