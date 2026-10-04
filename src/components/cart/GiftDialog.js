// src/components/cart/GiftDialog.js — "Gift this item to a loved one?":
// who it's to and from, an optional free message printed on the packing
// slip, and an optional paid gift box. Staff see all of it as instructions
// to carry out before the order is dispatched.
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiGift, FiMessageSquare, FiX } from 'react-icons/fi';
import OptionRows from '../common/OptionRows';
import { formatMoney } from '../../utils/format';

const MESSAGE_MAX = 60;

const Choice = ({ checked, onChange, icon, title, children, label }) => (
  <Box
    sx={{
      border: 1,
      borderColor: checked ? 'primary.main' : 'divider',
      borderRadius: 1,
      p: 1.5,
    }}
  >
    <FormControlLabel
      sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
      control={
        <Checkbox
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          inputProps={{ 'aria-label': label }}
          sx={{ mt: -0.75, ml: -0.75 }}
        />
      }
      label={
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'background.neutral',
              color: 'primary.main',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {children}
            </Typography>
          </Box>
        </Stack>
      }
    />
  </Box>
);

const GiftDialog = ({ open, item, options, onClose, onSave, saving }) => {
  const [form, setForm] = useState({ to: '', from: '', message: '' });
  const [withMessage, setWithMessage] = useState(false);
  const [giftBox, setGiftBox] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const g = item?.gift;
    setForm({
      to: g?.to || '',
      from: g?.from || '',
      message: g?.message || '',
    });
    setWithMessage(!!g?.message);
    setGiftBox(!!g?.giftBox);
    setTouched(false);
  }, [open, item]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const missing = (key) => touched && !form[key].trim();
  const save = () => {
    setTouched(true);
    if (!form.to.trim() || !form.from.trim()) return;
    onSave({
      to: form.to.trim(),
      from: form.from.trim(),
      message: withMessage ? form.message.trim() : '',
      giftBox,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Gift this item to a loved one?
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <FiX />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {item && (
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 1.5 }}
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
                bgcolor: 'background.paper',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
              <OptionRows options={item.options} />
              <Typography variant="body2" color="text.secondary">
                Quantity: {item.quantity}
              </Typography>
            </Box>
          </Stack>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mt: 2.5 }}
        >
          <TextField
            label="To"
            value={form.to}
            onChange={set('to')}
            error={missing('to')}
            helperText={missing('to') ? 'Who is the gift for?' : ' '}
            inputProps={{ maxLength: 60 }}
            fullWidth
            autoFocus
          />
          <TextField
            label="From"
            value={form.from}
            onChange={set('from')}
            error={missing('from')}
            helperText={missing('from') ? 'Who is it from?' : ' '}
            inputProps={{ maxLength: 60 }}
            fullWidth
          />
        </Stack>

        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Choice
            checked={withMessage}
            onChange={setWithMessage}
            icon={<FiMessageSquare />}
            title="Gift message (Free)"
            label="Gift message"
          >
            Add a personalised message that will be printed on the packing slip.
          </Choice>
          {withMessage && (
            <TextField
              label="Message (optional)"
              value={form.message}
              onChange={set('message')}
              multiline
              minRows={2}
              inputProps={{ maxLength: MESSAGE_MAX }}
              helperText={`Maximum ${MESSAGE_MAX} characters · ${
                MESSAGE_MAX - form.message.length
              } left`}
              fullWidth
            />
          )}
          <Choice
            checked={giftBox}
            onChange={setGiftBox}
            icon={<FiGift />}
            title={`Gift box (${formatMoney(options?.boxPrice || 0)})`}
            label="Gift box"
          >
            {options?.boxDescription ||
              'We’ll wrap your gift in a silver box with ribbons.'}
          </Choice>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GiftDialog;
