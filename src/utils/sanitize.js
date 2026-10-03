export const sanitizeInput = (value, maxLength = 200) => {
  if (typeof value !== 'string') return value;
  let s = value.trim();
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/on\w+\s*=\s*['"]?[^'"]*['"]?/gi, '');
  s = s.replace(/[<>]/g, '');
  s = s.replace(/&lt;/gi, '').replace(/&gt;/gi, '');
  return s.slice(0, maxLength);
};

export const sanitizeNumber = (value) => {
  if (typeof value === 'number') return value;
  const raw = String(value).trim();
  // Preserve a minus wherever the currency prefix put it ("-5.50" or
  // "GHS -5.50"). Stripping it turned every credit, return or negative
  // adjustment into a positive number, which then silently overstated revenue
  // and inventory value. Everything else non-numeric (currency symbols, spaces,
  // thousands separators) is still removed.
  const negative = raw.includes('-');
  const s = raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return negative && num !== 0 ? -num : num;
};

export const VALIDATION = {
  businessName: { maxLength: 100, pattern: /^[\w\s'.-]+$/ },
  phone: { maxLength: 20, pattern: /^[\d\s\-+()]+$/ },
  itemName: { maxLength: 100, pattern: /^[\w\s'.,#-]+$/ },
  categoryName: { maxLength: 50, pattern: /^[\w\s'-]+$/ },
  title: { maxLength: 100, pattern: /^[\w\s'.,#-]+$/ },
  email: { maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  location: { maxLength: 200, pattern: /^[\w\s'.,#-]+$/ },
  paymentMethod: { maxLength: 30, pattern: /^[a-zA-Z\s_-]+$/ },
};
