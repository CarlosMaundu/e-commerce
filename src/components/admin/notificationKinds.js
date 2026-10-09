// src/components/admin/notificationKinds.js — how each kind of back-office
// notification looks (icon, colour, name), shared by the bell and the
// Notifications page.
import React from 'react';
import {
  FiAlertTriangle,
  FiBox,
  FiDollarSign,
  FiFileText,
  FiGift,
  FiLifeBuoy,
  FiRotateCcw,
  FiShoppingBag,
} from 'react-icons/fi';

export const NOTIFICATION_KINDS = {
  order: { icon: <FiShoppingBag />, tone: 'primary', name: 'New order' },
  delayed: { icon: <FiAlertTriangle />, tone: 'error', name: 'Waiting order' },
  gift: { icon: <FiGift />, tone: 'secondary', name: 'Gift to prepare' },
  return: { icon: <FiRotateCcw />, tone: 'warning', name: 'Return' },
  refund: {
    icon: <FiDollarSign />,
    tone: 'warning',
    name: 'Refund to approve',
  },
  invoice: { icon: <FiFileText />, tone: 'error', name: 'Overdue invoice' },
  stock: { icon: <FiBox />, tone: 'warning', name: 'Stock' },
  support: { icon: <FiLifeBuoy />, tone: 'info', name: 'Support request' },
};

export const kindOf = (kind) =>
  NOTIFICATION_KINDS[kind] || NOTIFICATION_KINDS.order;

/** "5 min ago", "3 h ago", "yesterday", "4 days ago". */
export const timeAgo = (at) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(at)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
