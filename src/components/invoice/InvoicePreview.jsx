import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { Leaf, Download, Share2, X } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;

  @media print {
    position: absolute;
    background: none;
    padding: 0;
  }
`;

const Container = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media print {
    max-height: none;
    box-shadow: none;
    border-radius: 0;
    animation: none;
  }
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #F0EEE8;

  @media print {
    display: none;
  }
`;

const ToolbarTitle = styled.div`
  font-weight: 700;
  color: #6F240A;
`;

const ToolbarActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ToolBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  background: white;
  color: #1C1C18;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    background: #F5F3F0;
  }
`;

const PrintBtn = styled(ToolBtn)`
  background: #6F240A;
  color: white;
  border-color: #6F240A;

  &:hover {
    background: #5A1D08;
  }
`;

const InvoiceBody = styled.div`
  padding: 2.5rem;

  @media print {
    padding: 2rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 800;
  font-size: 1.25rem;
  color: #6F240A;
  letter-spacing: 2px;
`;

const InvoiceMeta = styled.div`
  text-align: right;
`;

const InvoiceTitle = styled.div`
  font-size: 1.5rem;
  font-weight: 800;
  color: #1C1C18;
`;

const InvoiceNumber = styled.div`
  color: #6F240A;
  font-weight: 700;
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

const Divider = styled.div`
  height: 2px;
  background: #6F240A;
  opacity: 0.15;
  margin-bottom: 2rem;
`;

const Section = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
`;

const InfoBlock = styled.div`
  p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: #55423D;
  }
  strong {
    color: #1C1C18;
  }
`;

const InfoLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #89726C;
  margin-bottom: 0.5rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 0.75rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #89726C;
  border-bottom: 1px solid #F0EEE8;
`;

const Td = styled.td`
  padding: 0.75rem 0.5rem;
  font-size: 0.875rem;
  color: #1C1C18;
  border-bottom: 1px solid #F0EEE8;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 2px solid #6F240A;
`;

const TotalLabel = styled.span`
  font-weight: 700;
  color: #1C1C18;
  margin-right: 2rem;
`;

const TotalValue = styled.span`
  font-size: 1.5rem;
  font-weight: 800;
  color: #6F240A;
`;

const StatusBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: fit-content;
  margin-top: 1rem;
  background: ${props => props.$status === 'paid' ? 'rgba(37, 67, 47, 0.1)' : 'rgba(135, 82, 0, 0.1)'};
  color: ${props => props.$status === 'paid' ? '#25432F' : '#875200'};
`;

const Footer = styled.div`
  text-align: center;
  padding-top: 2rem;
  margin-top: 2rem;
  border-top: 1px solid #F0EEE8;
  font-size: 0.75rem;
  color: #89726C;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #89726C;
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 8px;

  &:hover {
    background: #F5F3F0;
  }

  @media print {
    display: none;
  }
