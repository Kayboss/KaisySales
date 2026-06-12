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

export const checkCreateLimit = async (supabase, uid, plan, type) => {
  const limits = getPlanLimits(plan);
  if (!supabase) return { allowed: true };

  let limit, table, dateField;
  if (type === 'sales') {
    limit = limits.maxSalesMonth;
    table = 'sales';
    dateField = 'date';
  } else if (type === 'invoices') {
    limit = limits.maxInvoicesMonth;
    table = 'invoices';
    dateField = 'date';
  } else if (type === 'products') {
    limit = limits.maxProducts;
    table = 'inventory';
    dateField = 'created_at';
  } else {
    return { allowed: true };
  }

  if (limit === -1) return { allowed: true };

  const { start, end } = getMonthRange();
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .gte(dateField, start)
    .lte(dateField, end);

  if (error) return { allowed: true };

  if (count >= limit) {
    const planName = plan === 'none' ? 'No plan' : plan.charAt(0).toUpperCase() + plan.slice(1);
    return {
      allowed: false,
      message: `${planName} plan limit reached: you can only create ${limit} ${type} per month. Upgrade to continue.`,
      current: count,
      limit,
    };
  }

  return { allowed: true };
};

export const isSubscriptionExpired = (plan, status, expiresAt) => {
  if (plan === 'none' || !plan) return true;
  if (plan === 'gold' || plan === 'silver') {
    if (status === 'confirmed') return false;
    if (expiresAt && new Date(expiresAt) < new Date()) return true;
    return status !== 'pending';
  }
  if (plan === 'free') {
    if (expiresAt && new Date(expiresAt) < new Date()) return true;
  }
  return false;
};
