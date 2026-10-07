// src/pages/admin/orders/CreateOrderPage.js — staff place an order for a
// customer (phone or walk-in orders): choose the customer, add products,
// pick their address or enter one, delivery and how they'll pay. The order
// is created with its invoice; a payment can be recorded straight away.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { adminFinance, adminUsers } from '../../../api';
import { formatAddress } from '../../../api/mappers';
import { useNotify } from '../../../notification/NotificationProvider';
import { SectionCard } from '../../../components/ui';
import { PageHeader } from '../../../components/admin/DataTable';
import { useHideHelpWhile } from '../../../layouts/AdminLayout';
import { formatMoney, getCurrency } from '../../../utils/format';
import {
  AddressFields,
  addressToApi,
  LineItems,
  MANUAL_METHODS,
  ProductPicker,
} from './OrderDialogs';

const CreateOrderPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('new');
  const [address, setAddress] = useState({ country: 'KE' });
  const [lines, setLines] = useState([]);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [shipping, setShipping] = useState('');
  const [payment, setPayment] = useState('invoice');
  const [dueDays, setDueDays] = useState(7);
  const [comment, setComment] = useState('');
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [paid, setPaid] = useState({
    method: 'mpesa',
    amount: '',
    reference: '',
  });
  const [busy, setBusy] = useState(false);
  useHideHelpWhile(true);

  useEffect(() => {
    adminUsers
      .list()
      .then((list) => {
        const shoppers = list.filter((u) => u.role === 'customer');
        setCustomers(shoppers);
        const preset = params.get('customer');
        if (preset)
          setCustomer(shoppers.find((u) => String(u.id) === preset) || null);
      })
      .catch(() => {});
    adminFinance
      .deliveryOptions()
      .then((list) => {
        setDeliveryOptions(list);
        setShipping(list[0]?.code || '');
      })
      .catch(() => {});
  }, [params]);

  useEffect(() => {
    setAddresses([]);
    setAddressId('new');
    if (!customer) return;
    const [first, ...rest] = (customer.name || '').split(' ');
    setAddress({ country: 'KE', firstName: first, lastName: rest.join(' ') });
    adminUsers
      .account(customer.id)
      .then((a) => {
        setAddresses(a.addresses || []);
        const def =
          (a.addresses || []).find((x) => x.isDefault) || a.addresses?.[0];
        if (def) setAddressId(def.id);
      })
      .catch(() => {});
  }, [customer]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [lines]
  );
  const delivery = deliveryOptions.find((d) => d.code === shipping);
  const ready =
    customer &&
    lines.length &&
    shipping &&
    (addressId !== 'new' ||
      (address.firstName && address.lastName && address.line1 && address.city));

  const submit = async () => {
    setBusy(true);
    try {
      const order = await adminFinance.createOrder({
        customer_id: customer.id,
        items: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
        })),
        ...(addressId !== 'new'
          ? { address_id: addressId }
          : { address: addressToApi(address) }),
        shipping_method: shipping,
        payment_method: payment,
        due_days: Number(dueDays) || 0,
        comment,
        notes,
        ...(payNow && Number(paid.amount) > 0
          ? {
              payment: {
                method: paid.method,
                amount: Number(paid.amount),
                reference: paid.reference,
              },
            }
          : {}),
      });
      notify.success(`Order ${order.number} created and invoiced.`);
      navigate(`/admin/orders/${order.id}`);
    } catch (error) {
      notify.error(error, 'We couldn’t create the order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Orders', to: '/admin/orders' },
          { label: 'Create order' },
        ]}
        title="Create order"
        subtitle="Place an order for a customer and send them the invoice."
      />
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            <SectionCard title="1. Customer">
              <Autocomplete
                options={customers}
                value={customer}
                onChange={(_, c) => setCustomer(c)}
                getOptionLabel={(c) => `${c.name} — ${c.email}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    label="Customer"
                    placeholder="Search by name or email"
                  />
                )}
              />
            </SectionCard>

            <SectionCard title="2. Items">
              <Stack spacing={2}>
                <ProductPicker
                  onAdd={(line) => setLines((ls) => [...ls, line])}
                />
                <LineItems
                  lines={lines}
                  onChange={setLines}
                  currency={getCurrency()}
                />
              </Stack>
            </SectionCard>

            <SectionCard title="3. Delivery">
              <Stack spacing={2.5}>
                {addresses.length > 0 && (
                  <TextField
                    select
                    label="Deliver to"
                    value={addressId}
                    onChange={(e) => setAddressId(e.target.value)}
                    fullWidth
                  >
                    {addresses.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {`${a.firstName} ${a.lastName}`} — {formatAddress(a)}
                      </MenuItem>
                    ))}
                    <MenuItem value="new">A new address…</MenuItem>
                  </TextField>
                )}
                {addressId === 'new' && (
                  <AddressFields value={address} onChange={setAddress} />
                )}
                <TextField
                  select
                  label="Delivery option"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  fullWidth
                >
                  {deliveryOptions.map((d) => (
                    <MenuItem key={d.code} value={d.code}>
                      {d.title} · {d.cost ? formatMoney(d.cost) : 'Free'}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Delivery note (optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  fullWidth
                />
              </Stack>
            </SectionCard>

            <SectionCard title="4. Payment">
              <Stack spacing={2}>
                <RadioGroup
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                >
                  <FormControlLabel
                    value="invoice"
                    control={<Radio />}
                    label="Invoice — they pay by M-Pesa or bank transfer"
                  />
                  <FormControlLabel
                    value="cod"
                    control={<Radio />}
                    label="Cash on delivery"
                  />
                </RadioGroup>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Payment due in"
                    type="number"
                    value={dueDays}
                    onChange={(e) => setDueDays(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">days</InputAdornment>
                      ),
                    }}
                    sx={{ maxWidth: { sm: 200 } }}
                  />
                  <TextField
                    label="Note on the invoice (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    fullWidth
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={payNow}
                      onChange={(e) => setPayNow(e.target.checked)}
                    />
                  }
                  label="They’ve already paid (some or all)"
                />
                {payNow && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      select
                      label="Paid by"
                      value={paid.method}
                      onChange={(e) =>
                        setPaid((p) => ({ ...p, method: e.target.value }))
                      }
                      sx={{ minWidth: 180 }}
                    >
                      {MANUAL_METHODS.map((m) => (
                        <MenuItem key={m.value} value={m.value}>
                          {m.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Amount"
                      type="number"
                      value={paid.amount}
                      onChange={(e) =>
                        setPaid((p) => ({ ...p, amount: e.target.value }))
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrency()}
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="Reference"
                      value={paid.reference}
                      onChange={(e) =>
                        setPaid((p) => ({ ...p, reference: e.target.value }))
                      }
                      fullWidth
                    />
                  </Stack>
                )}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <SectionCard
            title="Summary"
            sx={{ position: { lg: 'sticky' }, top: { lg: 108 } }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Customer</Typography>
                <Typography sx={{ fontWeight: 600, textAlign: 'right' }}>
                  {customer?.name || '—'}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Items</Typography>
                <Typography>
                  {lines.reduce((s, l) => s + l.quantity, 0)}
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Subtotal</Typography>
                <Typography>{formatMoney(subtotal)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">
                  {delivery?.title || 'Delivery'}
                </Typography>
                <Typography>
                  {delivery
                    ? delivery.cost
                      ? formatMoney(delivery.cost)
                      : 'Free'
                    : '—'}
                </Typography>
              </Stack>
              <Typography variant="caption">
                Tax, promo rules and free delivery are applied when the order is
                created.
              </Typography>
            </Stack>
            {!customer && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Choose a customer to start.
              </Alert>
            )}
            <Button
              variant="contained"
              size="large"
              fullWidth
              sx={{ mt: 3 }}
              disabled={!ready || busy}
              onClick={submit}
            >
              {busy ? 'Creating…' : 'Create order and invoice'}
            </Button>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CreateOrderPage;
