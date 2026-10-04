// src/pages/CheckoutPage.js — OpenCart-style checkout in three steps. Every
// price comes from the server; card payments go through Stripe and are
// verified by the server before the order is placed.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Link,
  Radio,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements } from '@stripe/react-stripe-js';
import { checkout as checkoutApi } from '../api';
import { formatAddress } from '../api/mappers';
import { clearCart, loadCart, selectCart } from '../redux/cartSlice';
import { useNotify } from '../notification/NotificationProvider';
import { SectionCard } from '../components/ui';
import AddressForm, { countryName } from '../components/account/AddressForm';
import CardPayment from '../components/checkout/CardPayment';
import { formatMoney, optionText } from '../utils/format';

const STEPS = ['Delivery address', 'Delivery option', 'Payment'];

/** Back / forward pair: equal widths, as in the reference. */
const ActionRow = ({ children }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 2,
      pt: 1,
    }}
  >
    {children}
  </Box>
);
ActionRow.propTypes = { children: PropTypes.node };

const Choice = ({ selected, onSelect, title, description, aside, testId }) => {
  const theme = useTheme();
  return (
    <Box
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      data-testid={testId}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 2,
        borderRadius: 1,
        cursor: 'pointer',
        border: 1.5,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected
          ? alpha(theme.palette.primary.main, 0.05)
          : 'background.paper',
      }}
    >
      <Radio
        checked={selected}
        tabIndex={-1}
        sx={{ p: 0, mt: 0.25 }}
        inputProps={{ 'aria-hidden': true }}
      />
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      {aside}
    </Box>
  );
};

const TOTAL_LABELS = {
  sub_total: 'Subtotal',
  shipping: 'Estimated shipping & handling',
};

const SummaryHeading = ({ children }) => (
  <Typography variant="subtitle2" sx={{ mb: 1 }}>
    {children}
  </Typography>
);
SummaryHeading.propTypes = { children: PropTypes.node };

/** Left-hand card (reference layout): items, address, delivery, totals. */
const OrderSummary = ({ items, address, shipment, totals, total }) => (
  <SectionCard title="Summary">
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Stack
          key={item.key}
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ bgcolor: 'background.neutral', borderRadius: '8px', p: 1.25 }}
        >
          <Box
            component="img"
            src={item.image}
            alt=""
            sx={{
              width: 48,
              height: 48,
              objectFit: 'contain',
              borderRadius: '8px',
              bgcolor: 'background.paper',
              flexShrink: 0,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {item.title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block' }}
            >
              {[optionText(item.options), `Qty ${item.quantity}`]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatMoney(item.total)}
          </Typography>
        </Stack>
      ))}
    </Stack>
    {address && (
      <Box sx={{ mt: 2.5 }}>
        <SummaryHeading>Address</SummaryHeading>
        <Typography variant="body2" color="text.secondary">
          {`${address.firstName} ${address.lastName}`.trim()}
          <br />
          {formatAddress({ ...address, country: countryName(address.country) })}
        </Typography>
      </Box>
    )}
    {shipment && (
      <Box sx={{ mt: 2.5 }}>
        <SummaryHeading>Shipment method</SummaryHeading>
        <Typography variant="body2" color="text.secondary">
          {shipment.title}
          {shipment.description ? ` · ${shipment.description}` : ''}
        </Typography>
      </Box>
    )}
    <Divider sx={{ my: 2.5 }} />
    <Stack spacing={1}>
      {totals.map(([label, value]) => (
        <Stack key={label} direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2">{formatMoney(value)}</Typography>
        </Stack>
      ))}
      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="subtitle1">Total</Typography>
        <Typography variant="subtitle1" data-testid="checkout-total">
          {formatMoney(total)}
        </Typography>
      </Stack>
    </Stack>
  </SectionCard>
);
OrderSummary.propTypes = {
  items: PropTypes.array.isRequired,
  address: PropTypes.object,
  shipment: PropTypes.object,
  totals: PropTypes.array.isRequired,
  total: PropTypes.number,
};

