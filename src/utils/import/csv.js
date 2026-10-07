const DELIMITERS = [',', '\t', ';'];
const BOM = '\uFEFF';

const tokenize = (text, delimiter) => {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;
  let inRecord = false;

  const endField = () => {
    row.push(quoted ? field : field.trim());
    field = '';
    quoted = false;
  };

  const endRecord = () => {
    if (!inRecord) return;
    endField();
    records.push(row);
    row = [];
    inRecord = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '' && !quoted) {
      quoted = true;
      inQuotes = true;
      inRecord = true;
      continue;
    }

    if (ch === delimiter) {
      endField();
      inRecord = true;
      continue;
    }

    if (ch === '\n') {
      endRecord();
      continue;
    }

    if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRecord();
      continue;
    }

    field += ch;
    inRecord = true;
  }

  endRecord();
  return { records, unterminated: inQuotes };
};

const countColumns = (line, delimiter) => {
  const { records } = tokenize(line, delimiter);
  return records.reduce((max, row) => Math.max(max, row.length), 0);
};

const scoreDelimiter = (text, delimiter) => {
  const sample = text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, 5);
  if (sample.length === 0) return { score: -1, columns: 1 };
  const counts = sample.map((line) => countColumns(line, delimiter));
  const first = counts[0];
  if (first <= 1) return { score: -1, columns: first };
  const consistent = counts.every((count) => count === first);
  return { score: first + (consistent ? 10 : 0), columns: first };
};

export const detectDelimiter = (text) => {
  const stripped = typeof text === 'string' ? text.replace(BOM, '') : '';
  let best = { delimiter: ',', score: -1 };
  for (const delimiter of DELIMITERS) {
    const { score } = scoreDelimiter(stripped, delimiter);
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
};

export const parseDelimited = (text) => {
  const warnings = [];
  const stripped = typeof text === 'string' ? text.replace(BOM, '') : '';

  if (stripped.trim() === '') {
    return { headers: [], rows: [], delimiter: ',', warnings: ['The file is empty.'] };
  }

  const delimiter = detectDelimiter(stripped);
  const { records, unterminated } = tokenize(stripped, delimiter);

  if (unterminated) {
    warnings.push('A quoted value was never closed; everything after it was read as one value.');
  }

  if (records.length === 0) {
    return { headers: [], rows: [], delimiter, warnings: [...warnings, 'No rows were found.'] };
  }

  const headers = records[0].map((cell) => cell.trim());
  const dataRows = records.slice(1);
  const width = headers.length;

  if (width === 1 && headers[0] === '') {
    warnings.push('The first line could not be read as a header row.');
  }

  const rows = [];
  for (const record of dataRows) {
    if (record.length === 1 && record[0].trim() === '') continue;
    if (record.length !== width) {
      warnings.push(`A row had ${record.length} columns instead of ${width}; it was padded to fit.`);
      const padded = record.slice(0, width);
      while (padded.length < width) padded.push('');
      rows.push(padded);
      continue;
    }
    rows.push(record);
  }

  if (rows.length === 0 && dataRows.length > 0) {
    warnings.push('Every data row was empty.');
  } else if (rows.length === 0) {
    warnings.push('A header row was found but no data rows followed it.');
  }

  return { headers, rows, delimiter, warnings };
};
