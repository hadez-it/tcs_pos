export const formatCurrency = (val: number): string => {
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Ks`;
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
