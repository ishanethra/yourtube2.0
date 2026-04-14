import { formatDistanceToNow } from "date-fns";

export const safeTimeAgo = (value: unknown, fallback = "just now") => {
  if (!value) return fallback;
  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${formatDistanceToNow(parsed)} ago`;
};

export const safeNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
