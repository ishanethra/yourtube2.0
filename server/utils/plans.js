export const PLAN_CONFIG = {
  FREE: { amount: 0, watchMinutes: 5 },
  BRONZE: { amount: 10, watchMinutes: 7 },
  SILVER: { amount: 50, watchMinutes: 10 },
  GOLD: { amount: 100, watchMinutes: null },
};

export const SOUTH_STATES = [
  "tamil nadu", "tn", "tamilnadu",
  "kerala", "kl",
  "karnataka", "ka",
  "andhra pradesh", "ap", "andhrapradesh",
  "telangana", "ts",
];

export const normalizePlan = (input) => {
  const value = (input || "").toString().toUpperCase();
  return PLAN_CONFIG[value] ? value : "FREE";
};
