export const PRO_MONTHLY_PRICE = 19.99;
export const INSTITUTIONAL_MONTHLY_PRICE = 199.99;

export const PRO_MONTHLY_PRICE_LABEL = `$${PRO_MONTHLY_PRICE.toFixed(2)}/mo`;
export const PRO_MONTHLY_PRICE_LABEL_LONG = `$${PRO_MONTHLY_PRICE.toFixed(2)}/month`;
export const INSTITUTIONAL_MONTHLY_PRICE_LABEL = `$${INSTITUTIONAL_MONTHLY_PRICE.toFixed(2)}/mo`;

export const PRO_STRIPE_PRICE_ID =
  import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1T0jBTRdPxQfs9UeRln3Uj68';
