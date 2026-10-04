// src/pages/admin/DeliverySettingsPage.js — Delivery options: standard
// (with a free-delivery threshold), express and pick up. Each can be
// switched on or off, renamed and priced; pick up has a location and hours.
// Opens read-only; Edit, then Cancel or Save at the bottom.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiEdit2, FiMapPin, FiSave, FiTruck, FiZap } from 'react-icons/fi';
import { delivery as deliveryApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { PageHeader, Pill } from '../../components/admin/DataTable';
import { useHideHelpWhile } from '../../layouts/AdminLayout';
import { formatDateTime, formatMoney, getCurrency } from '../../utils/format';

const OPTIONS = [
  {
    code: 'standard',
    icon: <FiTruck />,
    tone: 'primary',
    hint: 'Your everyday delivery.',
  },
  {
    code: 'express',
    icon: <FiZap />,
    tone: 'warning',
    hint: 'Faster delivery at a higher price.',
  },
  {
    code: 'pickup',
    icon: <FiMapPin />,
    tone: 'success',
    hint: 'Shoppers collect their order themselves.',
  },
];

const OptionCard = ({ option, value, onChange, errors, editing }) => {
  const theme = useTheme();
  const color = theme.palette[option.tone].main;
  const err = (key) => {
    const msg = errors[`${option.code}.${key}`];
    return msg ? { error: true, helperText: msg } : {};
  };
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const money = (key, label, helper) => (
    <TextField
      label={label}
      type="number"
      value={value[key]}
      onChange={set(key)}
      inputProps={{ min: 0, step: 'any' }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">{getCurrency()}</InputAdornment>
        ),
      }}
      helperText={helper}
      {...err(key)}
      fullWidth
    />
  );

  return (
    <Box
      component="section"
      aria-label={value.title}
      data-testid={`delivery-${option.code}`}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: { xs: 2.5, md: 3 },
        opacity: value.enabled ? 1 : 0.85,
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="flex-start"
        sx={{ mb: value.enabled ? 2.5 : 0 }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '8px',
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
            color,
            bgcolor: alpha(color, 0.12),
            flexShrink: 0,
          }}
        >
          {option.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Typography variant="h6" component="h2">
              {value.title}
            </Typography>
            <Pill
              label={value.enabled ? 'On' : 'Off'}
              tone={value.enabled ? 'success' : 'default'}
            />
            {value.enabled && (
              <Typography variant="body2" color="text.secondary">
                {Number(value.price) ? formatMoney(value.price) : 'Free'}
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {option.hint}
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={value.enabled}
              onChange={(e) =>
                onChange({ ...value, enabled: e.target.checked })
              }
              disabled={!editing}
            />
          }
          label={value.enabled ? 'Offered' : 'Not offered'}
          labelPlacement="start"
          sx={{ m: 0, gap: 1 }}
        />
      </Stack>
      {value.enabled && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Name shoppers see"
              value={value.title}
              onChange={set('title')}
              {...err('title')}
              fullWidth
            />
            {money(
              'price',
              'Price',
              option.code === 'pickup' ? 'Usually free.' : undefined
            )}
          </Stack>
          <TextField
            label="Description"
            value={value.description}
            onChange={set('description')}
            inputProps={{ maxLength: 160 }}
            helperText={
              errors[`${option.code}.description`] ||
              'For example how long it takes.'
            }
            fullWidth
          />
          {option.code === 'standard' &&
            money(
              'free_over',
              'Free delivery from',
              'Orders of at least this much ship free. Use 0 to always charge.'
            )}
          {option.code === 'pickup' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Pick-up location"
                value={value.location}
                onChange={set('location')}
                multiline
                minRows={2}
                placeholder="Shop name, street, town"
                {...err('location')}
                fullWidth
              />
              <TextField
                label="Opening hours"
                value={value.hours}
                onChange={set('hours')}
                placeholder="Mon–Sat, 9am–6pm"
                {...err('hours')}
                fullWidth
              />
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
};
OptionCard.propTypes = {
  option: PropTypes.object.isRequired,
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  errors: PropTypes.object.isRequired,
  editing: PropTypes.bool,
};

const DeliverySettingsPage = () => {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [meta, setMeta] = useState({});
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useHideHelpWhile(editing);

  useEffect(() => {
    deliveryApi
      .adminGet()
      .then(({ settings, updatedAt, updatedBy }) => {
        setForm(settings);
        setSaved(settings);
        setMeta({ updatedAt, updatedBy });
      })
      .catch((error) =>
        notify.error(error, 'We couldn’t load the delivery options.')
      );
  }, [notify]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const next = await deliveryApi.save(form);
      setForm(next);
      setSaved(next);
      setEditing(false);
      setMeta({ updatedAt: new Date().toISOString(), updatedBy: 'you' });
      notify.success('Delivery options saved.');
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t save the delivery options.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={save} noValidate>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Delivery options' },
        ]}
        title="Delivery options"
        subtitle={
          meta.updatedAt
            ? `Last changed ${formatDateTime(meta.updatedAt)}${meta.updatedBy ? ` by ${meta.updatedBy}` : ''}`
            : 'How shoppers get their orders, and what each option costs.'
        }
        actions={
          !editing && (
            <Button
              variant="contained"
              startIcon={<FiEdit2 />}
              onClick={() => setEditing(true)}
              disabled={!form}
            >
              Edit options
            </Button>
          )
        }
      />
      {!form ? (
        <Stack spacing={3} sx={{ mt: 3 }} data-testid="delivery-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={160} />
          ))}
        </Stack>
      ) : (
        <Box
          component="fieldset"
          disabled={!editing}
          sx={{
            border: 0,
            m: 0,
            p: 0,
            mt: 3,
            minWidth: 0,
            maxWidth: 960,
            ...(!editing && {
              '& .MuiOutlinedInput-root': { bgcolor: 'background.neutral' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'transparent',
              },
              '& .MuiInputBase-input.Mui-disabled': {
                color: 'text.primary',
                WebkitTextFillColor: 'currentColor',
              },
            }),
          }}
        >
          <Stack spacing={3}>
            {OPTIONS.map((option) => (
              <OptionCard
                key={option.code}
                option={option}
                value={form[option.code]}
                editing={editing}
                errors={errors}
                onChange={(v) => setForm((f) => ({ ...f, [option.code]: v }))}
              />
            ))}
          </Stack>
        </Box>
      )}
      {form && editing && (
        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1.5}
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: 3,
            py: 2,
            maxWidth: 960,
            bgcolor: 'background.neutral',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 2,
          }}
        >
          <Button
            variant="outlined"
            size="large"
            disabled={saving}
            sx={{ bgcolor: 'background.paper' }}
            onClick={() => {
              setForm(saved);
              setErrors({});
              setEditing(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<FiSave />}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default DeliverySettingsPage;
