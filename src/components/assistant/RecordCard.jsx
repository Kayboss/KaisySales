import styled from 'styled-components';
import { Check, X, AlertTriangle, PackagePlus } from 'lucide-react';
import { RECORD_TYPE_LABELS, RECORD_TYPE_SECTIONS } from '../../utils/assistant/recordPayload';

const Card = styled.div`
  align-self: flex-start;
  max-width: 92%;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background.surface};
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Badge = styled.span`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text.main};
`;

const Hint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.status.warning};
`;

const Rows = styled.dl`
  margin: 0;
  padding: 0.6rem 0.85rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 0.75rem;
`;

const Label = styled.dt`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Value = styled.dd`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text.main};
  font-weight: 600;
  overflow-wrap: anywhere;
`;

const Unset = styled(Value)`
  font-weight: 500;
  font-style: italic;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Warn = styled(Value)`
  color: ${({ theme }) => theme.colors.status.error};
`;

const Add = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.text.main};
  font-family: ${({ theme }) => theme.fonts.main};
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0 0.85rem 0.85rem;
`;

const Save = styled.button`
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.onPrimary};
  font-family: ${({ theme }) => theme.fonts.main};
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryContainer};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Discard = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.fonts.main};
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }
`;

const Note = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.85rem 0.85rem;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Error = styled(Note)`
  color: ${({ theme }) => theme.colors.status.error};
`;

const RecordCard = ({ card, onSave, onDiscard, onAddToInventory, addingToInventory }) => {
  const section = RECORD_TYPE_SECTIONS[card.recordType] || 'your records';
  const blocked = Boolean(card.unresolvedItem) && card.status === 'pending';

  // A sale is the one record that changes a number the user already has, so the
  // stock consequence is shown before Save rather than after. The wording calls
  // out a shortfall instead of hiding it, because a sale that exceeds the shelf
  // would otherwise look identical to one that does not.
  const quantity = Math.max(0, Math.round(Number(card.payload?.quantity)) || 0);
  const stockRow =
    card.recordType === 'sale' && card.status === 'pending'
      ? card.inventoryMatch
        ? `${card.inventoryMatch.stock} in stock \u00b7 ${
            card.inventoryMatch.stock < quantity
              ? `short by ${quantity - card.inventoryMatch.stock}`
              : `${quantity} will leave`
          }`
        : 'Not in your inventory'
      : null;

  return (
    <Card>
      <Head>
        <Badge>{RECORD_TYPE_LABELS[card.recordType] || 'Record'}</Badge>
        {card.status === 'pending' && !blocked && card.confidence !== 'high' && (
          <Hint>
            <AlertTriangle size={13} />
            Check the details
          </Hint>
        )}
        {blocked && (
          <Hint>
            <AlertTriangle size={13} />
            Not in inventory
          </Hint>
        )}
      </Head>

      <Rows>
        {card.summary.map((entry) => (
          <div key={entry.label} style={{ display: 'contents' }}>
            <Label>{entry.label}</Label>
            <Value>{entry.value}</Value>
          </div>
        ))}
        {stockRow && (
          <div style={{ display: 'contents' }}>
            <Label>Stock</Label>
            {blocked ? <Warn>{stockRow}</Warn> : <Value>{stockRow}</Value>}
          </div>
        )}
        {/* While the card is still open, a column the screen has but the sentence
            did not mention is shown rather than hidden: the user is being asked
            for it, so it must be visible that it is blank. */}
        {card.status === 'pending' &&
          (card.missing || []).map((field) => (
            <div key={`missing-${field.key}`} style={{ display: 'contents' }}>
              <Label>{field.label}</Label>
              <Unset>Not set</Unset>
            </div>
          ))}
      </Rows>

      {card.status === 'pending' && (
        <Actions>
          {blocked ? (
            // No Save here at all: the sale cannot move stock that does not
            // exist, so the only way forward is to make the item real.
            <Add type="button" onClick={() => onAddToInventory(card)} disabled={addingToInventory}>
              <PackagePlus size={15} />
              {addingToInventory ? 'Waiting for the count…' : 'Add to inventory'}
            </Add>
          ) : (
            <Save type="button" onClick={() => onSave(card)}>
              Save
            </Save>
          )}
          <Discard type="button" onClick={() => onDiscard(card)}>
            Not right
          </Discard>
        </Actions>
      )}

      {card.status === 'saving' && <Note>Saving…</Note>}

      {card.status === 'saved' && (
        <Note>
          <Check size={14} />
          Saved to {section}.
          {card.shortfall ? ` ${card.item || 'That item'} is now short by ${card.shortfall} unit(s).` : ''}
        </Note>
      )}

      {card.status === 'rejected' && (
        <Note>
          <X size={14} />
          Nothing was saved. Thanks — I&apos;ll get better at that.
        </Note>
      )}

      {card.status === 'error' && <Error>Couldn&apos;t save that. Please try again.</Error>}
    </Card>
  );
};

export default RecordCard;
