// src/pages/admin/PaymentMethodsPage.js — Back office → Payment methods: one
// card per way of paying (card through Stripe, M-Pesa through Daraja, cash on
// delivery) with whether it's on and working. Configure opens a dialog with
// that provider's fields (secrets show only their last four characters; leave
// them empty to keep them), Save, then Test connection.
import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiCheckCircle,
  FiCreditCard,
  FiPackage,
  FiSettings,
  FiSmartphone,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';
import { adminPayments } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { PageHeader, Pill } from '../../components/admin/DataTable';
import { formatDateTime } from '../../utils/format';

const ICONS = {
  stripe: <FiCreditCard />,
  mpesa: <FiSmartphone />,
  cod: <FiPackage />,
};
const MODE_WORDS = {
  stripe: { test: 'Test mode', live: 'Live' },
  mpesa: { test: 'Sandbox', live: 'Live (production)' },
};

const statusOf = (p) => {
  if (!p.enabled) return ['Off', 'default'];
  if (!p.ready) return ['Needs setting up', 'warning'];
  if (p.last_test && !p.last_test.ok) return ['Test failed', 'error'];
  return ['On', 'success'];
};

const ConfigureDialog = ({ provider, onClose, onSaved }) => {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!provider) return;
    setErrors({});
    setResult(provider.last_test || null);
    setPhone('');
    setForm({
      enabled: provider.enabled,
      mode: provider.mode,
      settings: { ...provider.settings },
      secrets: {},
    });
  }, [provider]);
  if (!provider || !form) return null;

  const visible = provider.fields.filter(
    (f) => !f.when || form.settings[f.when.key] === f.when.value
  );
  const setSetting = (key, value) =>
    setForm((f) => ({ ...f, settings: { ...f.settings, [key]: value } }));
  const setSecret = (key, value) =>
    setForm((f) => ({ ...f, secrets: { ...f.secrets, [key]: value } }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const saved = await adminPayments.save(provider.code, form);
      notify.success(`${provider.name} saved.`);
      setForm((f) => ({ ...f, secrets: {} }));
      onSaved(saved);
      return saved;
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t save these settings.');
      return null;
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    // Test what's on screen: save first when something changed.
    const changed =
      Object.values(form.secrets).some(Boolean) ||
      JSON.stringify(form.settings) !== JSON.stringify(provider.settings) ||
      form.mode !== provider.mode ||
      form.enabled !== provider.enabled;
    if (changed && !(await save())) return;
    setTesting(true);
    try {
      const r = await adminPayments.test(provider.code, { phone });
      setResult({ ok: r.ok, message: r.message, at: new Date().toISOString() });
      onSaved(r.provider);
    } catch (error) {
      notify.error(error, 'We couldn’t run the test.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ display: 'flex', color: 'primary.main' }}>
            {ICONS[provider.code]}
          </Box>
          <span>{provider.name}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {provider.description}
          </Typography>
          {provider.from_environment && (
            <Alert severity="info" icon={false}>
              These Stripe keys come from the server’s settings. Enter new keys
              here to replace them.
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={form.enabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
            }
            label={
              form.enabled
                ? 'On: customers and staff can use it'
                : 'Off: not offered anywhere'
            }
          />
          {MODE_WORDS[provider.code] && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Mode
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={form.mode}
                onChange={(_, v) => v && setForm((f) => ({ ...f, mode: v }))}
                aria-label="Mode"
              >
                <ToggleButton value="test">
                  {MODE_WORDS[provider.code].test}
                </ToggleButton>
                <ToggleButton value="live">
                  {MODE_WORDS[provider.code].live}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
          {visible.map((f) => {
            if (f.type === 'switch') {
              return (
                <FormControlLabel
                  key={f.key}
                  control={
                    <Switch
                      checked={Boolean(form.settings[f.key])}
                      onChange={(e) => setSetting(f.key, e.target.checked)}
                    />
                  }
                  label={f.label}
                />
              );
            }
            if (f.type === 'select') {
              return (
                <TextField
                  key={f.key}
                  select
                  label={f.label}
                  value={form.settings[f.key] || ''}
                  onChange={(e) => setSetting(f.key, e.target.value)}
                  error={Boolean(errors[f.key])}
                  helperText={errors[f.key] || f.help}
                  required={f.required}
                  fullWidth
                >
                  {f.options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }
            const secret = f.type === 'secret';
            const saved = secret ? provider.secrets[f.key] : '';
            return (
              <TextField
                key={f.key}
                label={f.label}
                type={secret ? 'password' : 'text'}
                autoComplete="off"
                value={
                  secret
                    ? form.secrets[f.key] || ''
                    : form.settings[f.key] || ''
                }
                onChange={(e) =>
                  secret
                    ? setSecret(f.key, e.target.value)
                    : setSetting(f.key, e.target.value)
                }
                placeholder={saved ? `Saved: ${saved}` : ''}
                InputLabelProps={saved ? { shrink: true } : undefined}
                error={Boolean(errors[f.key])}
                helperText={
                  errors[f.key] ||
                  (saved ? 'Leave empty to keep the saved value.' : f.help)
                }
                required={f.required && !saved}
                fullWidth
              />
            );
          })}
          {provider.code !== 'cod' && (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Test the connection</Typography>
                {provider.code === 'mpesa' && (
                  <TextField
                    label="Send a KES 1 test prompt to (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    size="small"
                    helperText="Checks the credentials; with a number, also sends a real prompt."
                  />
                )}
                {result && (
                  <Alert
                    severity={result.ok ? 'success' : 'error'}
                    data-testid="payment-test-result"
                  >
                    {result.message}
                    {result.at ? ` · ${formatDateTime(result.at)}` : ''}
                  </Alert>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving || testing}>
          Close
        </Button>
        {provider.code !== 'cod' && (
          <Button
            variant="outlined"
            startIcon={<FiZap />}
            onClick={test}
            disabled={saving || testing}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
        )}
        <Button variant="contained" onClick={save} disabled={saving || testing}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
ConfigureDialog.propTypes = {
  provider: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const ProviderCard = ({ provider, onConfigure }) => {
  const theme = useTheme();
  const [label, tone] = statusOf(provider);
  const c = theme.palette.primary.main;
  return (
    <Box
      data-testid={`payment-provider-${provider.code}`}
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
            color: c,
            bgcolor: alpha(c, 0.1),
            flexShrink: 0,
          }}
        >
          {ICONS[provider.code]}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{provider.name}</Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ mt: 0.5 }}
            flexWrap="wrap"
            useFlexGap
          >
            <Pill label={label} tone={tone} />
            {MODE_WORDS[provider.code] && provider.enabled && (
              <Pill
                label={MODE_WORDS[provider.code][provider.mode]}
                tone={provider.mode === 'live' ? 'primary' : 'default'}
              />
            )}
          </Stack>
        </Box>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {provider.description}
      </Typography>
      {provider.last_test && (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box
            sx={{
              color: provider.last_test.ok ? 'success.main' : 'error.main',
              mt: '2px',
              display: 'flex',
            }}
          >
            {provider.last_test.ok ? <FiCheckCircle /> : <FiXCircle />}
          </Box>
          <Typography variant="caption">
            {provider.last_test.message}
            <br />
            Tested {formatDateTime(provider.last_test.at)}
          </Typography>
        </Stack>
      )}
      <Button
        variant="outlined"
        startIcon={<FiSettings />}
        onClick={onConfigure}
        sx={{ alignSelf: 'flex-start' }}
        aria-label={`Configure ${provider.name}`}
      >
        Configure
      </Button>
    </Box>
  );
};
ProviderCard.propTypes = {
  provider: PropTypes.object.isRequired,
  onConfigure: PropTypes.func.isRequired,
};

const PaymentMethodsPage = () => {
  const notify = useNotify();
  const [providers, setProviders] = useState(null);
  const [open, setOpen] = useState(null); // code

  const load = useCallback(
    () =>
      adminPayments
        .providers()
        .then(setProviders)
        .catch((error) => {
          notify.error(error, 'We couldn’t load the payment methods.');
          setProviders([]);
        }),
    [notify]
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Payment methods', to: '/admin/payment-methods' },
        ]}
        title="Payment methods"
        subtitle="How customers pay: online by card, by M-Pesa prompt, or on delivery. Set up each one, then test it."
      />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        {!providers
          ? [0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={230} />
            ))
          : providers.map((p) => (
              <ProviderCard
                key={p.code}
                provider={p}
                onConfigure={() => setOpen(p.code)}
              />
            ))}
      </Box>
      <ConfigureDialog
        provider={providers?.find((p) => p.code === open) || null}
        onClose={() => setOpen(null)}
        onSaved={(saved) =>
          setProviders((list) =>
            list.map((p) => (p.code === saved.code ? saved : p))
          )
        }
      />
    </Stack>
  );
};

export default PaymentMethodsPage;
