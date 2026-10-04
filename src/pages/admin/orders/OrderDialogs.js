// src/pages/admin/orders/OrderDialogs.js — dialogs used on the order and
// invoice pages: record a payment, refund, edit an order; and the product
// picker shared with "Create order".
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import { adminCatalog, adminFinance } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import OptionRows from '../../../components/common/OptionRows';
import { formatMoney, getCurrency } from '../../../utils/format';

export const MANUAL_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank', label: 'Bank transfer' },
];
export const METHOD_NAMES = {
  stripe: 'Card (Stripe)',
  cod: 'Cash on delivery',
  cash: 'Cash',
  mpesa: 'M-Pesa',
  bank: 'Bank transfer',
  invoice: 'Invoice (pay later)',
};
export const DELIVERY_NAMES = {
  standard: 'Standard delivery',
  express: 'Express delivery',
  pickup: 'Pick up in store',
};

const money = (v) => ({
  startAdornment: (
    <InputAdornment position="start">{getCurrency()}</InputAdornment>
  ),
});

// ---------- record a payment ----------

export const RecordPaymentDialog = ({ open, invoice, onClose, onDone }) => {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && invoice)
      setForm({
        method: 'mpesa',
        amount: invoice.balance,
        reference: '',
        received_at: new Date().toISOString().slice(0, 10),
        note: '',
      });
    setErrors({});
  }, [open, invoice]);

  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      await adminFinance.recordPayment(invoice.invoice_id, {
        ...form,
        amount: Number(form.amount),
      });
      notify.success('Payment recorded.');
      onDone();
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t record the payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Record a payment</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {invoice.number} · balance{' '}
          {formatMoney(invoice.balance, invoice.currency)}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Paid by"
              value={form.method}
              onChange={set('method')}
              fullWidth
            >
              {MANUAL_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Amount"
              type="number"
              value={form.amount}
              onChange={set('amount')}
              InputProps={money()}
              error={Boolean(errors.amount)}
              helperText={errors.amount}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={form.method === 'mpesa' ? 'M-Pesa code' : 'Reference'}
              value={form.reference}
              onChange={set('reference')}
              placeholder={
                form.method === 'mpesa'
                  ? 'e.g. QFT1A2B3C4'
                  : 'Receipt or transfer number'
              }
              required={form.method !== 'cash'}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Received on"
              type="date"
              value={form.received_at}
              onChange={set('received_at')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Note (optional)"
              value={form.note}
              onChange={set('note')}
              fullWidth
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Record payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
RecordPaymentDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  invoice: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
};

// ---------- refund ----------

export const RefundDialog = ({ open, order, money: m, onClose, onDone }) => {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const settings = m?.refund_settings || {};
  const goodsLeft = m
    ? Math.max(0, m.refundable.amount - m.refundable.delivery)
    : 0;

  useEffect(() => {
    if (open && m)
      setForm({
        items: goodsLeft,
        delivery: Boolean(settings.refund_delivery),
        fee: true,
        reason: '',
        method: '',
      });
  }, [open, m, goodsLeft, settings.refund_delivery]);

  if (!form || !m) return null;
  const items = Number(form.items) || 0;
  const fee = form.fee
    ? Math.round(items * (settings.restocking_fee_percent || 0)) / 100
    : 0;
  const delivery = form.delivery ? m.refundable.delivery : 0;
  const payout = Math.round((items + delivery - fee) * 100) / 100;
  const needsApproval =
    settings.approval_threshold !== null &&
    settings.approval_threshold !== undefined &&
    payout > settings.approval_threshold;

  const save = async () => {
    setBusy(true);
    try {
      const r = await adminFinance.refund(order.id, {
        items_amount: items,
        include_delivery: form.delivery,
        apply_fee: form.fee,
        reason: form.reason,
        ...(form.method ? { method: form.method } : {}),
      });
      notify.success(
        r.status === 'processed'
          ? `Refunded ${formatMoney(r.amount, order.currency)}.`
          : 'Refund saved. It needs approval before it’s paid.'
      );
      onDone();
    } catch (error) {
      notify.error(error, 'We couldn’t create the refund.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Refund order #{order.id}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            Up to {formatMoney(m.refundable.amount, order.currency)} can still
            be refunded.{' '}
            {order.paymentMethod === 'stripe'
              ? 'Card payments go back to the card through Stripe.'
              : 'Record how you paid the money back.'}
          </Typography>
          <TextField
            label="Value of goods to refund"
            type="number"
            value={form.items}
            onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))}
            InputProps={money()}
            helperText="As charged, including any tax in the price."
            fullWidth
          />
          {m.refundable.delivery > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.delivery}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, delivery: e.target.checked }))
                  }
                />
              }
              label={`Refund the delivery charge (${formatMoney(m.refundable.delivery, order.currency)})`}
            />
          )}
          {settings.restocking_fee_percent > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.fee}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fee: e.target.checked }))
                  }
                />
              }
              label={`Keep the ${settings.restocking_fee_percent}% restocking fee`}
            />
          )}
          {order.paymentMethod !== 'stripe' && (
            <TextField
              select
              label="Paid back by"
              value={form.method || 'cash'}
              onChange={(e) =>
                setForm((f) => ({ ...f, method: e.target.value }))
              }
              fullWidth
            >
              {MANUAL_METHODS.map((x) => (
                <MenuItem key={x.value} value={x.value}>
                  {x.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            required
            multiline
            minRows={2}
            fullWidth
          />
          <Box
            sx={{ bgcolor: 'background.neutral', borderRadius: '8px', p: 2 }}
          >
            {[
              ['Goods', items],
              ['Delivery', delivery],
              ...(fee ? [['Restocking fee kept', -fee]] : []),
            ].map(([l, v]) => (
              <Stack key={l} direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {l}
                </Typography>
                <Typography variant="body2">
                  {formatMoney(v, order.currency)}
                </Typography>
              </Stack>
            ))}
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle2">Customer gets back</Typography>
              <Typography variant="subtitle2" data-testid="refund-payout">
                {formatMoney(payout, order.currency)}
              </Typography>
            </Stack>
          </Box>
          {needsApproval && (
            <Alert severity="info">
              This is above the{' '}
              {formatMoney(settings.approval_threshold, order.currency)}{' '}
              approval limit. Unless you can approve refunds, it waits for
              someone who can.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={save}
          disabled={busy || !(payout > 0) || form.reason.trim().length < 3}
        >
          {busy
            ? 'Refunding…'
            : `Refund ${formatMoney(payout, order.currency)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
RefundDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  order: PropTypes.object.isRequired,
  money: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
};

// ---------- product picker (create and edit orders) ----------

const variantLabel = (v) => Object.values(v.options).join(' / ');

/** Search a product, pick its variant and quantity, then add the line. */
export const ProductPicker = ({ onAdd }) => {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [product, setProduct] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (q.trim().length < 2) {
      setOptions([]);
      return undefined;
    }
    let active = true;
    const t = setTimeout(() => {
      adminCatalog
        .listProducts({ search: q.trim(), limit: 10 })
        .then((r) => active && setOptions(r.products))
        .catch(() => {});
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  const variant = product?.variants.find(
    (v) => String(v.id) === String(variantId)
  );
  const ready = product && (!product.hasOptions || variant);
  const unit = variant
    ? variant.unitPrice
    : product
      ? (product.specialPrice ?? product.price)
      : 0;

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      alignItems={{ md: 'flex-start' }}
    >
      <Autocomplete
        sx={{ flex: 2, minWidth: 0 }}
        options={options}
        value={product}
        filterOptions={(x) => x}
        getOptionLabel={(p) => p.title}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onInputChange={(_, v) => setQ(v)}
        onChange={(_, p) => {
          setProduct(p);
          setVariantId('');
        }}
        renderOption={(props, p) => (
          <li {...props} key={p.id}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src={p.images[0]}
                alt=""
                sx={{
                  width: 36,
                  height: 36,
                  objectFit: 'contain',
                  borderRadius: '6px',
                  bgcolor: 'background.neutral',
                }}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {p.title}
                </Typography>
                <Typography variant="caption">
                  {p.sku || 'No SKU'} · {formatMoney(p.minPrice)}
                </Typography>
              </Box>
            </Stack>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Find a product"
            placeholder="Name or SKU"
          />
        )}
        noOptionsText={
          q.trim().length < 2 ? 'Type to search' : 'No products found'
        }
      />
      {product?.hasOptions && (
        <TextField
          select
          label="Option"
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          sx={{ flex: 1.5, minWidth: 180 }}
        >
          {product.variants.map((v) => (
            <MenuItem key={v.id} value={v.id} disabled={!v.inStock}>
              {variantLabel(v)} · {formatMoney(v.unitPrice)}
              {!v.inStock ? ' (out of stock)' : ''}
            </MenuItem>
          ))}
        </TextField>
      )}
      <TextField
        label="Qty"
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        inputProps={{ min: 1 }}
        sx={{ width: 96 }}
      />
      <Button
        variant="outlined"
        startIcon={<FiPlus />}
        disabled={!ready}
        sx={{ height: 56, flexShrink: 0 }}
        onClick={() => {
          onAdd({
            product_id: product.id,
            variant_id: variant?.id ?? null,
            quantity,
            title: product.title,
            image: variant?.images?.[0] || product.images[0],
            options: variant?.options || {},
            unitPrice: unit,
          });
          setProduct(null);
          setVariantId('');
          setQuantity(1);
        }}
      >
        Add
      </Button>
    </Stack>
  );
};
ProductPicker.propTypes = { onAdd: PropTypes.func.isRequired };

/** Editable list of order lines. */
export const LineItems = ({ lines, onChange, currency }) => (
  <Stack divider={<Divider />}>
    {lines.map((l, i) => (
      <Stack
        key={`${l.product_id}-${l.variant_id}-${i}`}
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ py: 1.5 }}
      >
        <Box
          component="img"
          src={l.image}
          alt=""
          sx={{
            width: 56,
            height: 56,
            objectFit: 'contain',
            borderRadius: '8px',
            bgcolor: 'background.neutral',
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">{l.title}</Typography>
          <OptionRows options={l.options} dense />
          <Typography variant="caption">
            {formatMoney(l.unitPrice, currency)} each
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton
            size="small"
            aria-label={`Fewer ${l.title}`}
            disabled={l.quantity <= 1}
            onClick={() =>
              onChange(
                lines.map((x, j) =>
                  j === i ? { ...x, quantity: x.quantity - 1 } : x
                )
              )
            }
          >
            <FiMinus />
          </IconButton>
          <Typography
            sx={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}
          >
            {l.quantity}
          </Typography>
          <IconButton
            size="small"
            aria-label={`More ${l.title}`}
            onClick={() =>
              onChange(
                lines.map((x, j) =>
                  j === i ? { ...x, quantity: x.quantity + 1 } : x
                )
              )
            }
          >
            <FiPlus />
          </IconButton>
        </Stack>
        <Typography sx={{ minWidth: 110, textAlign: 'right', fontWeight: 600 }}>
          {formatMoney(l.unitPrice * l.quantity, currency)}
        </Typography>
        <IconButton
          aria-label={`Remove ${l.title}`}
          color="error"
          onClick={() => onChange(lines.filter((_, j) => j !== i))}
        >
          <FiTrash2 />
        </IconButton>
      </Stack>
    ))}
    {!lines.length && (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No items yet. Find a product above to add it.
      </Typography>
    )}
  </Stack>
);
LineItems.propTypes = {
  lines: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  currency: PropTypes.string,
};

// ---------- address fields ----------

export const ADDRESS_FIELDS = [
  ['firstName', 'First name', 6],
  ['lastName', 'Last name', 6],
  ['line1', 'Street address', 12],
  ['line2', 'Apartment, suite (optional)', 12],
  ['city', 'City or town', 6],
  ['region', 'County or region', 6],
  ['postcode', 'Postcode', 6],
  ['phone', 'Phone', 6],
];

export const addressToApi = (a) => ({
  firstname: a.firstName || '',
  lastname: a.lastName || '',
  company: a.company || '',
  address_1: a.line1 || '',
  address_2: a.line2 || '',
  city: a.city || '',
  postcode: a.postcode || '',
  country: (a.country || 'KE').toUpperCase(),
  zone: a.region || '',
  telephone: a.phone || '',
});

export const AddressFields = ({ value, onChange }) => (
  <Grid container spacing={2}>
    {ADDRESS_FIELDS.map(([key, label, width]) => (
      <Grid item xs={12} sm={width} key={key}>
        <TextField
          label={label}
          value={value[key] || ''}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          fullWidth
          size="small"
        />
      </Grid>
    ))}
  </Grid>
);
AddressFields.propTypes = {
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

// ---------- edit order ----------

export const EditOrderDialog = ({
  open,
  order,
  canEditItems,
  onClose,
  onDone,
}) => {
  const notify = useNotify();
  const [lines, setLines] = useState([]);
  const [address, setAddress] = useState({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLines(
      order.items.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId ?? null,
        quantity: i.quantity,
        title: i.title,
        image: i.image,
        options: i.options,
        unitPrice: i.price,
      }))
    );
    setAddress({ ...order.shippingAddress });
    setComment(order.comment || '');
  }, [open, order]);

  const changedItems = useMemo(
    () =>
      lines.length !== order.items.length ||
      lines.some(
        (l, i) =>
          l.quantity !== order.items[i]?.quantity ||
          l.product_id !== order.items[i]?.productId
      ),
    [lines, order.items]
  );

  const save = async () => {
    setBusy(true);
    try {
      await adminFinance.editOrder(order.id, {
        shipping_address: addressToApi(address),
        comment,
        ...(canEditItems && changedItems
          ? {
              items: lines.map((l) => ({
                product_id: l.product_id,
                variant_id: l.variant_id,
                quantity: l.quantity,
              })),
            }
          : {}),
      });
      notify.success('Order updated.');
      onDone();
    } catch (error) {
      notify.error(error, 'We couldn’t update the order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Edit order #{order.id}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Items
            </Typography>
            {canEditItems ? (
              <Stack spacing={1.5}>
                <ProductPicker
                  onAdd={(line) => setLines((ls) => [...ls, line])}
                />
                <LineItems
                  lines={lines}
                  onChange={setLines}
                  currency={order.currency}
                />
                {changedItems && (
                  <Alert severity="info">
                    Totals and the invoice are recalculated when you save.
                  </Alert>
                )}
              </Stack>
            ) : (
              <Alert severity="info">
                Items can only change while the order is unpaid and hasn’t
                shipped. Refund instead.
              </Alert>
            )}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Delivery address
            </Typography>
            <AddressFields value={address} onChange={setAddress} />
          </Box>
          <TextField
            label="Delivery note"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || !lines.length}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
EditOrderDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  order: PropTypes.object.isRequired,
  canEditItems: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
};
