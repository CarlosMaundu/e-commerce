// src/pages/admin/orders/AdminOrderDetail.js — one order in the back office:
// items with every chosen option, totals, payments and refunds, history;
// beside them the status update, the customer (linking to their profile),
// both addresses, delivery and the invoice. Staff can edit the order, record
// a payment, refund, and open the invoice.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  Link,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  FiCreditCard,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiGift,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRotateCcw,
  FiTruck,
} from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../auth/permissions';
import { adminFinance, adminOrders } from '../../../api';
import { formatAddress } from '../../../api/mappers';
import { useNotify } from '../../../notification/NotificationProvider';
import { SectionCard, StatusChip } from '../../../components/ui';
import { PageHeader, Pill } from '../../../components/admin/DataTable';
import OptionRows from '../../../components/common/OptionRows';
import GiftNote from '../../../components/common/GiftNote';
import { daysText, slaState } from '../../../components/admin/Sla';
import { initialsOf } from '../../../components/common/BrandMark';
import { countryName } from '../../../components/account/AddressForm';
import { formatDate, formatDateTime, formatMoney } from '../../../utils/format';
import {
  DELIVERY_NAMES,
  EditOrderDialog,
  METHOD_NAMES,
  RecordPaymentDialog,
  RefundDialog,
} from './OrderDialogs';

const STATUS_NAMES = {
  awaiting_payment: 'Awaiting payment',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};
const INVOICE_STATES = {
  issued: ['Due', 'warning'],
  partially_paid: ['Part paid', 'warning'],
  paid: ['Paid', 'success'],
  void: ['Void', 'default'],
  refunded: ['Refunded', 'info'],
  partially_refunded: ['Part refunded', 'info'],
};

const AddressCard = ({ title, address, icon }) => (
  <SectionCard title={title}>
    {address ? (
      <Stack direction="row" spacing={1.5}>
        <Box sx={{ color: 'primary.main', mt: 0.25 }}>{icon}</Box>
        <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
          <strong>
            {`${address.firstName || ''} ${address.lastName || ''}`.trim()}
          </strong>
          <br />
          {formatAddress({ ...address, country: countryName(address.country) })}
          {address.phone && (
            <>
              <br />
              {address.phone}
            </>
          )}
        </Typography>
      </Stack>
    ) : (
      <Typography variant="body2" color="text.secondary">
        Not given.
      </Typography>
    )}
  </SectionCard>
);
AddressCard.propTypes = {
  title: PropTypes.string.isRequired,
  address: PropTypes.object,
  icon: PropTypes.node,
};

const AdminOrderDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const can = (p) => hasPermission(user, p);
  const [order, setOrder] = useState(null);
  const [money, setMoney] = useState(null);
  const [form, setForm] = useState({ status: '', comment: '', notify: true });
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null); // 'edit' | 'pay' | 'refund'

  const load = useCallback(async () => {
    try {
      const o = await adminOrders.get(id);
      setOrder(o);
      setForm({ status: o.status, comment: '', notify: true });
      if (can(PERMISSIONS.invoicesView)) {
        setMoney(await adminFinance.orderMoney(id).catch(() => null));
      }
    } catch (error) {
      notify.error(error, 'We couldn’t load this order.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  // Gift instructions are ticked off before the order can be dispatched.
  const [giftBusy, setGiftBusy] = useState(null);
  const markGift = async (item, done) => {
    setGiftBusy(item.id);
    try {
      setOrder(await adminOrders.giftDone(id, item.id, done));
    } catch (error) {
      notify.error(error, 'We couldn’t update the gift.');
    } finally {
      setGiftBusy(null);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminOrders.updateStatus(id, form);
      notify.success(
        form.notify
          ? 'Order updated and the customer was emailed.'
          : 'Order updated.'
      );
      await load();
    } catch (error) {
      notify.error(error, 'We couldn’t update the order.');
    } finally {
      setSaving(false);
    }
  };

  if (!order) {
    return (
      <Stack spacing={3} data-testid="order-loading">
        <Skeleton variant="text" width={260} height={56} />
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Skeleton variant="rounded" height={420} />
          </Grid>
          <Grid item xs={12} lg={4}>
            <Skeleton variant="rounded" height={420} />
          </Grid>
        </Grid>
      </Stack>
    );
  }

  const invoice = money?.invoice;
  const unpaid = invoice && invoice.amount_paid === 0;
  const editableItems =
    unpaid &&
    ['pending', 'awaiting_payment', 'processing'].includes(order.status);
  const customerId = order.customer?.customer_id;
  const customerName = order.customer?.name || order.email;
  const [invLabel, invTone] = INVOICE_STATES[invoice?.status] || [
    '',
    'default',
  ];
  const ledgerRows = [
    ...(money?.payments || []).map((p) => ({ ...p, date: p.received_at })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));
  const gifts = order.items.filter((i) => i.gift);
  const openGifts = gifts.filter((i) => !i.gift.done).length;
  const pendingRefunds = (money?.refunds || []).filter(
    (r) => r.status === 'pending_approval'
  );

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Orders', to: '/admin/orders' },
          { label: order.number, to: `/admin/orders/${order.id}` },
        ]}
        title={
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            component="span"
          >
            <span>Order {order.number}</span>
            <StatusChip status={order.status} label={order.statusName} />
            {invoice && <Pill label={invLabel} tone={invTone} />}
          </Stack>
        }
        subtitle={`Placed ${formatDateTime(order.placedAt)}`}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {can('orders.orders.update') && (
              <Button
                variant="outlined"
                startIcon={<FiEdit2 />}
                onClick={() => setDialog('edit')}
              >
                Edit order
              </Button>
            )}
            {invoice &&
              invoice.balance > 0 &&
              !['void'].includes(invoice.status) &&
              can(PERMISSIONS.paymentsRecord) && (
                <Button
                  variant="outlined"
                  startIcon={<FiCreditCard />}
                  onClick={() => setDialog('pay')}
                >
                  Record payment
                </Button>
              )}
            {money &&
              money.refundable.amount > 0 &&
              can('orders.orders.refund') && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<FiRotateCcw />}
                  onClick={() => setDialog('refund')}
                >
                  Refund
                </Button>
              )}
            {invoice && (
              <Button
                variant="contained"
                startIcon={<FiFileText />}
                component={RouterLink}
                to={`/admin/invoices/${invoice.invoice_id}`}
              >
                Invoice
              </Button>
            )}
          </Stack>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            {order.sla && order.sla.state !== 'not_tracked' && (
              <Box
                data-testid="order-sla"
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  alignItems: 'center',
                  p: 2,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>Fulfilment SLA</Typography>
                <Pill
                  label={slaState(order.sla.state)[0]}
                  tone={slaState(order.sla.state)[1]}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ flex: 1 }}
                >
                  {daysText(order.sla.days)}{' '}
                  {order.sla.done ? 'taken' : 'so far'} of a{' '}
                  {order.sla.targetDays}-day target
                  {order.sla.stages
                    .filter((st) => st.state === 'breached')
                    .map((st) => st.name).length
                    ? ` · late: ${order.sla.stages
                        .filter((st) => st.state === 'breached')
                        .map((st) => st.name)
                        .join(', ')}`
                    : ''}
                </Typography>
                <Button
                  size="small"
                  component={RouterLink}
                  to={`/admin/reports/sla/${order.id}`}
                >
                  Stage breakdown
                </Button>
              </Box>
            )}

            {gifts.length > 0 && (
              <SectionCard
                title="Before dispatch"
                sx={{
                  borderColor: openGifts ? 'warning.main' : 'success.main',
                  bgcolor: (t) =>
                    alpha(
                      openGifts
                        ? t.palette.warning.main
                        : t.palette.success.main,
                      0.06
                    ),
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {openGifts
                    ? `Special instructions: ${openGifts} gift${
                        openGifts > 1 ? 's' : ''
                      } to prepare. The order can’t be marked shipped until each one is ticked off.`
                    : 'All gift instructions are done. The order is ready to dispatch.'}
                </Typography>
                <Stack spacing={1.5}>
                  {gifts.map((item) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                      sx={{
                        p: 1.5,
                        borderRadius: '8px',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Checkbox
                        checked={!!item.gift.done}
                        disabled={
                          giftBusy === item.id || !can(PERMISSIONS.ordersUpdate)
                        }
                        onChange={(e) => markGift(item, e.target.checked)}
                        inputProps={{
                          'aria-label': `Gift prepared: ${item.title}`,
                        }}
                        sx={{ mt: -0.75 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>
                          <FiGift
                            style={{ verticalAlign: '-2px', marginRight: 6 }}
                          />
                          {item.title} × {item.quantity}
                        </Typography>
                        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                          <Typography component="li" variant="body2">
                            Label it to <strong>{item.gift.to}</strong> from{' '}
                            <strong>{item.gift.from}</strong>.
                          </Typography>
                          {item.gift.message && (
                            <Typography component="li" variant="body2">
                              Print on the packing slip: “{item.gift.message}”
                            </Typography>
                          )}
                          {item.gift.box && (
                            <Typography component="li" variant="body2">
                              Wrap it in the{' '}
                              <strong>{item.gift.box.name}</strong>.
                              {item.gift.box.image && (
                                <Box
                                  component="img"
                                  src={item.gift.box.image}
                                  alt=""
                                  sx={{
                                    display: 'block',
                                    mt: 0.5,
                                    width: 56,
                                    height: 56,
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                  }}
                                />
                              )}
                            </Typography>
                          )}
                          <Typography component="li" variant="body2">
                            Leave prices off the packing slip.
                          </Typography>
                        </Box>
                        {item.gift.done && (
                          <Typography variant="caption" color="success.main">
                            Done
                            {item.gift.doneBy ? ` by ${item.gift.doneBy}` : ''}
                            {item.gift.doneAt
                              ? ` · ${formatDateTime(item.gift.doneAt)}`
                              : ''}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            )}

            <SectionCard title={`Items (${order.items.length})`}>
              <Stack divider={<Divider />}>
                {order.items.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    spacing={2}
                    sx={{ py: 1.75 }}
                  >
                    <Box
                      component="img"
                      src={item.image}
                      alt=""
                      sx={{
                        width: 72,
                        height: 72,
                        objectFit: 'contain',
                        borderRadius: '8px',
                        bgcolor: 'background.neutral',
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {item.productId ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/products/${item.productId}`}
                          underline="hover"
                          color="text.primary"
                          sx={{ fontWeight: 600 }}
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <Typography sx={{ fontWeight: 600 }}>
                          {item.title}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.75 }}
                      >
                        {item.quantity} ×{' '}
                        {formatMoney(item.price, order.currency)}
                        {item.sku ? ` · SKU ${item.sku}` : ''}
                      </Typography>
                      <OptionRows options={item.options} dense />
                      <GiftNote gift={item.gift} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatMoney(item.total, order.currency)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={0.75} sx={{ maxWidth: 340, ml: 'auto' }}>
                {[
                  ['Subtotal', order.totals.subtotal],
                  order.totals.discount
                    ? [`Promo ${order.coupon || ''}`, -order.totals.discount]
                    : null,
                  order.totals.gift ? ['Gift boxes', order.totals.gift] : null,
                  [
                    DELIVERY_NAMES[order.shippingMethod] || 'Delivery',
                    order.totals.shipping,
                  ],
                  ['Tax', order.totals.tax],
                ]
                  .filter(Boolean)
                  .map(([l, v]) => (
                    <Stack
                      key={l}
                      direction="row"
                      justifyContent="space-between"
                    >
                      <Typography color="text.secondary">{l}</Typography>
                      <Typography>{formatMoney(v, order.currency)}</Typography>
                    </Stack>
                  ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Total</Typography>
                  <Typography variant="subtitle1">
                    {formatMoney(order.total, order.currency)}
                  </Typography>
                </Stack>
                {invoice && (
                  <>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary">Paid</Typography>
                      <Typography>
                        {formatMoney(invoice.amount_paid, order.currency)}
                      </Typography>
                    </Stack>
                    {invoice.amount_refunded > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Refunded</Typography>
                        <Typography>
                          −{' '}
                          {formatMoney(invoice.amount_refunded, order.currency)}
                        </Typography>
                      </Stack>
                    )}
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{
                        bgcolor: 'background.neutral',
                        borderRadius: '8px',
                        px: 1.5,
                        py: 0.75,
                      }}
                    >
                      <Typography variant="subtitle2">Balance due</Typography>
                      <Typography
                        variant="subtitle2"
                        data-testid="order-balance"
                      >
                        {formatMoney(invoice.balance, order.currency)}
                      </Typography>
                    </Stack>
                  </>
                )}
              </Stack>
            </SectionCard>

            {money && (
              <SectionCard
                title="Payments and refunds"
                subtitle={`Paid by ${METHOD_NAMES[order.paymentMethod] || order.paymentMethod}`}
              >
                {ledgerRows.length ? (
                  <Stack divider={<Divider />}>
                    {ledgerRows.map((p) => (
                      <Stack
                        key={p.payment_id}
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{ py: 1.25 }}
                      >
                        <Pill
                          label={p.kind === 'refund' ? 'Refund' : 'Payment'}
                          tone={p.kind === 'refund' ? 'info' : 'success'}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {METHOD_NAMES[p.method] || p.method}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </Typography>
                          <Typography variant="caption">
                            {formatDateTime(p.date)}
                            {p.recorded_by ? ` · by ${p.recorded_by}` : ''}
                            {p.note ? ` · ${p.note}` : ''}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            color:
                              p.kind === 'refund'
                                ? 'error.main'
                                : 'text.primary',
                          }}
                        >
                          {p.kind === 'refund' ? '− ' : ''}
                          {formatMoney(p.amount, order.currency)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">
                    No payments yet.
                  </Typography>
                )}
                {pendingRefunds.length > 0 && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 1.5,
                      borderRadius: '8px',
                      bgcolor: (t) => alpha(t.palette.warning.main, 0.1),
                    }}
                  >
                    <Typography variant="body2">
                      {pendingRefunds.length} refund
                      {pendingRefunds.length === 1 ? '' : 's'} of{' '}
                      {formatMoney(
                        pendingRefunds.reduce((s, r) => s + r.amount, 0),
                        order.currency
                      )}{' '}
                      waiting for approval.{' '}
                      <Link
                        component={RouterLink}
                        to="/admin/refunds?status=pending_approval"
                      >
                        Review refunds
                      </Link>
                    </Typography>
                  </Box>
                )}
              </SectionCard>
            )}

            <SectionCard title="History">
              <Stack spacing={2}>
                {[...order.history].reverse().map((h, i) => (
                  <Stack key={i} direction="row" spacing={2}>
                    <StatusChip status={h.status} label={h.statusName} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption">
                        {formatDateTime(h.date)}
                        {h.notified ? ' · customer emailed' : ''}
                      </Typography>
                      {h.comment && (
                        <Typography variant="body2">{h.comment}</Typography>
                      )}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {can('orders.orders.update') && (
              <SectionCard title="Update status">
                <Stack component="form" spacing={2} onSubmit={save}>
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    helperText={
                      order.nextStatuses.length
                        ? 'Only valid next steps are offered.'
                        : 'This order is final.'
                    }
                  >
                    <MenuItem value={order.status}>
                      {STATUS_NAMES[order.status]} (current)
                    </MenuItem>
                    {order.nextStatuses.map((s) => (
                      <MenuItem key={s} value={s}>
                        {STATUS_NAMES[s]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Comment"
                    multiline
                    minRows={2}
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.notify}
                        onChange={(e) =>
                          setForm({ ...form, notify: e.target.checked })
                        }
                      />
                    }
                    label="Email the customer"
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      saving ||
                      (form.status === order.status && !form.comment.trim())
                    }
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </Stack>
              </SectionCard>
            )}

            <SectionCard title="Customer">
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    fontWeight: 700,
                    bgcolor: 'highlight.main',
                    color: 'text.primary',
                  }}
                >
                  {initialsOf(customerName)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  {customerId ? (
                    <Link
                      component={RouterLink}
                      to={`/admin/users/${customerId}`}
                      underline="hover"
                      sx={{ fontWeight: 700 }}
                      data-testid="order-customer-link"
                    >
                      {customerName}
                    </Link>
                  ) : (
                    <Typography sx={{ fontWeight: 700 }}>
                      {customerName}
                    </Typography>
                  )}
                  <Typography variant="caption" component="div">
                    Customer
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FiMail />
                  <Link
                    href={`mailto:${order.email}`}
                    variant="body2"
                    underline="hover"
                  >
                    {order.email}
                  </Link>
                </Stack>
                {order.shippingAddress?.phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FiPhone />
                    <Link
                      href={`tel:${order.shippingAddress.phone}`}
                      variant="body2"
                      underline="hover"
                    >
                      {order.shippingAddress.phone}
                    </Link>
                  </Stack>
                )}
              </Stack>
              {customerId && (
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/admin/users/${customerId}`}
                    endIcon={<FiExternalLink />}
                  >
                    Profile
                  </Button>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/admin/orders?customer=${customerId}&customerName=${encodeURIComponent(customerName)}`}
                  >
                    All their orders
                  </Button>
                </Stack>
              )}
            </SectionCard>

            <AddressCard
              title="Shipping address"
              address={order.shippingAddress}
              icon={<FiMapPin />}
            />
            <AddressCard
              title="Billing address"
              address={order.paymentAddress}
              icon={<FiCreditCard />}
            />

            <SectionCard title="Delivery">
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                  <FiTruck />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {DELIVERY_NAMES[order.shippingMethod] ||
                      order.shippingMethod}
                  </Typography>
                  {order.comment && (
                    <Typography variant="body2" color="text.secondary">
                      Note: {order.comment}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </SectionCard>

            {invoice && (
              <SectionCard
                title="Invoice"
                action={
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/admin/invoices/${invoice.invoice_id}`}
                  >
                    Open
                  </Button>
                }
              >
                <Stack spacing={0.75}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="subtitle2">
                      {invoice.number}
                    </Typography>
                    <Pill label={invLabel} tone={invTone} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Issued {formatDate(invoice.issued_at)}
                    {invoice.due_at && invoice.balance > 0
                      ? ` · due ${formatDate(invoice.due_at)}`
                      : ''}
                  </Typography>
                </Stack>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>

      <EditOrderDialog
        open={dialog === 'edit'}
        order={order}
        canEditItems={Boolean(editableItems)}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          load();
        }}
      />
      {invoice && (
        <RecordPaymentDialog
          open={dialog === 'pay'}
          invoice={invoice}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load();
          }}
        />
      )}
      <RefundDialog
        open={dialog === 'refund'}
        order={order}
        money={money}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          load();
        }}
      />
    </Stack>
  );
};

export default AdminOrderDetail;
