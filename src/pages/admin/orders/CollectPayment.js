// src/pages/admin/orders/CollectPayment.js — taking payment at the door for a
// cash-on-delivery order: a card link and QR code the customer taps or scans
// on their phone (Apple Pay / Google Pay work there), an M-Pesa prompt sent to
// their number, or cash recorded by hand. The screen checks every few seconds
// and records the payment as soon as it's confirmed.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  FiCheckCircle,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiSmartphone,
} from 'react-icons/fi';
import { adminPayments } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import { SectionCard } from '../../../components/ui';
import { Pill } from '../../../components/admin/DataTable';
import { formatDateTime, formatMoney } from '../../../utils/format';

const POLL_MS = 4000;
const REQUEST_STATES = {
  pending: ['Waiting', 'warning'],
  paid: ['Paid', 'success'],
  failed: ['Failed', 'error'],
  cancelled: ['Cancelled', 'default'],
  expired: ['Expired', 'default'],
};

/** Follows one request until it's paid, failed, cancelled or expired. */
const useRequest = (initial) => {
  const [request, setRequest] = useState(initial);
  const timer = useRef(null);
  useEffect(() => {
    setRequest(initial);
  }, [initial]);
  useEffect(() => {
    if (!request || request.status !== 'pending') return undefined;
    timer.current = setTimeout(async () => {
      try {
        setRequest(await adminPayments.request(request.request_id));
      } catch {
        setRequest({ ...request }); // try again
      }
    }, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [request]);
  return [request, setRequest];
};

const CollectDialog = ({ method, order, amount, onClose, onPaid }) => {
  const notify = useNotify();
  const [phone, setPhone] = useState(order.shippingAddress?.phone || '');
  const [started, setStarted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useRequest(started);
  const paid = request?.status === 'paid';

  useEffect(() => {
    if (paid) onPaid(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid]);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      setStarted(
        await adminPayments.collect(order.id, {
          method,
          phone: method === 'mpesa' ? phone : undefined,
        })
      );
    } catch (error) {
      notify.error(
        error,
        method === 'mpesa'
          ? 'We couldn’t send the M-Pesa prompt.'
          : 'We couldn’t create the card payment link.'
      );
    } finally {
      setBusy(false);
    }
  }, [method, order.id, phone, notify]);

  // The card link is made as soon as the dialog opens.
  useEffect(() => {
    if (method === 'card_link') start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async () => {
    if (request?.status === 'pending') {
      await adminPayments.cancel(request.request_id).catch(() => {});
    }
    onClose();
  };

  return (
    <Dialog open onClose={cancel} fullWidth maxWidth="xs">
      <DialogTitle>
        {method === 'mpesa' ? 'M-Pesa prompt' : 'Card tap to pay'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="stretch" sx={{ pt: 0.5 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption">Order {order.number}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.8rem' }}>
              {formatMoney(
                request?.amount ?? amount,
                request?.currency || order.currency
              )}
            </Typography>
          </Box>

          {paid ? (
            <Alert
              severity="success"
              icon={<FiCheckCircle />}
              data-testid="collect-paid"
            >
              Paid{request.reference ? ` · ${request.reference}` : ''}. The
              payment has been recorded on the invoice.
            </Alert>
          ) : method === 'mpesa' && !request ? (
            <>
              <TextField
                label="Customer’s M-Pesa number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                autoFocus
                fullWidth
              />
              <Typography variant="body2" color="text.secondary">
                They’ll get a prompt on their phone to enter their M-Pesa PIN.
                M-Pesa takes whole shillings, so cents are rounded up.
              </Typography>
            </>
          ) : method === 'card_link' && request?.url ? (
            <Stack spacing={1.5} alignItems="center">
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: '#fff',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
                data-testid="collect-qr"
              >
                <QRCodeSVG value={request.url} size={196} />
              </Box>
              <Typography variant="body2" color="text.secondary" align="center">
                Ask the customer to scan this with their phone camera, then pay
                by card, Apple Pay or Google Pay.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<FiCopy />}
                  onClick={() => {
                    navigator.clipboard?.writeText(request.url);
                    notify.success('Link copied.');
                  }}
                >
                  Copy link
                </Button>
                <Button
                  size="small"
                  component={Link}
                  href={request.url}
                  target="_blank"
                  rel="noopener"
                >
                  Open on this device
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {request && !paid && (
            <Alert
              severity={
                request.status === 'pending'
                  ? 'info'
                  : request.status === 'failed'
                    ? 'error'
                    : 'warning'
              }
              icon={
                request.status === 'pending' ? (
                  <CircularProgress size={18} />
                ) : undefined
              }
              data-testid="collect-status"
            >
              {request.message}
            </Alert>
          )}
          {busy && !request && (
            <Stack alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={28} />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {paid ? (
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={cancel}>
              {request?.status === 'pending' ? 'Cancel request' : 'Close'}
            </Button>
            {method === 'mpesa' &&
              (!request ||
                ['failed', 'cancelled'].includes(request.status)) && (
                <Button
                  variant="contained"
                  onClick={() => {
                    setStarted(null);
                    setRequest(null);
                    start();
                  }}
                  disabled={busy || !phone.trim()}
                >
                  {busy ? 'Sending…' : request ? 'Send again' : 'Send prompt'}
                </Button>
              )}
            {method === 'card_link' &&
              request &&
              ['expired', 'cancelled', 'failed'].includes(request.status) && (
                <Button variant="contained" onClick={start} disabled={busy}>
                  New link
                </Button>
              )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
CollectDialog.propTypes = {
  method: PropTypes.oneOf(['card_link', 'mpesa']).isRequired,
  order: PropTypes.object.isRequired,
  amount: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  onPaid: PropTypes.func.isRequired,
};

/** "Collect payment" on a cash-on-delivery order that still owes money. */
const CollectPayment = ({ order, balance, onCash, onPaid }) => {
  const [ways, setWays] = useState(null);
  const [method, setMethod] = useState(null);
  const load = useCallback(
    () =>
      adminPayments
        .forOrder(order.id)
        .then(setWays)
        .catch(() => setWays({ requests: [], card_link: false, mpesa: false })),
    [order.id]
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionCard
      title="Collect payment"
      subtitle={`${formatMoney(balance, order.currency)} to pay on delivery`}
    >
      <Stack spacing={1.25}>
        {!ways &&
          [0, 1].map((i) => (
            <Skeleton key={i} variant="rounded" height={36.5} />
          ))}
        {ways?.card_link && (
          <Button
            variant="contained"
            startIcon={<FiCreditCard />}
            onClick={() => setMethod('card_link')}
          >
            Card tap to pay
          </Button>
        )}
        {ways?.mpesa && (
          <Button
            variant="contained"
            color="success"
            startIcon={<FiSmartphone />}
            onClick={() => setMethod('mpesa')}
          >
            Send M-Pesa prompt
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<FiDollarSign />}
          onClick={onCash}
        >
          Record cash
        </Button>
        {ways && !ways.card_link && !ways.mpesa && (
          <Typography variant="caption" color="text.secondary">
            Card taps and M-Pesa prompts can be switched on under Payment
            methods.
          </Typography>
        )}
        {ways?.requests.length > 0 && (
          <Stack spacing={0.75} sx={{ pt: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Recent requests
            </Typography>
            {ways.requests.slice(0, 3).map((r) => {
              const [label, tone] = REQUEST_STATES[r.status] || [
                r.status,
                'default',
              ];
              return (
                <Stack
                  key={r.request_id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="caption">
                    {r.method === 'mpesa' ? `M-Pesa ${r.phone}` : 'Card link'} ·{' '}
                    {formatDateTime(r.date_added)}
                  </Typography>
                  <Pill label={label} tone={tone} />
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>
      {method && (
        <CollectDialog
          method={method}
          order={order}
          amount={balance}
          onClose={() => {
            setMethod(null);
            load();
          }}
          onPaid={() => onPaid()}
        />
      )}
    </SectionCard>
  );
};
CollectPayment.propTypes = {
  order: PropTypes.object.isRequired,
  balance: PropTypes.number.isRequired,
  onCash: PropTypes.func.isRequired,
  onPaid: PropTypes.func.isRequired,
};

export default CollectPayment;
