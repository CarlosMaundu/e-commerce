// src/components/checkout/CardPayment.js — the card tab of the payment step:
// a live card preview over Stripe's own card fields (the number, expiry and
// CVV never touch our code), plus the cardholder name.
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Grid, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

const BRAND_NAMES = {
  visa: 'VISA',
  amex: 'AMEX',
  discover: 'DISCOVER',
  diners: 'DINERS',
  jcb: 'JCB',
  unionpay: 'UnionPay',
};

const BrandMark = ({ brand }) => {
  if (brand === 'mastercard' || !brand || brand === 'unknown') {
    return (
      <Stack alignItems="center" spacing={0.25} aria-label="Card brand">
        <Box sx={{ display: 'flex' }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              bgcolor: '#EB001B',
            }}
          />
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              bgcolor: '#F79E1B',
              ml: -1.25,
              opacity: 0.9,
            }}
          />
        </Box>
        {brand === 'mastercard' && (
          <Typography sx={{ fontSize: 10, color: 'common.white' }}>
            mastercard
          </Typography>
        )}
      </Stack>
    );
  }
  return (
    <Typography
      sx={{
        fontWeight: 800,
        fontStyle: 'italic',
        fontSize: 20,
        color: 'common.white',
      }}
    >
      {BRAND_NAMES[brand] || brand.toUpperCase()}
    </Typography>
  );
};
BrandMark.propTypes = { brand: PropTypes.string };

/** The dark card at the top of the tab; mirrors what the shopper types. */
export const CardPreview = ({ name, brand, complete }) => (
  <Box
    aria-hidden
    data-testid="card-preview"
    sx={{
      position: 'relative',
      borderRadius: 1,
      p: { xs: 2.5, sm: 3 },
      aspectRatio: '1.6 / 1',
      width: '100%',
      maxWidth: 400,
      color: 'common.white',
      overflow: 'hidden',
      background:
        'linear-gradient(135deg, #1d1f24 0%, #33363d 55%, #111214 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      '&::after': {
        content: '""',
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: '50%',
        right: -90,
        top: -120,
        background: 'rgba(255,255,255,0.05)',
      },
    }}
  >
    <Box
      sx={{
        width: 44,
        height: 32,
        borderRadius: '6px',
        background: 'linear-gradient(135deg, #e9c46a, #b8892f)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
      }}
    />
    <Typography
      sx={{
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: { xs: 17, sm: 21 },
        letterSpacing: 2,
      }}
    >
      {complete ? '•••• •••• •••• ✓' : '•••• •••• •••• ••••'}
    </Typography>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, opacity: 0.6 }}>Cardholder</Typography>
        <Typography noWrap sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
          {name.trim() || 'Your name'}
        </Typography>
      </Box>
      <BrandMark brand={brand} />
    </Stack>
  </Box>
);
CardPreview.propTypes = {
  name: PropTypes.string.isRequired,
  brand: PropTypes.string,
  complete: PropTypes.bool,
};

/** Wraps a Stripe field so it looks like one of our outlined text fields. */
const StripeField = ({ label, id, Element, onChange, error }) => {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={id}
        variant="subtitle2"
        sx={{ display: 'block', mb: 0.75 }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          height: 48,
          px: 1.75,
          display: 'flex',
          alignItems: 'center',
          borderRadius: '8px',
          border: 1,
          borderColor: error
            ? 'error.main'
            : focused
              ? 'primary.main'
              : 'divider',
          boxShadow: focused
            ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`
            : 'none',
          bgcolor: 'background.paper',
          '& > div': { width: '100%' },
        }}
      >
        <Element
          id={id}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: theme.palette.text.primary,
                fontFamily: theme.typography.fontFamily,
                '::placeholder': { color: theme.palette.text.disabled },
              },
              invalid: { color: theme.palette.error.main },
            },
          }}
        />
      </Box>
      {error && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
};
StripeField.propTypes = {
  label: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  Element: PropTypes.elementType.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
};

/**
 * Card form. The parent calls ref.current.pay(clientSecret) once the server
 * has created the payment; it resolves true when Stripe confirms the charge.
 */
const CardPayment = forwardRef(({ onReadyChange, onError }, ref) => {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [fields, setFields] = useState({ number: {}, expiry: {}, cvc: {} });

  const update = (key) => (e) => {
    if (key === 'number') setBrand(e.brand);
    setFields((f) => {
      const next = {
        ...f,
        [key]: { complete: e.complete, error: e.error?.message },
      };
      onReadyChange?.(
        Boolean(stripe) &&
          next.number.complete &&
          next.expiry.complete &&
          next.cvc.complete
      );
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    needsName: () => !name.trim(),
    async pay(clientSecret) {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardNumberElement),
          billing_details: { name: name.trim() },
        },
      });
      if (error) {
        onError(error);
        return false;
      }
      return true;
    },
  }));

  return (
    <Stack spacing={2.5}>
      <CardPreview
        name={name}
        brand={brand}
        complete={fields.number.complete}
      />
      <Box>
        <Typography
          component="label"
          htmlFor="card-name"
          variant="subtitle2"
          sx={{ display: 'block', mb: 0.75 }}
        >
          Cardholder name
        </Typography>
        <TextField
          id="card-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name on card"
          autoComplete="cc-name"
          required
          fullWidth
        />
      </Box>
      <StripeField
        label="Card number"
        id="card-number"
        Element={CardNumberElement}
        onChange={update('number')}
        error={fields.number.error}
      />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <StripeField
            label="Expiry date"
            id="card-expiry"
            Element={CardExpiryElement}
            onChange={update('expiry')}
            error={fields.expiry.error}
          />
        </Grid>
        <Grid item xs={6}>
          <StripeField
            label="CVV"
            id="card-cvc"
            Element={CardCvcElement}
            onChange={update('cvc')}
            error={fields.cvc.error}
          />
        </Grid>
      </Grid>
    </Stack>
  );
});

CardPayment.displayName = 'CardPayment';
CardPayment.propTypes = {
  onReadyChange: PropTypes.func,
  onError: PropTypes.func.isRequired,
};

export default CardPayment;
