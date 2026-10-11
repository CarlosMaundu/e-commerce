// src/pages/admin/orders/AdminReturnDetail.js — one return in the back
// office: the item and why it's coming back, every step so far (with who did
// it, and staff-only notes), the customer, the order, the refund it led to,
// and buttons for the next step.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Grid, Link, Stack, Typography } from '@mui/material';
import { FiEdit3, FiRotateCcw } from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission } from '../../../auth/permissions';
import { adminOrders } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import { EmptyState, SectionCard } from '../../../components/ui';
import { PageHeader, Pill } from '../../../components/admin/DataTable';
import { formatDateTime, formatMoney } from '../../../utils/format';
import ReturnTimeline from '../../../components/returns/ReturnTimeline';
import {
  REFUND_PILL,
  RETURN_ACTIONS,
  RETURN_STATES,
  ReturnActionDialog,
} from './ReturnActions';
import {
  FieldRowsSkeleton,
  ItemRowsSkeleton,
  LinesSkeleton,
  TimelineSkeleton,
} from '../../../components/skeletons';

const Row = ({ label, children }) => (
  <Stack direction="row" spacing={2} justifyContent="space-between">
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
      {children}
    </Typography>
  </Stack>
);
Row.propTypes = { label: PropTypes.string, children: PropTypes.node };

const AdminReturnDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const [item, setItem] = useState(null);
  const [missing, setMissing] = useState(false);
  const [action, setAction] = useState(null);
  const canUpdate = hasPermission(user, 'orders.returns.update');

  const load = useCallback(
    () =>
      adminOrders
        .getReturn(id)
        .then(setItem)
        .catch((error) => {
          if (error?.status === 404 || error?.response?.status === 404) {
            setMissing(true);
          } else notify.error(error, 'We couldn’t load this return.');
        }),
    [id, notify]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (missing) {
    return (
      <SectionCard>
        <EmptyState icon={<FiRotateCcw />} title="Return not found">
          <Link component={RouterLink} to="/admin/returns">
            Back to returns
          </Link>
        </EmptyState>
      </SectionCard>
    );
  }

  const [label, tone] = item
    ? RETURN_STATES[item.status] || [item.status, 'default']
    : [];
  const actions = item && canUpdate ? RETURN_ACTIONS[item.status] || [] : [];
  const [refundLabel, refundTone] = item?.refund
    ? REFUND_PILL[item.refund.status] || [item.refund.status, 'default']
    : [];

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Returns', to: '/admin/returns' },
          { label: `#${id}`, to: `/admin/returns/${id}` },
        ]}
        title={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <span>Return #{id}</span>
            {item && <Pill label={label} tone={tone} />}
          </Stack>
        }
        subtitle={
          item
            ? `Requested ${formatDateTime(item.date)} · order ${item.orderNumber}`
            : ' '
        }
        actions={
          item && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {canUpdate && (
                <Button
                  variant="outlined"
                  startIcon={<FiEdit3 />}
                  onClick={() => setAction('note')}
                  sx={{ bgcolor: 'background.paper' }}
                >
                  Add note
                </Button>
              )}
              {actions.map((a) => (
                <Button
                  key={a.status}
                  variant={a.color ? 'outlined' : 'contained'}
                  color={a.color || 'primary'}
                  onClick={() => setAction(a.status)}
                  sx={a.color ? { bgcolor: 'background.paper' } : undefined}
                >
                  {a.status === 'rejected' ? 'Reject' : a.label}
                </Button>
              ))}
            </Stack>
          )
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            <SectionCard title="Item">
              {!item ? (
                <ItemRowsSkeleton rows={1} image={72} />
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      component="img"
                      src={item.image}
                      alt=""
                      sx={{
                        width: 72,
                        height: 72,
                        objectFit: 'contain',
                        borderRadius: 1,
                        bgcolor: 'background.neutral',
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1">
                        {item.quantity} × {item.product}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.reasonName}
                        {item.opened ? ' · opened' : ' · unopened'}
                      </Typography>
                    </Box>
                    {item.amount !== undefined && (
                      <Typography sx={{ fontWeight: 700 }}>
                        {formatMoney(item.amount)}
                      </Typography>
                    )}
                  </Stack>
                  {item.comment && (
                    <Box
                      sx={{
                        bgcolor: 'background.neutral',
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      <Typography variant="caption" component="div">
                        From the customer
                      </Typography>
                      <Typography variant="body2">{item.comment}</Typography>
                    </Box>
                  )}
                </Stack>
              )}
            </SectionCard>
            <SectionCard title="Return updates">
              {!item ? (
                <TimelineSkeleton rows={4} />
              ) : (
                <ReturnTimeline events={item.events} staff />
              )}
            </SectionCard>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <SectionCard title="Customer">
              {!item ? (
                <LinesSkeleton lines={2} />
              ) : (
                <Stack spacing={0.5}>
                  {item.customer?.customer_id ? (
                    <Link
                      component={RouterLink}
                      to={`/admin/users/${item.customer.customer_id}`}
                      underline="hover"
                      sx={{ fontWeight: 700 }}
                    >
                      {item.customer.name || item.customer.email}
                    </Link>
                  ) : (
                    <Typography sx={{ fontWeight: 700 }}>
                      {item.customer?.name || '—'}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {item.customer?.email}
                  </Typography>
                </Stack>
              )}
            </SectionCard>
            <SectionCard title="Details">
              {!item ? (
                <FieldRowsSkeleton rows={3} />
              ) : (
                <Stack spacing={1.25}>
                  <Row label="Order">
                    <Link
                      component={RouterLink}
                      to={`/admin/orders/${item.orderId}`}
                      underline="hover"
                    >
                      {item.orderNumber}
                    </Link>
                  </Row>
                  <Row label="Item received">
                    {item.receivedAt ? formatDateTime(item.receivedAt) : '—'}
                  </Row>
                  <Row label="Back in stock">
                    {item.restocked === null
                      ? '—'
                      : item.restocked
                        ? 'Yes'
                        : 'No'}
                  </Row>
                </Stack>
              )}
            </SectionCard>
            <SectionCard title="Refund">
              {!item ? (
                <LinesSkeleton lines={3} />
              ) : item.refund ? (
                <Stack spacing={1.25} alignItems="flex-start">
                  <Pill label={refundLabel} tone={refundTone} />
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatMoney(item.refund.amount)}
                  </Typography>
                  <Link
                    component={RouterLink}
                    to={`/admin/refunds?tab=${
                      item.refund.status === 'pending_approval'
                        ? 'pending'
                        : item.refund.status === 'rejected'
                          ? 'rejected'
                          : 'approved'
                    }&search=${item.orderId}`}
                    underline="hover"
                    variant="body2"
                  >
                    {item.refund.status === 'pending_approval'
                      ? 'Review in the approval queue'
                      : `Refund #${item.refund.id}`}
                  </Link>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No refund yet. Refund the customer once the item is back.
                </Typography>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <ReturnActionDialog
        item={action ? item : null}
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          load();
        }}
      />
    </Stack>
  );
};

export default AdminReturnDetail;
