// src/components/returns/ReturnTimeline.js — a return's steps, newest
// first, in the shared Timeline. Staff also see who did each step and
// staff-only notes.
import React from 'react';
import PropTypes from 'prop-types';
import {
  FiCheck,
  FiCornerUpLeft,
  FiEdit3,
  FiPackage,
  FiRotateCcw,
  FiShield,
  FiXCircle,
} from 'react-icons/fi';
import Timeline from '../common/Timeline';
import { Pill } from '../admin/DataTable';

const STEPS = {
  requested: [
    <FiRotateCcw key="i" />,
    'warning',
    'We’ve got the return request.',
  ],
  approved: [
    <FiCheck key="i" />,
    'info',
    'Approved. The item can be sent back.',
  ],
  received: [<FiPackage key="i" />, 'primary', 'The item is back with us.'],
  refund_requested: [<FiShield key="i" />, 'warning', ''],
  refund_rejected: [<FiXCircle key="i" />, 'error', ''],
  refunded: [<FiCornerUpLeft key="i" />, 'success', ''],
  rejected: [<FiXCircle key="i" />, 'error', ''],
  note: [<FiEdit3 key="i" />, 'primary', ''],
};

/** events: [{ status, name, note, date, by, internal }], oldest first. */
const ReturnTimeline = ({ events, staff }) => (
  <Timeline
    testId="return-timeline"
    items={[...events].reverse().map((e, i) => {
      const [icon, tone, text] = STEPS[e.status] || [
        <FiCheck key="i" />,
        'primary',
        '',
      ];
      return {
        key: i,
        icon,
        tone,
        title: e.name,
        text: e.note || text,
        date: e.date,
        meta: staff && e.by ? [e.by] : [],
        badge:
          staff && e.internal ? (
            <Pill label="Staff only" tone="default" />
          ) : null,
      };
    })}
  />
);

ReturnTimeline.propTypes = {
  events: PropTypes.array.isRequired,
  staff: PropTypes.bool,
};

export default ReturnTimeline;
