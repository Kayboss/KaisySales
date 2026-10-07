const ENV = import.meta.env || {};

const OFF_VALUES = new Set(['false', '0', 'no', 'off']);

export const isFeatureEnabled = (value) =>
  value === undefined || value === null || !OFF_VALUES.has(String(value).trim().toLowerCase());

export const IMPORT_ENABLED = isFeatureEnabled(ENV.VITE_IMPORT);
export const ASSISTANT_ENABLED = isFeatureEnabled(ENV.VITE_ASSISTANT);
