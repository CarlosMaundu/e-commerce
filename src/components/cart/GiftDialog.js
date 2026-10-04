// src/components/cart/GiftDialog.js — "Gift this item to a loved one?":
// who it's to and from, an optional free message printed on the packing
// slip, and a choice of gift boxes (set in Delivery options with prices and
// photos). Staff see all of it as instructions to carry out before dispatch.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
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
import { alpha } from '@mui/material/styles';
import { FiCheck, FiGift, FiMessageSquare, FiX } from 'react-icons/fi';
import OptionRows from '../common/OptionRows';
import { formatMoney } from '../../utils/format';

const MESSAGE_MAX = 60;

/** A gift box's photo, or a gift icon when it has none. */
export const GiftBoxImage = ({ box, size = 56 }) =>
  box?.image ? (
    <Box
      component="img"
      src={box.image}
      alt=""
      sx={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: '8px',
        bgcolor: 'background.neutral',
        flexShrink: 0,
      }}
    />
  ) : (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '8px',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.neutral',
        color: 'primary.main',
        fontSize: size / 2.5,
        flexShrink: 0,
      }}
    >
      <FiGift />
    </Box>
  );
GiftBoxImage.propTypes = { box: PropTypes.object, size: PropTypes.number };

const BoxChoice = ({ box, selected, onSelect }) => (
  <Box
    component="button"
    type="button"
    role="radio"
    aria-checked={selected}
    aria-label={`${box ? box.name : 'No gift box'}${
      box ? `, ${formatMoney(box.price)}` : ''
    }`}
    onClick={onSelect}
    sx={{
      position: 'relative',
      display: 'flex',
      gap: 1.5,
      alignItems: 'center',
      width: '100%',
      p: 1.25,
      textAlign: 'left',
      font: 'inherit',
      color: 'text.primary',
      cursor: 'pointer',
      borderRadius: 1,
      border: 1.5,
      borderStyle: 'solid',
      borderColor: selected ? 'primary.main' : 'divider',
      bgcolor: (t) =>
        selected ? alpha(t.palette.primary.main, 0.05) : 'background.paper',
    }}
  >
    {box ? (
      <GiftBoxImage box={box} />
    ) : (
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.neutral',
          color: 'text.secondary',
          flexShrink: 0,
        }}
      >
        <FiX />
      </Box>
    )}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700 }}>
        {box ? box.name : 'No gift box'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {box ? box.description : 'Message only, in our usual packaging.'}
      </Typography>
    </Box>
    <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
      {box ? formatMoney(box.price) : 'Free'}
    </Typography>
    {selected && (
      <Box
        sx={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <FiCheck />
      </Box>
    )}
  </Box>
);
BoxChoice.propTypes = {
  box: PropTypes.object,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

const GiftDialog = ({ open, item, options, onClose, onSave, saving }) => {
  const [form, setForm] = useState({ to: '', from: '', message: '' });
  const [withMessage, setWithMessage] = useState(false);
  const [boxId, setBoxId] = useState(null);
  const [touched, setTouched] = useState(false);
  const boxes = options?.boxes || [];

  useEffect(() => {
    if (!open) return;
    const g = item?.gift;
    setForm({
      to: g?.to || '',
      from: g?.from || '',
      message: g?.message || '',
    });
    setWithMessage(!!g?.message);
    setBoxId(g?.box?.id || null);
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
      boxId,
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
                width: 64,
                height: 64,
                objectFit: 'contain',
                borderRadius: '8px',
                bgcolor: 'background.paper',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
              <OptionRows options={item.options} dense />
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

        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0 }}
          control={
            <Checkbox
              checked={withMessage}
              onChange={(e) => setWithMessage(e.target.checked)}
              inputProps={{ 'aria-label': 'Gift message' }}
              sx={{ mt: -0.75, ml: -1 }}
            />
          }
          label={
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ color: 'primary.main', mt: '3px' }}>
                <FiMessageSquare />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>
                  Gift message (Free)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add a personalised message that will be printed on the packing
                  slip.
                </Typography>
              </Box>
            </Stack>
          }
        />
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
            sx={{ mt: 1.5 }}
          />
        )}

        {boxes.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Gift box</Typography>
            <Stack spacing={1.25} role="radiogroup" aria-label="Gift box">
              <BoxChoice
                box={null}
                selected={!boxId}
                onSelect={() => setBoxId(null)}
              />
              {boxes.map((b) => (
                <BoxChoice
                  key={b.id}
                  box={b}
                  selected={boxId === b.id}
                  onSelect={() => setBoxId(b.id)}
                />
              ))}
            </Stack>
          </Box>
        )}
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

GiftDialog.propTypes = {
  open: PropTypes.bool,
  item: PropTypes.object,
  options: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

export default GiftDialog;
