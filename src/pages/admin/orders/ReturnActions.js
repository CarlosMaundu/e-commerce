// src/pages/admin/orders/ReturnActions.js — a return's states and what staff
// can do next, with the dialog that asks for what each step needs:
// instructions on approval, a reason on rejection, whether the item goes back
// on sale when it arrives, and a confirmation before refunding.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { adminOrders } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import { formatMoney } from '../../../utils/format';

// requested → approved (customer sends it back) → received (checked in,
// optionally back on sale) → refunded; "refund pending" while the refund
// waits for approval. Rejection is possible until it's refunded.
export const RETURN_STATES = {
  requested: ['Requested', 'warning'],
  approved: ['Awaiting item', 'info'],
  received: ['Item received', 'primary'],
  refund_pending: ['Refund pending', 'warning'],
  refunded: ['Refunded', 'success'],
  rejected: ['Rejected', 'default'],
};
export const RETURN_TABS = [
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Awaiting item' },
  { value: 'received', label: 'Received' },
  { value: 'refund_pending', label: 'Refund pending' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];
export const REFUND_PILL = {
  pending_approval: ['Refund awaiting approval', 'warning'],
  processed: ['Paid back', 'success'],
  rejected: ['Refund rejected', 'default'],
  failed: ['Refund failed', 'error'],
};
export const RETURN_ACTIONS = {
  requested: [
    { status: 'approved', label: 'Approve — ask for the item back' },
    { status: 'rejected', label: 'Reject', color: 'error' },
  ],
  approved: [
    { status: 'received', label: 'Item received' },
    { status: 'rejected', label: 'Reject', color: 'error' },
  ],
  received: [
    { status: 'refunded', label: 'Refund the customer' },
    { status: 'rejected', label: 'Reject', color: 'error' },
  ],
};

const COPY = {
  approved: {
    title: 'Approve this return',
    button: 'Approve return',
    noteLabel: 'Instructions for the customer (optional)',
    help: 'We’ll email the customer with your note and the shop’s return address.',
    done: 'Return approved. The customer has been emailed.',
  },
  rejected: {
    title: 'Reject this return',
    button: 'Reject return',
    noteLabel: 'Why can’t we accept it?',
    help: 'The customer will see this reason by email and in their account.',
    required: true,
    done: 'Return rejected. The customer has been emailed.',
  },
  received: {
    title: 'Item received',
    button: 'Mark as received',
    noteLabel: 'Condition notes (staff only, optional)',
    done: 'Item received.',
  },
  refunded: {
    title: 'Refund the customer',
    button: 'Refund',
    done: 'Refund paid. The customer has been emailed.',
    pending: 'Refund sent for approval. The return is waiting for it.',
  },
  note: {
    title: 'Add a note',
    button: 'Add note',
    noteLabel: 'Note (staff only)',
    required: true,
    done: 'Note added.',
  },
};

/** Asks for what a step needs, then moves the return on. */
export const ReturnActionDialog = ({ item, action, onClose, onDone }) => {
  const notify = useNotify();
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState('yes');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setNote('');
    setRestock('yes');
  }, [item, action]);
  const copy = COPY[action] || COPY.note;

  const submit = async () => {
    setSaving(true);
    try {
      const next = await adminOrders.updateReturn(item.id, action, {
        note: note.trim(),
        restock: action === 'received' ? restock === 'yes' : undefined,
      });
      notify.success(
        action === 'refunded' && next.status === 'refund_pending'
          ? copy.pending
          : copy.done
      );
      onDone(next);
    } catch (error) {
      notify.error(error, 'We couldn’t update the return.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={Boolean(item && action)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent>
        {item && (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Return #{item.id} · {item.quantity} × {item.product}
              {item.amount !== undefined
                ? ` · ${formatMoney(item.amount)}`
                : ''}
            </Typography>
            {action === 'received' && (
              <RadioGroup
                value={restock}
                onChange={(e) => setRestock(e.target.value)}
                aria-label="Put the item back on sale?"
              >
                <FormControlLabel
                  value="yes"
                  control={<Radio />}
                  label="Back in stock: it can be sold again"
                />
                <FormControlLabel
                  value="no"
                  control={<Radio />}
                  label="Don’t restock: damaged or not resellable"
                />
              </RadioGroup>
            )}
            {action === 'refunded' && (
              <Alert severity="info" icon={false}>
                The customer is refunded the item’s price, less any restocking
                fee in Refund settings. Refunds above the approval limit wait
                for approval first.
              </Alert>
            )}
            {copy.noteLabel && (
              <TextField
                label={copy.noteLabel}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                helperText={copy.help}
                multiline
                minRows={3}
                inputProps={{ maxLength: 1000 }}
                required={copy.required}
                fullWidth
                autoFocus
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={action === 'rejected' ? 'error' : 'primary'}
          onClick={submit}
          disabled={saving || (copy.required && !note.trim())}
        >
          {saving ? 'Saving…' : copy.button}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
ReturnActionDialog.propTypes = {
  item: PropTypes.object,
  action: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
};
