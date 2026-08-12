/**
 * Converts an array of objects into a CSV string.
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Optional headers mapping { key: 'Display Name' }
 */
const FORMULA_PREFIX = /^[=+@\t\r-]/;

const isNegativeNumber = (value) => /^-\d+(\.\d+)?$/.test(value);

const sanitizeCSVCell = (value) => {
  if (typeof value !== 'string') return value;
  if (FORMULA_PREFIX.test(value) && !isNegativeNumber(value)) {
    return `'${value}`;
  }
  return value;
};

export const convertToCSV = (data, headers = null) => {
  if (!data || !data.length) return '';

  const columns = headers ? Object.keys(headers) : Object.keys(data[0]);
  const headerRow = headers ? Object.values(headers).join(',') : columns.join(',');

  const rows = data.map(item => {
    return columns.map(col => {
      let val = item[col] === undefined || item[col] === null ? '' : item[col];
      val = sanitizeCSVCell(val);
      // Escape commas and quotes
      val = val.toString().replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val}"`;
      }
      return val;
    }).join(',');
  });

  return [headerRow, ...rows].join('\n');
};

/**
 * Triggers a browser download of a CSV file.
 * @param {string} csvContent - The CSV string content
 * @param {string} fileName - Desired file name
 */
export const downloadCSV = (csvContent, fileName) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
