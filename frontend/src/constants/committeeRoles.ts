/** Executive committee roles — order matches /committee and /corporate-partnerships. */
export const COMMITTEE_ROLES = [
  'President',
  'Secretary',
  'Treasurer',
  'Cultural Director',
] as const;

export type CommitteeRole = (typeof COMMITTEE_ROLES)[number];
