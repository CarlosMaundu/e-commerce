// src/components/orders/OrderTimeline.js — an order's updates (status
// changes and refund steps), newest first, in the shared Timeline. Steps
// without a comment get a plain-language line of their own.
import React from 'react';
import PropTypes from 'prop-types';
import {
  FiCheckCircle,
  FiClock,
  FiCornerUpLeft,
  FiCreditCard,
  FiDollarSign,
  FiPackage,
  FiShield,
  FiShoppingBag,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi';
import Timeline from '../common/Timeline';

const STEPS = {
  awaiting_payment: [
    <FiCreditCard key="i" />,
    'warning',
    'Waiting for payment.',
  ],
  pending: [
    <FiShoppingBag key="i" />,
    'info',
    'Order placed. It will be confirmed shortly.',
  ],
  processing: [
    <FiPackage key="i" />,
    'info',
    'Payment confirmed. The order is being prepared.',
  ],
  shipped: [
    <FiTruck key="i" />,
    'info',
    'On its way. A delivery partner has the parcel.',
  ],
  delivered: [<FiCheckCircle key="i" />, 'success', 'The order has arrived.'],
  cancelled: [<FiXCircle key="i" />, 'error', 'Order cancelled.'],
  refunded: [<FiCornerUpLeft key="i" />, 'success', 'Order refunded.'],
  refund_requested: [<FiShield key="i" />, 'warning', ''],
  refund_raised: [<FiCornerUpLeft key="i" />, 'info', ''],
  refund_started: [<FiCornerUpLeft key="i" />, 'info', ''],
  refund_approved: [<FiShield key="i" />, 'info', ''],
  refund_rejected: [<FiXCircle key="i" />, 'error', ''],
  refund_paid: [<FiDollarSign key="i" />, 'success', ''],
  refund_failed: [<FiXCircle key="i" />, 'error', ''],
};

/** history: [{ status, statusName, comment, date, notified }], oldest first. */
const OrderTimeline = ({ history, staff }) => (
  <Timeline
    testId="order-timeline"
    items={[...history].reverse().map((h, i) => {
      const [icon, tone, text] = STEPS[h.status] || [
        <FiClock key="i" />,
        'primary',
        '',
      ];
      return {
        key: i,
        icon,
        tone,
        title: h.statusName,
        text: h.comment || text,
        date: h.date,
        meta: staff && h.notified ? ['customer emailed'] : [],
        testId: h.kind === 'refund' ? 'timeline-refund' : undefined,
      };
    })}
  />
);

OrderTimeline.propTypes = {
  history: PropTypes.array.isRequired,
  staff: PropTypes.bool,
};

export default OrderTimeline;
