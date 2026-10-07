// src/pages/admin/FinanceSettingsPage.js — Financial settings: the shop's
// currency, tax (name, rate, and whether prices already include it) and
// delivery prices. Opens read-only; Edit, then Cancel or Save at the bottom.
// A worked example shows what a shopper would pay with the current values.
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiEdit2, FiSave } from 'react-icons/fi';
import { finance as financeApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { useStore } from '../../context/StoreContext';
import { SectionCard } from '../../components/ui';
import { PageHeader } from '../../components/admin/DataTable';
import { useHideHelpWhile } from '../../layouts/AdminLayout';
import { formatDateTime } from '../../utils/format';

export const CURRENCIES = [
  ['KES', 'Kenyan shilling'],
  ['UGX', 'Ugandan shilling'],
  ['TZS', 'Tanzanian shilling'],
  ['RWF', 'Rwandan franc'],
  ['NGN', 'Nigerian naira'],
  ['GHS', 'Ghanaian cedi'],
  ['ZAR', 'South African rand'],
  ['USD', 'US dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'British pound'],
  ['AED', 'UAE dirham'],
  ['INR', 'Indian rupee'],
];

const money = (n, code) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(
    Number(n || 0)
  );

/** What a shopper pays for `goods` (before delivery). */
const example = (f, goods) => {
  const rate = Number(f.taxRate) || 0;
  const free =
    Number(f.freeShippingOver) > 0 && goods >= Number(f.freeShippingOver);
  const shipping = free ? 0 : Number(f.standardShipping) || 0;
  const tax = f.pricesIncludeTax
    ? goods - goods / (1 + rate / 100)
    : (goods * rate) / 100;
  return {
    goods,
    shipping,
    tax,
    total: goods + shipping + (f.pricesIncludeTax ? 0 : tax),
  };
};

const Worked = ({ form }) => {
  const goods =
    form.currency === 'USD' ||
    form.currency === 'EUR' ||
    form.currency === 'GBP'
      ? 100
      : 5000;
  const e = useMemo(() => example(form, goods), [form, goods]);
  const rows = [
    ['Items', money(e.goods, form.currency)],
    ...(form.pricesIncludeTax
      ? []
      : [
          [
            `${form.taxLabel || 'Tax'} (${form.taxRate || 0}%)`,
            money(e.tax, form.currency),
          ],
        ]),
  ];
  return (
    <SectionCard
      tinted
      title="What a shopper pays"
      subtitle={`Items worth ${money(goods, form.currency)}, before delivery.`}
    >
      <Stack spacing={1}>
        {rows.map(([l, v]) => (
          <Stack key={l} direction="row" justifyContent="space-between">
            <Typography color="text.secondary">{l}</Typography>
            <Typography>{v}</Typography>
          </Stack>
        ))}
        <Divider />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="subtitle1">Total</Typography>
          <Typography variant="subtitle1" data-testid="finance-example-total">
            {money(e.total, form.currency)}
          </Typography>
        </Stack>
        {form.pricesIncludeTax && (
          <Typography variant="caption">
            Includes {form.taxLabel || 'tax'} of {money(e.tax, form.currency)}
          </Typography>
        )}
      </Stack>
    </SectionCard>
  );
};
Worked.propTypes = { form: PropTypes.object.isRequired };

const FinanceSettingsPage = () => {
  const notify = useNotify();
  const shop = useStore();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [meta, setMeta] = useState({});
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  useHideHelpWhile(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    financeApi
      .adminGet()
      .then(({ settings, updatedAt, updatedBy }) => {
        setForm(settings);
        setSaved(settings);
        setMeta({ updatedAt, updatedBy });
      })
      .catch((error) =>
        notify.error(error, 'We couldn’t load the financial settings.')
      );
  }, [notify]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const err = (key) => ({
    error: Boolean(errors[key]),
    helperText: errors[key],
  });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const next = await financeApi.save(form);
      const currencyChanged = next.currency !== saved.currency;
      setForm(next);
      setSaved(next);
      setEditing(false);
      setMeta({ updatedAt: new Date().toISOString(), updatedBy: 'you' });
      notify.success('Financial settings saved.');
      // Prices everywhere switch to the new currency.
      if (currencyChanged) await shop.reload();
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t save the financial settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={save} noValidate>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Financial settings' },
        ]}
        title="Financial settings"
        subtitle={
          meta.updatedAt
            ? `Last changed ${formatDateTime(meta.updatedAt)}${
                meta.updatedBy ? ` by ${meta.updatedBy}` : ''
              }`
            : 'Currency and tax used across the shop and at checkout.'
        }
        actions={
          !editing && (
            <Button
              variant="contained"
              startIcon={<FiEdit2 />}
              onClick={() => setEditing(true)}
              disabled={!form}
            >
              Edit settings
            </Button>
          )
        }
      />
      {!form ? (
        <Grid
          container
          spacing={3}
          sx={{ mt: 0 }}
          data-testid="finance-loading"
        >
          {[0, 1].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rounded" height={300} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box
          component="fieldset"
          disabled={!editing}
          sx={{
            border: 0,
            m: 0,
            p: 0,
            minWidth: 0,
            ...(!editing && {
              '& .MuiOutlinedInput-root': { bgcolor: 'background.neutral' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'transparent',
              },
              '& .MuiInputBase-input.Mui-disabled, & .MuiSelect-select.Mui-disabled':
                { color: 'text.primary', WebkitTextFillColor: 'currentColor' },
            }),
          }}
        >
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12} lg={8}>
              <Stack spacing={3}>
                <SectionCard
                  title="Currency"
                  subtitle="Every price in the shop and back office is shown in this currency."
                >
                  <Stack spacing={2}>
                    <TextField
                      select
                      label="Shop currency"
                      value={form.currency}
                      onChange={set('currency')}
                      {...err('currency')}
                      fullWidth
                    >
                      {CURRENCIES.map(([code, name]) => (
                        <MenuItem key={code} value={code}>
                          {code} — {name}
                        </MenuItem>
                      ))}
                    </TextField>
                    {editing && form.currency !== saved.currency && (
                      <Alert severity="warning">
                        Changing the currency doesn’t convert your prices.
                        Update product prices and delivery prices to match.
                      </Alert>
                    )}
                  </Stack>
                </SectionCard>

                <SectionCard
                  title="Tax"
                  subtitle="How tax is worked out and shown to shoppers."
                >
                  <Stack spacing={2.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="Tax name"
                        value={form.taxLabel}
                        onChange={set('taxLabel')}
                        inputProps={{ maxLength: 20 }}
                        {...err('tax_label')}
                        helperText={
                          errors.tax_label || 'For example VAT or GST.'
                        }
                        fullWidth
                      />
                      <TextField
                        label="Tax rate"
                        type="number"
                        value={form.taxRate}
                        onChange={set('taxRate')}
                        inputProps={{ min: 0, max: 100, step: 'any' }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">%</InputAdornment>
                          ),
                        }}
                        {...err('tax_rate')}
                        fullWidth
                      />
                    </Stack>
                    <RadioGroup
                      value={form.pricesIncludeTax ? 'included' : 'added'}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pricesIncludeTax: e.target.value === 'included',
                        }))
                      }
                    >
                      <FormControlLabel
                        value="included"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              Prices include {form.taxLabel || 'tax'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              The price shoppers see is what they pay; the
                              receipt shows the {form.taxLabel || 'tax'} inside
                              it. Usual in Kenya.
                            </Typography>
                          </Box>
                        }
                        sx={{
                          alignItems: 'flex-start',
                          mb: 1,
                          '& .MuiRadio-root': { mt: -0.5 },
                        }}
                      />
                      <FormControlLabel
                        value="added"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              Add {form.taxLabel || 'tax'} at checkout
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Prices are before tax; the{' '}
                              {form.taxLabel || 'tax'} is added to the total.
                            </Typography>
                          </Box>
                        }
                        sx={{
                          alignItems: 'flex-start',
                          '& .MuiRadio-root': { mt: -0.5 },
                        }}
                      />
                    </RadioGroup>
                  </Stack>
                </SectionCard>
              </Stack>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Box sx={{ position: { lg: 'sticky' }, top: { lg: 108 } }}>
                <Worked form={form} />
              </Box>
            </Grid>
          </Grid>
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

export default FinanceSettingsPage;
