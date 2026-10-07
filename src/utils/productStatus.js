// src/utils/productStatus.js — product lifecycle labels shared by the
// product list and editor. Only Active products are visible in the shop.
export const PRODUCT_STATUSES = [
  {
    value: 'published',
    label: 'Active',
    tone: 'success',
    help: 'Visible and for sale in the shop',
  },
  {
    value: 'inactive',
    label: 'Inactive',
    tone: 'default',
    help: 'Hidden from the shop for now',
  },
  {
    value: 'draft',
    label: 'Draft',
    tone: 'warning',
    help: 'Still being prepared; only staff can see it',
  },
  {
    value: 'archived',
    label: 'Archive',
    tone: 'error',
    help: 'Retired; kept for past orders and records',
  },
];

export const statusInfo = (value) =>
  PRODUCT_STATUSES.find((s) => s.value === value) || {
    value,
    label: value,
    tone: 'default',
  };
