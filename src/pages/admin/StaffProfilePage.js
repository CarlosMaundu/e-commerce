// src/pages/admin/StaffProfilePage.js — a back-office user's own profile,
// adapted from the portal's ProfileTab: details and photo, role and
// permissions, password, where you're signed in, and recent activity.
import React, { useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FiCamera,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiLock,
  FiLogOut,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { account, adminRoles } from '../../api';
import { roleLabel } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';
import { DetailRows, SectionCard } from '../../components/ui';
import {
  ActivityList,
  SessionsTable,
  timeAgo,
} from '../../components/security/SecurityWidgets';
import { formatDate } from '../../utils/format';
import { PagedList } from '../../components/admin/DataTable';

const PasswordDialog = ({ open, onClose }) => {
  const { changePassword } = useContext(AuthContext);
  const notify = useNotify();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValues({ current: '', next: '', confirm: '' });
      setError('');
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (values.next !== values.confirm) {
      setError(MESSAGES.auth.passwordsDoNotMatch);
      return;
    }
    setBusy(true);
    try {
      await changePassword(values.current, values.next);
      notify.success(
        `${MESSAGES.profile.passwordChanged} Other devices have been signed out.`
      );
      onClose(true);
    } catch (err) {
      setError(err.message || MESSAGES.profile.passwordChangeFailed);
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, autoComplete) => (
    <TextField
      label={label}
      type={show ? 'text' : 'password'}
      value={values[key]}
      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      autoComplete={autoComplete}
      fullWidth
      required
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
              onClick={() => setShow(!show)}
              edge="end"
            >
              {show ? <FiEyeOff /> : <FiEye />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose(false)}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={submit}>
        <DialogTitle>Change password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {field('current', 'Current password', 'current-password')}
            {field('next', 'New password', 'new-password')}
            {field('confirm', 'Confirm new password', 'new-password')}
            {error && (
              <Typography color="error" variant="body2" role="alert">
                {error}
              </Typography>
            )}
            <Typography variant="caption">
              Your other devices will be signed out. The shop’s password rules
              apply.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            onClick={() => onClose(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

PasswordDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const StaffProfilePage = () => {
  const { user, updateUser, logout } = useContext(AuthContext);
  const notify = useNotify();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [activity, setActivity] = useState(null);
  const [permissionNames, setPermissionNames] = useState({});
  const [busyId, setBusyId] = useState(null);

  const loadSessions = () =>
    account
      .sessions()
      .then(setSessions)
      .catch(() => setSessions([]));

  useEffect(() => {
    loadSessions();
    account
      .activity()
      .then(setActivity)
      .catch(() => setActivity([]));
    adminRoles
      .permissions()
      .then((groups) => {
        const names = {};
        groups.forEach((g) =>
          g.permissions.forEach((p) => (names[p.code] = p.description))
        );
        setPermissionNames(names);
      })
      .catch(() => {});
  }, []);

  const saveName = async () => {
    setSaving(true);
    try {
      const updated = await account.updateProfile({ name });
      updateUser(updated);
      notify.success(MESSAGES.profile.updated);
      setEditing(false);
    } catch (error) {
      notify.error(error, MESSAGES.profile.updateFailed);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const updated = await account.uploadAvatar(file);
      updateUser(updated);
      notify.success('Your photo has been updated.');
    } catch (error) {
      notify.error(error, 'We couldn’t upload that photo.');
    } finally {
      setUploading(false);
    }
  };

  const endSession = async (s) => {
    setBusyId(s.id);
    try {
      await account.endSession(s.id);
      notify.success('That device has been signed out.');
      loadSessions();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusyId(null);
    }
  };

  const endOthers = async () => {
    try {
      const n = await account.endOtherSessions();
      notify.success(
        n
          ? `Signed out of ${n} other device${n === 1 ? '' : 's'}.`
          : 'No other devices were signed in.'
      );
      loadSessions();
    } catch (error) {
      notify.error(error);
    }
  };

  const permissions = user.permissions || [];
  const others = (sessions || []).filter((s) => !s.current).length;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" component="h1">
          My profile
        </Typography>
        <Typography color="text.secondary">
          Your back-office account, sign-in security and recent activity.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <SectionCard tinted>
            <Stack direction="row" spacing={2.5} alignItems="center">
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={user.avatar || undefined}
                  alt=""
                  sx={{
                    width: 88,
                    height: 88,
                    fontSize: '2rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {user.name.charAt(0)}
                </Avatar>
                <Tooltip title="Change photo">
                  <IconButton
                    aria-label="Change photo"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    size="small"
                    sx={{
                      position: 'absolute',
                      right: -4,
                      bottom: -4,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    <FiCamera />
                  </IconButton>
                </Tooltip>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label="Profile photo"
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {editing ? (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                    <Button
                      variant="contained"
                      onClick={saveName}
                      disabled={saving || !name.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setEditing(false);
                        setName(user.name);
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5">{user.name}</Typography>
                    <IconButton
                      size="small"
                      aria-label="Edit name"
                      onClick={() => setEditing(true)}
                    >
                      <FiEdit2 />
                    </IconButton>
                  </Stack>
                )}
                <Typography color="text.secondary">{user.email}</Typography>
                <Chip
                  size="small"
                  color="warning"
                  label={roleLabel(user.role)}
                  sx={{ mt: 1, color: '#fff' }}
                />
              </Box>
            </Stack>
            <Box sx={{ mt: 3 }}>
              <DetailRows
                rows={[
                  [
                    'Account status',
                    user.status === 'active' ? 'Active' : 'Suspended',
                  ],
                  ['Member since', formatDate(user.creationAt)],
                  ['Last sign-in', timeAgo(user.lastLogin)],
                  [
                    'Sign-in method',
                    user.hasPassword ? 'Email and password' : 'Google',
                  ],
                ]}
              />
            </Box>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Stack spacing={3}>
            <SectionCard
              title="Password"
              subtitle="Use a strong password you don’t use anywhere else."
              action={
                user.hasPassword && (
                  <Button
                    variant="outlined"
                    startIcon={<FiLock />}
                    onClick={() => setPasswordOpen(true)}
                  >
                    Change password
                  </Button>
                )
              }
            >
              {!user.hasPassword && (
                <Typography variant="body2" color="text.secondary">
                  You sign in with Google. Use “Forgot password” on the sign-in
                  page to add a password.
                </Typography>
              )}
            </SectionCard>

            <SectionCard
              title="Your permissions"
              subtitle={`What the ${roleLabel(user.role)} role can do. Ask a super admin to change it.`}
            >
              {permissions.includes('*') ? (
                <Chip
                  label="Everything, including roles and security"
                  color="primary"
                />
              ) : (
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {permissions.map((p) => (
                    <Chip
                      key={p}
                      size="small"
                      variant="outlined"
                      label={permissionNames[p] || p}
                    />
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <SectionCard
        title="Where you’re signed in"
        subtitle="Back-office sessions end after a period without activity."
        action={
          others > 0 && (
            <Button color="error" startIcon={<FiLogOut />} onClick={endOthers}>
              Sign out other devices
            </Button>
          )
        }
      >
        <PagedList rows={sessions} label="sessions">
          {(rows) => (
            <SessionsTable sessions={rows} onEnd={endSession} busyId={busyId} />
          )}
        </PagedList>
      </SectionCard>

      <SectionCard
        title="Recent activity"
        subtitle="Your last 50 sign-ins and changes."
      >
        <PagedList rows={activity} label="events" padded>
          {(rows) => <ActivityList activity={rows} />}
        </PagedList>
      </SectionCard>

      <Box>
        <Button color="inherit" startIcon={<FiLogOut />} onClick={logout}>
          Sign out of this device
        </Button>
      </Box>

      <PasswordDialog
        open={passwordOpen}
        onClose={(changed) => {
          setPasswordOpen(false);
          if (changed) loadSessions();
        }}
      />
    </Stack>
  );
};

export default StaffProfilePage;
