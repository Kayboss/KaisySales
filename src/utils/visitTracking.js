export const detectDevice = () => {
  const ua = navigator.userAgent;
  if (/tablet|iPad|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/mobile|iPhone|Android.*Mobile/i.test(ua)) return 'mobile';
  return 'desktop';
};

export const detectLocation = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = tz.split('/');
    if (parts.length >= 2) return parts[1]?.replace(/_/g, ' ') || tz;
    return tz;
  } catch {
    return 'Unknown';
  }
};
