const PLAN_LIMITS = {
  free: { maxSalesMonth: 10, maxInvoicesMonth: 2, maxProducts: 5 },
  silver: { maxSalesMonth: 100, maxInvoicesMonth: 20, maxProducts: 50 },
  gold: { maxSalesMonth: -1, maxInvoicesMonth: -1, maxProducts: -1 },
};

const NONE_LIMITS = { maxSalesMonth: 0, maxInvoicesMonth: 0, maxProducts: 0 };

export const getPlanLimits = (plan) => {
  if (!plan || plan === 'none') return NONE_LIMITS;
  return PLAN_LIMITS[plan] || NONE_LIMITS;
};

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { start, end };
};

export const checkCreateLimit = async () => {
  // Subscriptions temporarily disabled: everything is unlimited.
  return { allowed: true };
};

export const isSubscriptionExpired = () => {
  // Subscriptions temporarily disabled: never block.
  return false;
};
