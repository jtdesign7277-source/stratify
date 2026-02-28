const DEFAULT_CREATOR_EMAIL_ALLOWLIST = [
  'jeff@stratify-associates.com',
];

const DEFAULT_CREATOR_DOMAIN_ALLOWLIST = [
  'stratify-associates.com',
];

const PRO_STATUS_SET = new Set([
  'pro',
  'elite',
  'active',
  'trialing',
  'paid',
]);

const parseCsvList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const CREATOR_EMAIL_ALLOWLIST = new Set([
  ...DEFAULT_CREATOR_EMAIL_ALLOWLIST,
  ...parseCsvList(import.meta.env.VITE_CREATOR_OVERRIDE_EMAILS),
]);

const CREATOR_DOMAIN_ALLOWLIST = new Set([
  ...DEFAULT_CREATOR_DOMAIN_ALLOWLIST,
  ...parseCsvList(import.meta.env.VITE_CREATOR_OVERRIDE_DOMAINS),
]);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const resolveUserEmail = (user) => {
  if (!user || typeof user !== 'object') return '';

  const direct = normalizeEmail(user.email);
  if (direct) return direct;

  const metadata = normalizeEmail(user?.user_metadata?.email);
  if (metadata) return metadata;

  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    const identityEmail = normalizeEmail(identity?.identity_data?.email);
    if (identityEmail) return identityEmail;
  }

  return '';
};

export const normalizeSubscriptionStatus = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const isProStatus = (value) =>
  PRO_STATUS_SET.has(normalizeSubscriptionStatus(value));

export const isCreatorOverrideUser = (user) => {
  const email = resolveUserEmail(user);
  if (!email) return false;

  if (CREATOR_EMAIL_ALLOWLIST.has(email)) {
    return true;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return false;
  const domain = email.slice(atIndex + 1);
  return CREATOR_DOMAIN_ALLOWLIST.has(domain);
};
