// src/pages/admin/reports/SlaOrderPage.js — one order's fulfilment SLA:
// overall time against the target, each stage's duration against its own
// target with who (staff member or system) moved the order on, and the full
// status history.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { FiExternalLink } from 'react-icons/fi';
import { adminReports } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import { SectionCard } from '../../../components/ui';
import { PageHeader, Pill } from '../../../components/admin/DataTable';
import {
  daysText,
  hoursText,
  slaState,
  targetText,
} from '../../../components/admin/Sla';
import { formatDateTime } from '../../../utils/format';

const STATUS_NAMES = {
  placed: 'Placed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};
const DELIVERY = {
  standard: 'Standard',
  express: 'Express',
  pickup: 'Pick up',
};

const Fact = ({ label, children }) => (
  <Box
    sx={{
      p: 2,
      borderRadius: 1,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
    }}
  >
    <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
      {label}
    </Typography>
    <Box sx={{ mt: 0.5 }}>{children}</Box>
  </Box>
);
Fact.propTypes = { label: PropTypes.string, children: PropTypes.node };

const SlaOrderPage = () => {
  const { id } = useParams();
  const notify = useNotify();
  const [data, setData] = useState(null);

  useEffect(() => {
    adminReports
      .slaOrder(id)
      .then(setData)
      .catch((e) => notify.error(e, 'We couldn’t load this order’s SLA.'));
  }, [id, notify]);

  if (!data) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={280} height={56} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={260} />
      </Stack>
    );
  }

  const { order, sla, history } = data;
  const [label, tone] = slaState(sla.state);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'SLA performance', to: '/admin/reports/sla' },
          { label: order.number, to: `/admin/reports/sla/${order.id}` },
        ]}
        title={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <span>Order {order.number}</span>
            <Pill label={label} tone={tone} />
          </Stack>
        }
        subtitle={order.customer?.name || order.email}
        actions={
          <Button
            variant="contained"
            startIcon={<FiExternalLink />}
            component={RouterLink}
            to={`/admin/orders/${order.id}`}
          >
            View order
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <Fact label={sla.done ? 'Time to deliver' : 'Time so far'}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
            {daysText(sla.days)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Target {sla.target_days} days
          </Typography>
        </Fact>
        <Fact label="Placed">
          <Typography sx={{ fontWeight: 600 }}>
            {formatDateTime(sla.placed_at)}
          </Typography>
        </Fact>
        <Fact label="Delivered">
          <Typography sx={{ fontWeight: 600 }}>
            {sla.delivered_at ? formatDateTime(sla.delivered_at) : 'Not yet'}
          </Typography>
        </Fact>
        <Fact label="Delivery option">
          <Typography sx={{ fontWeight: 600 }}>
            {DELIVERY[order.shippingMethod] || order.shippingMethod}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Status: {order.statusName}
          </Typography>
        </Fact>
      </Box>

      <SectionCard
        title="Stages"
        subtitle="How long the order spent in each stage, and who moved it on."
      >
        <TableContainer>
          <Table aria-label="Stages">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Stage</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Finished</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Time taken</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Moved on by</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sla.stages.map((st) => {
                const [stLabel, stTone] = slaState(st.state);
                const share =
                  st.hours === null
                    ? 0
                    : Math.min(100, (st.hours / st.target_hours) * 100);
                return (
                  <TableRow
                    key={st.key}
                    data-testid={`sla-stage-row-${st.key}`}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {st.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {STATUS_NAMES[st.from]} → {STATUS_NAMES[st.to]}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {st.started_at ? formatDateTime(st.started_at) : '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {st.finished_at
                        ? formatDateTime(st.finished_at)
                        : st.started_at
                          ? 'In progress'
                          : '—'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {hoursText(st.hours)}{' '}
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          of {targetText(st.target_hours)}
                        </Typography>
                      </Typography>
                      {st.hours !== null && (
                        <LinearProgress
                          variant="determinate"
                          value={share}
                          color={
                            st.state === 'breached'
                              ? 'error'
                              : st.state === 'at_risk'
                                ? 'warning'
                                : 'success'
                          }
                          sx={{ mt: 0.75, height: 6, borderRadius: 3 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Pill label={stLabel} tone={stTone} />
                    </TableCell>
                    <TableCell>{st.by || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard title="Status history">
        <TableContainer>
          <Table size="small" aria-label="Status history">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>When</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {h.status_name}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(h.at)}
                  </TableCell>
                  <TableCell>{h.by}</TableCell>
                  <TableCell>{h.comment || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </Stack>
  );
};

export default SlaOrderPage;
