export const formatCurrency = (val?: number | null): string => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Ks`;
};

export const formatCompactCurrency = (val?: number | null): string => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  if (Math.abs(num) >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}M Ks`;
  }
  if (Math.abs(num) >= 1_000) {
    const formatted = (num / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}K Ks`;
  }
  return `${num.toLocaleString()} Ks`;
};

export const formatCompactNumber = (val?: number | null): string => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  if (Math.abs(num) >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}M`;
  }
  if (Math.abs(num) >= 1_000) {
    const formatted = (num / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}K`;
  }
  return num.toLocaleString();
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString();
};

export const formatDateShort = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleTimeString();
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const formatDisplayEmail = (email?: string): string => {
  if (!email) return '';
  return email.replace(/@pos\.com$/i, '');
};
