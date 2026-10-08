// src/components/checkout/OrderSuccessDialog.js — shown once, straight after
// checkout, before the order summary: "Payment successful — KES X paid for
// order Y" (card) or "Order placed — pay KES X on delivery" (cash).
import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import { alpha } from '@mui/material/styles';
import { FiCheck } from 'react-icons/fi';
import { formatDateTime, formatMoney } from '../../utils/format';

const pop = keyframes`
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); }
`;
const ring = keyframes`
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
`;

const METHOD = {
  stripe: 'Card',
  cod: 'Cash on delivery',
  mpesa: 'M-Pesa',
  bank: 'Bank transfer',
};

const OrderSuccessDialog = ({ open, order, onClose }) => {
  if (!order) return null;
  const paid = order.paymentStatus === 'paid';
  const amount = formatMoney(order.total, order.currency);
  const rows = [
    ['Order', order.number],
    ['Amount', amount],
    [
      'Payment',
      `${METHOD[order.paymentMethod] || order.paymentMethod}${paid ? ' · paid' : ''}`,
    ],
    ['Date', formatDateTime(order.placedAt)],
  ];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="order-success-title"
      data-testid="order-success"
    >
      <DialogContent sx={{ textAlign: 'center', pt: 4, pb: 3 }}>
        <Box sx={{ position: 'relative', width: 76, height: 76, mx: 'auto' }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              bgcolor: (t) => alpha(t.palette.success.main, 0.25),
              animation: `${ring} 1.4s ease-out 0.3s 2`,
            }}
          />
          <Box
            sx={{
              position: 'relative',
              width: 76,
              height: 76,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: 36,
              color: 'common.white',
              bgcolor: 'success.main',
              animation: `${pop} .5s ease-out`,
            }}
          >
            <FiCheck />
          </Box>
        </Box>
        <Typography
          id="order-success-title"
          variant="h5"
          component="h2"
          sx={{ mt: 2.5, fontWeight: 700 }}
        >
          {paid ? 'Payment successful' : 'Order placed'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {paid ? (
            <>
              <strong>{amount}</strong> paid for order{' '}
              <strong>{order.number}</strong>.
            </>
          ) : (
            <>
              Order <strong>{order.number}</strong> is confirmed. Pay{' '}
              <strong>{amount}</strong>{' '}
              {order.paymentMethod === 'cod'
                ? 'on delivery'
                : 'by the due date'}
              .
            </>
          )}
        </Typography>
        <Box
          component="dl"
          sx={{
            mt: 2.5,
            mb: 0,
            p: 2,
            borderRadius: 1,
            bgcolor: 'background.neutral',
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            rowGap: 0.75,
            columnGap: 2,
            textAlign: 'left',
            '& dt': { color: 'text.secondary', fontSize: '0.875rem' },
            '& dd': {
              m: 0,
              fontSize: '0.875rem',
              fontWeight: 600,
              textAlign: 'right',
            },
          }}
        >
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 1.5 }}
        >
          We’ve emailed a receipt to {order.email}.
        </Typography>
        <Stack spacing={1} sx={{ mt: 2.5 }}>
          <Button variant="contained" size="large" onClick={onClose} autoFocus>
            View order details
          </Button>
          <Button component={RouterLink} to="/products" color="inherit">
            Continue shopping
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

OrderSuccessDialog.propTypes = {
  open: PropTypes.bool,
  order: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default OrderSuccessDialog;