`;

const PRINT_STYLE_ID = 'invoice-print-styles';

const InvoicePreview = ({ invoice, onClose, businessName, businessPhone, businessLocation }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `
      @media print {
        body > *:not([data-invoice-overlay]) { display: none !important; }
        [data-invoice-overlay] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: none !important;
          padding: 0 !important;
          display: flex !important;
          align-items: flex-start !important;
          justify-content: center !important;
        }
        [data-invoice-overlay] > * {
          max-width: 100% !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(PRINT_STYLE_ID)?.remove(); };
  }, []);

  const parseAmount = (amt) => {
    if (typeof amt === 'number') return amt;
    if (typeof amt !== 'string') return 0;
    return parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
  };

  const totalAmount = parseAmount(invoice.amount || invoice.totalAmount);
  const quantity = parseInt(invoice.quantity) || 1;
  const unitPrice = parseFloat(invoice.unitPrice) || (quantity > 0 ? totalAmount / quantity : 0);

  const { lineItems, discountPct } = (() => {
    try {
      const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
      if (Array.isArray(items) && items.length > 0) {
        const meta = items.find(i => i.type === '_meta');
        const actual = items.filter(i => i.type !== '_meta');
        return {
          lineItems: actual.length > 0 ? actual : [{ name: `${invoice.customer} - Order`, quantity, unitPrice, amount: totalAmount }],
          discountPct: meta?.discount || 0
        };
      }
    } catch {}
    return { lineItems: [{ name: `${invoice.customer} - Order`, quantity, unitPrice, amount: totalAmount }], discountPct: 0 };
  })();

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareData = {
      title: `Invoice ${invoice.id}`,
      text: `Invoice ${invoice.id} for ${invoice.customer} - ${invoice.amount}`,
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(
        `Invoice ${invoice.id}\nCustomer: ${invoice.customer}\nAmount: ${invoice.amount}\nStatus: ${invoice.status}\nDate: ${invoice.date}`
      );
      alert('Invoice details copied to clipboard!');
    }
  };

  return createPortal(
    <Overlay onClick={onClose} data-invoice-overlay>
      <Container onClick={e => e.stopPropagation()} ref={contentRef}>
        <Toolbar>
          <ToolbarTitle>Invoice Preview</ToolbarTitle>
          <ToolbarActions>
            <ToolBtn onClick={handleShare}>
              <Share2 size={16} /> Share
            </ToolBtn>
            <PrintBtn onClick={handlePrint}>
              <Download size={16} /> Download PDF
            </PrintBtn>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </ToolbarActions>
        </Toolbar>

        <InvoiceBody>
          <Header>
              <Brand>
                <Leaf size={24} />
                {businessName || 'KaisySales'}
              </Brand>
            <InvoiceMeta>
              <InvoiceTitle>INVOICE</InvoiceTitle>
              <InvoiceNumber>{invoice.id}</InvoiceNumber>
            </InvoiceMeta>
          </Header>

          <Section>
            <InfoBlock>
              <InfoLabel>From</InfoLabel>
              <p><strong>{businessName || 'KaisySales'}</strong></p>
              {businessPhone && <p>{businessPhone}</p>}
              {businessLocation && <p>{businessLocation}</p>}
            </InfoBlock>
            <InfoBlock style={{ textAlign: 'right' }}>
              <InfoLabel>Bill To</InfoLabel>
              <p><strong>{invoice.customer}</strong></p>
              {invoice.customerLocation && <p>{invoice.customerLocation}</p>}
            </InfoBlock>
          </Section>

          <Divider />

          <Section>
            <InfoBlock>
              <InfoLabel>Invoice Date</InfoLabel>
              <p><strong>{invoice.date}</strong></p>
            </InfoBlock>
            <InfoBlock style={{ textAlign: 'right' }}>
              <InfoLabel>Status</InfoLabel>
              <StatusBlock $status={invoice.status}>
                {invoice.status === 'paid' ? 'Paid' : 'Pending'}
              </StatusBlock>
            </InfoBlock>
          </Section>

          <Table>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th style={{ textAlign: 'right' }}>Qty</Th>
                <Th style={{ textAlign: 'right' }}>Unit Price</Th>
                <Th style={{ textAlign: 'right' }}>Total</Th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={idx}>
                  <Td>{item.name}</Td>
                  <Td style={{ textAlign: 'right' }}>{parseInt(item.quantity) || 1}</Td>
                  <Td style={{ textAlign: 'right' }}>GH₵{(parseFloat(item.unitPrice) || 0).toFixed(2)}</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700 }}>
                    GH₵{((parseInt(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {discountPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#89726C' }}>
              <span style={{ marginRight: '2rem' }}>Discount ({discountPct}%)</span>
              <span style={{ fontWeight: 700, color: '#BA1A1A', minWidth: '120px', textAlign: 'right' }}>
                -{(() => {
                  const sub = lineItems.reduce((s, i) => s + ((parseInt(i.quantity) || 1) * (parseFloat(i.unitPrice) || 0)), 0);
                  return `GH₵${(sub * discountPct / 100).toFixed(2)}`;
                })()}
              </span>
            </div>
          )}

          <TotalRow>
            <TotalLabel>Total Amount</TotalLabel>
            <TotalValue>{invoice.amount}</TotalValue>
          </TotalRow>

          <Footer>
            {businessName || 'KaisySales'} — Know your Business. Stay in control.
          </Footer>
        </InvoiceBody>
      </Container>
    </Overlay>,
    document.body
  );
};

export default InvoicePreview;
