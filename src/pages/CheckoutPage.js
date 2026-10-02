// src/pages/CheckoutPage.js — OpenCart-style checkout in four steps. Every
// price comes from the server; card payments go through Stripe and are
// verified by the server before the order is placed.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { checkout as checkoutApi } from '../api';
import { formatAddress } from '../api/mappers';
import { clearCart, loadCart, selectCart } from '../redux/cartSlice';
import { useNotify } from '../notification/NotificationProvider';
import { SectionCard } from '../components/ui';
import AddressForm, { countryName } from '../components/account/AddressForm';
import { formatMoney, optionText } from '../utils/format';

const STEPS = ['Delivery address', 'Delivery option', 'Payment', 'Review'];

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
        borderRadius: 3,
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

const StripePayment = ({ onPaid, disabled }) => {
  const stripe = useStripe();
  const elements = useElements();
  const notify = useNotify();
  const [paying, setPaying] = useState(false);
  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    if (error) {
      notify.error(
        error,
        'Your card payment didn’t go through. Please check the details and try again.'
      );
      setPaying(false);
      return;
    }
    await onPaid();
    setPaying(false);
  };
  return (
    <Stack spacing={2}>
      <PaymentElement />
      <Button
        size="large"
        variant="contained"
        onClick={pay}
        disabled={disabled || paying || !stripe}
      >
        {paying ? 'Processing payment…' : 'Pay and place order'}
      </Button>
    </Stack>
  );
};

const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notify = useNotify();
  const cart = useSelector(selectCart);

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
  const [agree, setAgree] = useState(false);
  const [review, setReview] = useState(null);
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
      setPayments(data.methods);
      setPaymentMethod(data.selected || data.methods[0]?.code);
      await dispatch(loadCart());
      setStep(2);
    }, 'We couldn’t save your delivery option.');

  const confirmPayment = () =>
    run(async () => {
      await checkoutApi.setPaymentMethod(paymentMethod, agree);
      setReview(await checkoutApi.review());
      setStep(3);
    }, 'We couldn’t prepare your order. Please try again.');

  const place = async () => {
    setPlacing(true);
    try {
      const order = await checkoutApi.placeOrder();
      dispatch(clearCart());
      navigate(`/account/orders/${order.id}?placed=1`, { replace: true });
    } catch (error) {
      fail(error, 'We couldn’t place your order. Please try again.');
      setPlacing(false);
    }
  };

  const stripePromise = useMemo(
    () =>
      review?.payment.publishableKey
        ? loadStripe(review.payment.publishableKey)
        : null,
    [review?.payment.publishableKey]
  );

  const totals = review
    ? [
        ['Subtotal', review.order.totals.subtotal],
        review.order.totals.discount
          ? ['Promo code', -review.order.totals.discount]
          : null,
        ['Delivery', review.order.totals.shipping],
        ['Tax', review.order.totals.tax],
      ].filter(Boolean)
    : cart.totals
        .filter((t) => t.code !== 'total')
        .map((t) => [t.title, t.value]);
  const total = review ? review.order.total : cart.total;
  const selectedAddress = addresses.find((a) => a.id === addressId);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Skeleton variant="rounded" height={420} />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
        Checkout
      </Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
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
                  <Button
                    size="large"
                    variant="contained"
                    onClick={confirmAddress}
                    disabled={!addressId || working}
                    sx={{ alignSelf: 'flex-end' }}
                  >
                    Deliver here
                  </Button>
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
                <Stack direction="row" justifyContent="space-between">
                  <Button onClick={() => setStep(0)}>Back</Button>
                  <Button
                    size="large"
                    variant="contained"
                    onClick={confirmShipping}
                    disabled={!shippingMethod || working}
                  >
                    Continue
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
          )}

          {step === 2 && (
            <SectionCard title="Payment">
              <Stack spacing={1.5}>
                {payments.map((m) => (
                  <Choice
                    key={m.code}
                    testId={`payment-${m.code}`}
                    selected={m.code === paymentMethod}
                    onSelect={() => setPaymentMethod(m.code)}
                    title={m.title}
                    description={m.description}
                  />
                ))}
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
                <Stack direction="row" justifyContent="space-between">
                  <Button onClick={() => setStep(1)}>Back</Button>
                  <Button
                    size="large"
                    variant="contained"
                    onClick={confirmPayment}
                    disabled={!paymentMethod || !agree || working}
                  >
                    Review order
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
          )}

          {step === 3 && review && (
            <SectionCard title="Review your order">
              <Stack spacing={3}>
                <Stack divider={<Divider />} spacing={1.5}>
                  {review.order.items.map((item) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={2}
                      alignItems="center"
                    >
                      <Box
                        component="img"
                        src={item.image}
                        alt=""
                        sx={{
                          width: 56,
                          height: 56,
                          objectFit: 'contain',
                          borderRadius: 2,
                          bgcolor: 'background.neutral',
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {item.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {[optionText(item.options), `Qty ${item.quantity}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2">
                        {formatMoney(item.total)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" color="text.secondary">
                      Delivering to
                    </Typography>
                    <Typography variant="body2">
                      {formatAddress(review.order.shippingAddress)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" color="text.secondary">
                      Paying by
                    </Typography>
                    <Typography variant="body2">
                      {review.payment.method === 'stripe'
                        ? 'Card'
                        : 'Cash on delivery'}
                    </Typography>
                  </Grid>
                </Grid>
                {review.payment.method === 'stripe' ? (
                  stripePromise && review.payment.clientSecret ? (
                    <Elements
                      stripe={stripePromise}
                      options={{ clientSecret: review.payment.clientSecret }}
                    >
                      <StripePayment onPaid={place} disabled={placing} />
                    </Elements>
                  ) : (
                    <Alert severity="error">
                      Card payments aren’t available right now. Please go back
                      and choose another payment method.
                    </Alert>
                  )
                ) : (
                  <Stack direction="row" justifyContent="space-between">
                    <Button onClick={() => setStep(2)} disabled={placing}>
                      Back
                    </Button>
                    <Button
                      size="large"
                      variant="contained"
                      onClick={place}
                      disabled={placing}
                      startIcon={
                        placing ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : null
                      }
                    >
                      {placing
                        ? 'Placing order…'
                        : `Place order · ${formatMoney(review.order.total)}`}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </SectionCard>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <SectionCard
            title="Order summary"
            tinted
            sx={{ position: { md: 'sticky' }, top: { md: 140 } }}
          >
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {cart.items.map((item) => (
                <Stack
                  key={item.key}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                >
                  <Box
                    component="img"
                    src={item.image}
                    alt=""
                    sx={{
                      width: 44,
                      height: 44,
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                    }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {item.quantity} × {item.title}
                  </Typography>
                  <Typography variant="body2">
                    {formatMoney(item.total)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              {totals.map(([label, value]) => (
                <Stack
                  key={label}
                  direction="row"
                  justifyContent="space-between"
                >
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography>{formatMoney(value)}</Typography>
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
        </Grid>
      </Grid>
    </Container>
  );
};

export default CheckoutPage;
