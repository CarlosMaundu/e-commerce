// src/pages/admin/SecuritySettingsPage.js — the portal's Security Settings,
// adapted: active sessions across the shop, password rules, sign-in lockout,
// back-office session limits and account registration.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  FormControlLabel,
  Grid,
  InputAdornment,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  FiClock,
  FiKey,
  FiLock,
  FiMonitor,
  FiShield,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi';
import { adminSecurity } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard, StatTile } from '../../components/ui';
import { SessionsTable } from '../../components/security/SecurityWidgets';
import { PagedList } from '../../components/admin/DataTable';
import { formatDateTime } from '../../utils/format';
import PageSkeleton from '../../components/common/PageSkeleton';

const NumberField = ({ label, value, onChange, unit, helperText, min = 0 }) => (
  <TextField
    label={label}
    type="number"
    value={value}
    onChange={(e) =>
      onChange(e.target.value === '' ? '' : Number(e.target.value))
    }
    helperText={helperText}
    inputProps={{ min }}
    InputProps={
      unit
        ? {
            endAdornment: (
              <InputAdornment position="end">{unit}</InputAdornment>
            ),
          }
        : undefined
    }
    fullWidth
  />
);

NumberField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onChange: PropTypes.func.isRequired,
  unit: PropTypes.string,
  helperText: PropTypes.string,
  min: PropTypes.number,
};

/** A settings section with its own Save button. */
const PolicyForm = ({
  title,
  subtitle,
  section,
  settings,
  onSaved,
  children,
}) => {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await adminSecurity.saveSettings({
        [section]: settings[section],
      });
      onSaved(saved);
      notify.success('Security settings saved.');
    } catch (error) {
      notify.error(error, 'We couldn’t save the settings.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <Box component="form" onSubmit={save}>
        {children}
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Box>
    </SectionCard>
  );
};

PolicyForm.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  section: PropTypes.string.isRequired,
  settings: PropTypes.object.isRequired,
  onSaved: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

const ActiveSessions = () => {
  const notify = useNotify();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const load = () =>
    adminSecurity
      .sessions()
      .then(setData)
      .catch((error) => {
        notify.error(error, 'We couldn’t load sessions.');
        setData({ stats: {}, sessions: [] });
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = async (s) => {
    setBusyId(s.id);
    try {
      await adminSecurity.endSession(s.id);
      notify.success(
        `${s.user?.name || 'That user'} has been signed out on that device.`
      );
      load();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusyId(null);
    }
  };

  const shown = (data?.sessions || []).filter(
    (s) => filter === 'all' || (filter === 'staff' ? s.staff : !s.staff)
  );
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {[
          [
            'Active sessions',
            data?.stats.active,
            <FiMonitor key="a" />,
            'primary',
          ],
          ['Back office', data?.stats.staff, <FiShield key="b" />, 'warning'],
          ['Customers', data?.stats.customers, <FiUsers key="c" />, 'success'],
          [
            'Active in the last day',
            data?.stats.active_today,
            <FiClock key="d" />,
            'info',
          ],
        ].map(([label, value, icon, color]) => (
          <Grid item xs={6} md={3} key={label}>
            <StatTile
              card
              label={label}
              value={value ?? '—'}
              icon={icon}
              color={color}
            />
          </Grid>
        ))}
      </Grid>
      <SectionCard
        title="Sessions"
        subtitle="Everyone signed in right now. Signing a session out takes effect immediately."
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, v) => v && setFilter(v)}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="staff">Back office</ToggleButton>
            <ToggleButton value="customers">Customers</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <PagedList rows={data ? shown : null} label="sessions">
          {(rows) => (
            <SessionsTable
              sessions={rows}
              onEnd={end}
              busyId={busyId}
              showUser
            />
          )}
        </PagedList>
      </SectionCard>
    </Stack>
  );
};

const TABS = [
  { value: 'sessions', label: 'Active sessions', icon: <FiMonitor /> },
  { value: 'password', label: 'Password', icon: <FiKey /> },
  { value: 'lockout', label: 'Sign-in lockout', icon: <FiLock /> },
  { value: 'staff', label: 'Session timeout', icon: <FiClock /> },
  { value: 'accounts', label: 'Accounts', icon: <FiUserPlus /> },
];

