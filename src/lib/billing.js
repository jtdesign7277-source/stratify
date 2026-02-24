export const PRO_MONTHLY_PRICE = 19.99;
export const INSTITUTIONAL_MONTHLY_PRICE = 199.99;
export const PRO_YEARLY_DISCOUNT = 0.2;
export const PRO_YEARLY_PRICE = PRO_MONTHLY_PRICE * 12 * (1 - PRO_YEARLY_DISCOUNT);

export const PRO_BILLING_INTERVAL_MONTHLY = 'monthly';
export const PRO_BILLING_INTERVAL_YEARLY = 'yearly';
export const PRO_BILLING_INTERVAL_STORAGE_KEY = 'stratify_preferred_billing_interval';

export const PRO_MONTHLY_PRICE_LABEL = `$${PRO_MONTHLY_PRICE.toFixed(2)}/mo`;
export const PRO_MONTHLY_PRICE_LABEL_LONG = `$${PRO_MONTHLY_PRICE.toFixed(2)}/month`;
export const PRO_YEARLY_PRICE_LABEL = `$${PRO_YEARLY_PRICE.toFixed(2)}/year`;
export const PRO_YEARLY_DISCOUNT_LABEL = `${Math.round(PRO_YEARLY_DISCOUNT * 100)}% off`;
export const INSTITUTIONAL_MONTHLY_PRICE_LABEL = `$${INSTITUTIONAL_MONTHLY_PRICE.toFixed(2)}/mo`;

export const PRO_STRIPE_PRICE_ID =
  import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1T0jBTRdPxQfs9UeRln3Uj68';
export const PRO_YEARLY_STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID || '';

export const getPreferredProBillingInterval = () => {
  if (typeof window === 'undefined') return PRO_BILLING_INTERVAL_MONTHLY;

  try {
    const value = String(window.localStorage.getItem(PRO_BILLING_INTERVAL_STORAGE_KEY) || '').toLowerCase();
    return value === PRO_BILLING_INTERVAL_YEARLY
      ? PRO_BILLING_INTERVAL_YEARLY
      : PRO_BILLING_INTERVAL_MONTHLY;
  } catch {
    return PRO_BILLING_INTERVAL_MONTHLY;
  }
};

export const setPreferredProBillingInterval = (interval) => {
  if (typeof window === 'undefined') return;

  const normalized = String(interval || '').toLowerCase();
  const value = normalized === PRO_BILLING_INTERVAL_YEARLY
    ? PRO_BILLING_INTERVAL_YEARLY
    : PRO_BILLING_INTERVAL_MONTHLY;

  try {
    window.localStorage.setItem(PRO_BILLING_INTERVAL_STORAGE_KEY, value);
  } catch {
    // localStorage may be blocked; keep silent fallback.
  }
};

export const resolveProCheckoutPriceId = (preferredInterval = getPreferredProBillingInterval()) => {
  if (preferredInterval === PRO_BILLING_INTERVAL_YEARLY && PRO_YEARLY_STRIPE_PRICE_ID) {
    return PRO_YEARLY_STRIPE_PRICE_ID;
  }
  return PRO_STRIPE_PRICE_ID;
};