export const CheckoutSkeleton = () => (
  <Container
    maxWidth="xl"
    sx={{ py: { xs: 3, md: 5 } }}
    data-testid="checkout-loading"
  >
    <Skeleton variant="text" width={200} height={48} />
    <Skeleton variant="rounded" height={40} sx={{ my: 3 }} />
    <Grid container spacing={4}>
      <Grid item xs={12} md={5}>
        <Stack spacing={1.25}>
          <Skeleton variant="rounded" height={32} width="40%" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={68} />
          ))}
          <Skeleton variant="rounded" height={160} />
        </Stack>
      </Grid>
      <Grid item xs={12} md={7}>
        <Skeleton variant="rounded" height={420} />
      </Grid>
    </Grid>
  </Container>
);

const PAYMENT_TAB_LABELS = { stripe: 'Credit card', cod: 'Cash on delivery' };

const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notify = useNotify();
  const cart = useSelector(selectCart);
  const cardRef = useRef(null);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [methods, setMethods] = useState([]);
  const [shippingMethod, setShippingMethod] = useState(null);
  const [comment, setComment] = useState('');
  const [payments, setPayments] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [sameBilling, setSameBilling] = useState(true);
  const [billingId, setBillingId] = useState(null);
  const [agree, setAgree] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [working, setWorking] = useState(false);

  const fail = (error, fallback) => notify.error(error, fallback);

  const loadAddresses = useCallback(async () => {
    const data = await checkoutApi.getShippingAddress();
    setAddresses(data.addresses);
    setAddressId(
      (current) => current ?? data.selectedId ?? data.addresses[0]?.id ?? null
    );
    setAddingAddress(!data.addresses.length);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await dispatch(loadCart()).unwrap();
        if (!loaded.items.length) {
          navigate('/cart', { replace: true });
          return;
        }
        await loadAddresses();
      } catch (error) {
        fail(error, 'We couldn’t start checkout. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn, fallback) => {
    setWorking(true);
    try {
      return await fn();
    } catch (error) {
      fail(error, fallback);
      return undefined;
    } finally {
      setWorking(false);
    }
  };

  const confirmAddress = () =>
    run(async () => {
      await checkoutApi.useShippingAddress(addressId);
      await checkoutApi.usePaymentAddress(addressId);
      const data = await checkoutApi.getShippingMethods();
      setMethods(data.methods);
      setShippingMethod(data.selected || data.methods[0]?.code);
      setBillingId(addressId);
      setStep(1);
    }, 'We couldn’t use that address. Please try again.');

  const saveNewAddress = async (values) => {
    await run(async () => {
      const created = await checkoutApi.addShippingAddress(values);
      await loadAddresses();
      setAddressId(created.id);
      setAddingAddress(false);
    }, 'We couldn’t save that address. Please check it and try again.');
  };

  const confirmShipping = () =>
    run(async () => {
      await checkoutApi.setShippingMethod(shippingMethod, comment);
      const data = await checkoutApi.getPaymentMethods();
      // Card first, as in the reference layout.
      const sorted = [...data.methods].sort(
        (a, b) => (b.code === 'stripe') - (a.code === 'stripe')
      );
      setPayments(sorted);
      setPaymentMethod(data.selected || sorted[0]?.code);
      await dispatch(loadCart());
      setStep(2);
    }, 'We couldn’t save your delivery option.');

  const stripeMethod = payments.find((m) => m.code === 'stripe');
  const publishableKey = stripeMethod?.publishable_key;
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );
  const paying = paymentMethod === 'stripe';

  const pay = async () => {
    if (paying && cardRef.current?.needsName()) {
      notify.error(null, 'Please enter the name on your card.');
      return;
    }
    setPlacing(true);
    try {
      await checkoutApi.usePaymentAddress(sameBilling ? addressId : billingId);
      await checkoutApi.setPaymentMethod(paymentMethod, agree);
      const review = await checkoutApi.review();
      if (review.payment.method === 'stripe') {
        if (!review.payment.clientSecret || !cardRef.current) {
          notify.error(
            null,
            'Card payments aren’t available right now. Please choose another payment method.'
          );
          setPlacing(false);
          return;
        }
        const paid = await cardRef.current.pay(review.payment.clientSecret);
        if (!paid) {
          setPlacing(false);
          return;
        }
      }
      const order = await checkoutApi.placeOrder();
      dispatch(clearCart());
      navigate(`/account/orders/${order.id}?placed=1`, { replace: true });
    } catch (error) {
      fail(error, 'We couldn’t place your order. Please try again.');
      setPlacing(false);
    }
  };

  const totals = cart.totals
    .filter((t) => t.code !== 'total')
    .map((t) => [
      t.code === 'shipping'
        ? TOTAL_LABELS.shipping
        : TOTAL_LABELS[t.code] || t.title,
      t.value,
    ]);
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const shipment =
    step > 0 ? methods.find((m) => m.code === shippingMethod) : null;

  if (loading) return <CheckoutSkeleton />;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
        Checkout
      </Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mb: { xs: 3, md: 4 } }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Grid container spacing={{ xs: 3, md: 4 }}>
        <Grid item xs={12} md={5} sx={{ order: { xs: 2, md: 1 } }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 140 } }}>
            <OrderSummary
              items={cart.items}
              address={step > 0 ? selectedAddress : null}
              shipment={shipment}
              totals={totals}
              total={cart.total}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={7} sx={{ order: { xs: 1, md: 2 } }}>
          {step === 0 && (
            <SectionCard title="Where should we deliver?">
              {addingAddress ? (
                <AddressForm
                  submitLabel="Use this address"
                  showDefault={false}
                  onSubmit={saveNewAddress}
                  onCancel={
                    addresses.length ? () => setAddingAddress(false) : undefined
                  }
                />
              ) : (
                <Stack spacing={1.5}>
                  {addresses.map((a) => (
                    <Choice
                      key={a.id}
                      testId={`address-choice-${a.id}`}
                      selected={a.id === addressId}
                      onSelect={() => setAddressId(a.id)}
                      title={`${a.firstName} ${a.lastName}`}
                      description={`${formatAddress({ ...a, country: countryName(a.country) })}${a.phone ? ` · ${a.phone}` : ''}`}
                    />
                  ))}
                  <Button
                    onClick={() => setAddingAddress(true)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    + Add a new address
                  </Button>
                  <ActionRow>
                    <Button
                      variant="outlined"
                      size="large"
                      component={RouterLink}
                      to="/cart"
                    >
                      Back to cart
                    </Button>
                    <Button
                      size="large"
                      variant="contained"
                      onClick={confirmAddress}
                      disabled={!addressId || working}
                    >
                      Deliver here
                    </Button>
                  </ActionRow>
                </Stack>
              )}
            </SectionCard>
          )}

          {step === 1 && (
            <SectionCard
              title="Delivery option"
              subtitle={
                selectedAddress && `To ${formatAddress(selectedAddress)}`
              }
            >
              <Stack spacing={1.5}>
                {methods.map((m) => (
                  <Choice
                    key={m.code}
                    testId={`shipping-${m.code}`}
                    selected={m.code === shippingMethod}
                    onSelect={() => setShippingMethod(m.code)}
                    title={m.title}
                    description={m.description}
                    aside={
                      <Typography variant="subtitle1">
                        {m.cost ? formatMoney(m.cost) : 'Free'}
                      </Typography>
                    }
                  />
                ))}
                <TextField
                  label="Delivery note (optional)"
                  multiline
                  minRows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <ActionRow>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => setStep(0)}
                  >
                    Back
                  </Button>
                  <Button
                    size="large"
                    variant="contained"
                    onClick={confirmShipping}
                    disabled={!shippingMethod || working}
                  >
                    Continue
                  </Button>
                </ActionRow>
              </Stack>
            </SectionCard>
          )}

          {step === 2 && (
            <SectionCard title="Payment">
              <Stack spacing={2.5}>
                <Tabs
                  value={paymentMethod || false}
                  onChange={(_, v) => setPaymentMethod(v)}
                  variant="fullWidth"
                  aria-label="Payment method"
                  sx={{
                    minHeight: 44,
                    bgcolor: 'background.neutral',
                    borderRadius: '8px',
                    p: 0.5,
                    '& .MuiTabs-indicator': { display: 'none' },
                    '& .MuiTab-root': {
                      minHeight: 36,
                      borderRadius: '6px',
                      textTransform: 'none',
                      fontWeight: 600,
                    },
                    '& .Mui-selected': {
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                    },
                  }}
                >
                  {payments.map((m) => (
                    <Tab
                      key={m.code}
                      value={m.code}
                      label={PAYMENT_TAB_LABELS[m.code] || m.title}
                      data-testid={`payment-${m.code}`}
                    />
                  ))}
                </Tabs>

                {paying &&
                  (stripePromise ? (
                    <Elements stripe={stripePromise}>
                      <CardPayment
                        ref={cardRef}
                        onReadyChange={setCardReady}
                        onError={(error) =>
                          notify.error(
                            error,
                            'Your card payment didn’t go through. Please check the details and try again.'
                          )
                        }
                      />
                    </Elements>
                  ) : (
                    <Alert severity="error">
                      Card payments aren’t available right now. Please choose
                      another payment method.
                    </Alert>
                  ))}
                {paymentMethod === 'cod' && (
                  <Box
                    sx={{
                      bgcolor: 'background.neutral',
                      borderRadius: 1,
                      p: 2.5,
                    }}
                  >
                    <Typography variant="subtitle1">
                      Pay when your order arrives
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Have {formatMoney(cart.total)} ready in cash or M-Pesa for
                      the courier. We’ll email you when it’s on the way.
                    </Typography>
                  </Box>
                )}

                <Stack alignItems="flex-start">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={sameBilling}
                        onChange={(e) => {
                          setSameBilling(e.target.checked);
                          if (!e.target.checked && !billingId)
                            setBillingId(addressId);
                        }}
                      />
                    }
                    label="Same as billing address"
                  />
                  {!sameBilling && (
                    <Stack spacing={1} sx={{ my: 1, alignSelf: 'stretch' }}>
                      <Typography variant="subtitle2">
                        Billing address
                      </Typography>
                      {addresses.map((a) => (
                        <Choice
                          key={a.id}
                          testId={`billing-choice-${a.id}`}
                          selected={a.id === billingId}
                          onSelect={() => setBillingId(a.id)}
                          title={`${a.firstName} ${a.lastName}`}
                          description={formatAddress({
                            ...a,
                            country: countryName(a.country),
                          })}
                        />
                      ))}
                      <Typography variant="caption" color="text.secondary">
                        Add more addresses in{' '}
                        <Link component={RouterLink} to="/account/addresses">
                          your account
                        </Link>
                        .
                      </Typography>
                    </Stack>
                  )}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={agree}
                        onChange={(e) => setAgree(e.target.checked)}
                      />
                    }
                    label={
                      <>
                        I accept the{' '}
                        <Link
                          component={RouterLink}
                          to="/information/terms"
                          target="_blank"
                        >
                          terms and conditions
                        </Link>
                      </>
                    }
                  />
                </Stack>

                <ActionRow>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => setStep(1)}
                    disabled={placing}
                  >
                    Back
                  </Button>
                  <Button
                    size="large"
                    variant="contained"
                    onClick={pay}
                    disabled={
                      !paymentMethod ||
                      !agree ||
                      placing ||
                      (paying && (!stripePromise || !cardReady))
                    }
                    startIcon={
                      placing ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : null
                    }
                  >
                    {placing
                      ? paying
                        ? 'Processing payment…'
                        : 'Placing order…'
                      : paying
                        ? `Pay ${formatMoney(cart.total)}`
                        : `Place order · ${formatMoney(cart.total)}`}
                  </Button>
                </ActionRow>
              </Stack>
            </SectionCard>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default CheckoutPage;