const SecuritySettingsPage = () => {
  const notify = useNotify();
  const [tab, setTab] = useState('sessions');
  const [meta, setMeta] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    adminSecurity
      .settings()
      .then((d) => {
        setMeta(d);
        setSettings(d.settings);
      })
      .catch((error) =>
        notify.error(error, 'We couldn’t load security settings.')
      );
  }, [notify]);

  const set = (section, changes) =>
    setSettings((s) => ({ ...s, [section]: { ...s[section], ...changes } }));
  const onSaved = (saved) => {
    setSettings(saved);
    setMeta((m) => ({
      ...m,
      updated_at: new Date().toISOString(),
      updated_by: 'you',
    }));
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" component="h1">
          Security settings
        </Typography>
        <Typography color="text.secondary">
          Rules for passwords, sign-in and sessions across the shop and the back
          office.
          {meta?.updated_at &&
            ` Last changed ${formatDateTime(meta.updated_at)}${meta.updated_by ? ` by ${meta.updated_by}` : ''}.`}
        </Typography>
      </Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            icon={t.icon}
            iconPosition="start"
          />
        ))}
      </Tabs>

      {tab === 'sessions' && <ActiveSessions />}
      {tab !== 'sessions' && !settings && <PageSkeleton variant="form" />}

      {tab === 'password' && settings && (
        <PolicyForm
          title="Password rules"
          subtitle="Apply to new passwords for customers and staff. Passwords always need upper- and lowercase letters and a number or symbol."
          section="password"
          settings={settings}
          onSaved={onSaved}
        >
          <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
            <NumberField
              label="Minimum length"
              unit="characters"
              min={8}
              value={settings.password.min_length}
              onChange={(v) => set('password', { min_length: v })}
              helperText="At least 8."
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.password.require_symbol}
                  onChange={(e) =>
                    set('password', { require_symbol: e.target.checked })
                  }
                />
              }
              label="Require a symbol (such as ! or #)"
            />
          </Stack>
        </PolicyForm>
      )}

      {tab === 'lockout' && settings && (
        <PolicyForm
          title="Sign-in lockout"
          subtitle="After too many wrong passwords an account is locked for a while. Staff can unlock it from Users."
          section="lockout"
          settings={settings}
          onSaved={onSaved}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ maxWidth: 640 }}
          >
            <NumberField
              label="Failed attempts before lockout"
              min={3}
              value={settings.lockout.max_attempts}
              onChange={(v) => set('lockout', { max_attempts: v })}
            />
            <NumberField
              label="Lockout duration"
              unit="minutes"
              min={1}
              value={settings.lockout.minutes}
              onChange={(v) => set('lockout', { minutes: v })}
            />
          </Stack>
        </PolicyForm>
      )}

      {tab === 'staff' && settings && (
        <PolicyForm
          title="Back-office sessions"
          subtitle="Staff accounts can do more, so their sessions are shorter. Customer sessions are not affected."
          section="staff_sessions"
          settings={settings}
          onSaved={onSaved}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <NumberField
              label="Maximum session length"
              unit="hours"
              min={1}
              value={settings.staff_sessions.max_hours}
              onChange={(v) => set('staff_sessions', { max_hours: v })}
              helperText="Staff sign in again after this."
            />
            <NumberField
              label="Inactivity timeout"
              unit="minutes"
              min={5}
              value={settings.staff_sessions.idle_minutes}
              onChange={(v) => set('staff_sessions', { idle_minutes: v })}
              helperText="Signed out after this long without activity."
            />
            <NumberField
              label="Devices at once"
              min={1}
              value={settings.staff_sessions.max_concurrent}
              onChange={(v) => set('staff_sessions', { max_concurrent: v })}
              helperText="Signing in on another device ends the oldest."
            />
          </Stack>
        </PolicyForm>
      )}

      {tab === 'accounts' && settings && (
        <PolicyForm
          title="Customer accounts"
          subtitle="Staff accounts are always created by an admin from Users."
          section="accounts"
          settings={settings}
          onSaved={onSaved}
        >
          <FormControlLabel
            control={
              <Switch
                checked={settings.accounts.allow_registration}
                onChange={(e) =>
                  set('accounts', { allow_registration: e.target.checked })
                }
              />
            }
            label="Shoppers can create their own accounts (sign up, and first Google sign-in)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!settings.accounts.require_email_verification}
                onChange={(e) =>
                  set('accounts', {
                    require_email_verification: e.target.checked,
                  })
                }
              />
            }
            label="New accounts must confirm their email address before they can sign in"
          />
          <Typography variant="body2" color="text.secondary">
            When this is on, new sign-ups get an email with a confirmation link,
            and signing in is refused until they use it. Google accounts are
            already confirmed. Existing accounts aren’t affected.
          </Typography>
        </PolicyForm>
      )}
    </Stack>
  );
};

export default SecuritySettingsPage;
