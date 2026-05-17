import { useEffect } from 'react';
import styled from 'styled-components';
import { AlertTriangle, X } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  padding: 1rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: scaleIn 0.2s ease-out;
  overflow: hidden;

  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem 0;
`;

const IconWrap = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #FFF2F2;
  color: #BA1A1A;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #89726C;
  padding: 0.25rem;
  border-radius: 50%;

  &:hover { background: #F5F3F0; }
`;

const Body = styled.div`
  padding: 1rem 1.5rem 1.5rem;
`;

const Title = styled.h3`
  margin: 0.75rem 0 0.25rem;
  font-size: 1.125rem;
  color: #1C1C18;
`;

const Message = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: #55423D;
  line-height: 1.5;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
`;

const CancelBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #D0C8C4;
  background: white;
  color: #1C1C18;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover { background: #F5F3F0; }
`;

const DeleteBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 10px;
  border: none;
  background: #BA1A1A;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover { background: #93000A; }
`;

const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <Overlay onClick={onCancel}>
      <Card onClick={e => e.stopPropagation()}>
        <Header>
          <IconWrap><AlertTriangle size={20} /></IconWrap>
          <CloseBtn onClick={onCancel}><X size={18} /></CloseBtn>
        </Header>
        <Body>
          <Title>{title}</Title>
          <Message>{message}</Message>
          <Actions>
            <CancelBtn onClick={onCancel}>Cancel</CancelBtn>
            <DeleteBtn onClick={onConfirm}>{confirmLabel || 'Delete'}</DeleteBtn>
          </Actions>
        </Body>
      </Card>
    </Overlay>
  );
};

export default ConfirmDialog;
