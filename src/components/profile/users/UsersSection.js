// src/components/profile/users/UsersSection.js
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FiActivity,
  FiEdit2,
  FiEye,
  FiKey,
  FiLogOut,
  FiMoreVertical,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUnlock,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AuthContext } from '../../../context/AuthContext';
import { useNotify } from '../../../notification/NotificationProvider';
import { MESSAGES } from '../../../notification/messages';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import { adminSecurity, adminUsers } from '../../../api';
import UserActivityDialog from './UserActivityDialog';
import { timeAgo } from '../../security/SecurityWidgets';
import {
  hasPermission,
  PERMISSIONS,
  roleLabel,
} from '../../../auth/permissions';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

const userSchema = Yup.object({
  name: Yup.string().trim().required('Please enter a name.'),
  email: Yup.string()
    .trim()
    .email('Please enter a valid email address.')
    .required('Please enter an email address.'),
  role: Yup.string().required('Please choose a role.'),
  avatar: Yup.string()
    .trim()
    .url('Please enter a full image link starting with https://'),
});

const UserFormDialog = ({
  open,
  mode,
  initialValues,
  isSelf,
  roles,
  onClose,
  onSubmit,
}) => {
  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    validationSchema: userSchema,
    onSubmit: async (values, helpers) => {
      const ok = await onSubmit(values);
      helpers.setSubmitting(false);
      if (ok) helpers.resetForm();
    },
  });
  const busy = formik.isSubmitting;
  const field = (name) => ({
    name,
    value: formik.values[name],
    onChange: formik.handleChange,
    onBlur: formik.handleBlur,
    error: formik.touched[name] && Boolean(formik.errors[name]),
    helperText: formik.touched[name] && formik.errors[name],
  });

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="user-form-title"
    >
      <form onSubmit={formik.handleSubmit} noValidate>
        <DialogTitle id="user-form-title">
          {mode === 'create' ? 'Add user' : 'Edit user'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Full name"
              fullWidth
              size="small"
              autoFocus
              {...field('name')}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              size="small"
              {...field('email')}
              InputProps={{ readOnly: mode === 'edit' }}
              helperText={
                (formik.touched.email && formik.errors.email) ||
                (mode === 'edit'
                  ? 'Sign-in emails can’t be changed.'
                  : 'We’ll email this address a link to set their password.')
              }
            />
            <TextField
              select
              label="Role"
              fullWidth
              size="small"
              {...field('role')}
              disabled={isSelf}
              helperText={isSelf ? 'You can’t change your own role.' : ' '}
            >
              {roles.map((role) => (
                <MenuItem key={role.code} value={role.code}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            {mode === 'edit' && (
              <TextField
                select
                label="Status"
                fullWidth
                size="small"
                {...field('status')}
                disabled={isSelf}
                helperText={
                  isSelf
                    ? 'You can’t suspend your own account.'
                    : 'Suspended users are signed out and can’t sign in.'
                }
              >
                {STATUSES.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Profile picture link (optional)"
              fullWidth
              size="small"
              placeholder="https://…"
              {...field('avatar')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add user' : 'Save changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

UserFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['create', 'edit']).isRequired,
  initialValues: PropTypes.object.isRequired,
  isSelf: PropTypes.bool,
  roles: PropTypes.arrayOf(
    PropTypes.shape({ code: PropTypes.string, name: PropTypes.string })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

const EMPTY_FORM = {
  name: '',
  email: '',
  role: 'customer',
  status: 'active',
  avatar: '',
};

const FALLBACK_ROLES = [{ code: 'customer', name: 'Customer' }];

const UsersSection = () => {
  const {
    user: currentUser,
    adminCreateUser,
    adminSendPasswordReset,
    updateUser,
    startImpersonation,
  } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null); // { anchor, user }
  const [activityUser, setActivityUser] = useState(null);
  const [actAs, setActAs] = useState(null);
  const [signOutTarget, setSignOutTarget] = useState(null);
  const [working, setWorking] = useState(false);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(FALLBACK_ROLES);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formMode, setFormMode] = useState(null); // 'create' | 'edit' | null
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [data, roleList] = await Promise.all([
        adminUsers.list(),
        adminUsers.listRoles().catch(() => FALLBACK_ROLES),
      ]);
      setUsers([...data].sort((a, b) => b.id - a.id));
      setRoles(roleList.length ? roleList : FALLBACK_ROLES);
    } catch (error) {
      setLoadFailed(true);
      notify.error(error, MESSAGES.users.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const canView = hasPermission(currentUser, PERMISSIONS.usersView);
  const canCreate = hasPermission(currentUser, PERMISSIONS.usersCreate);
  const canUpdate = hasPermission(currentUser, PERMISSIONS.usersUpdate);
  const canReset = hasPermission(currentUser, PERMISSIONS.usersResetPassword);
  const canImpersonate = hasPermission(
    currentUser,
    PERMISSIONS.usersImpersonate
  );
  const staffRoles = new Set(
    roles.filter((r) => r.is_staff).map((r) => r.code)
  );
  const isStaffRole = (code) =>
    staffRoles.size ? staffRoles.has(code) : code !== 'customer';

  const startActing = async () => {
    setWorking(true);
    try {
      const customer = await startImpersonation(actAs.id);
      notify.success(`You’re now viewing the shop as ${customer.name}.`);
      navigate('/');
    } catch (error) {
      notify.error(error, 'We couldn’t start acting as that customer.');
    } finally {
      setWorking(false);
      setActAs(null);
    }
  };

  const unlock = async (u) => {
    try {
      await adminSecurity.unlock(u.id);
      notify.success(`${u.email} can sign in again.`);
      loadUsers();
    } catch (error) {
      notify.error(error, 'We couldn’t unlock that account.');
    }
  };

  const signOutEverywhere = async () => {
    setWorking(true);
    try {
      const n = await adminSecurity.signOutEverywhere(signOutTarget.id);
      notify.success(
        n
          ? `${signOutTarget.email} was signed out of ${n} device${n === 1 ? '' : 's'}.`
          : `${signOutTarget.email} wasn’t signed in anywhere.`
      );
      setSignOutTarget(null);
    } catch (error) {
      notify.error(error, 'We couldn’t sign that user out.');
    } finally {
      setWorking(false);
    }
  };
  // Only super admins may hand out (or see as an option) the super admin role.
  const assignableRoles = roles.filter(
    (r) => r.code !== 'super_admin' || currentUser?.role === 'super_admin'
  );

  useEffect(() => {
    if (canView) loadUsers();
  }, [canView, loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === 'all' ||
          u.role === roleFilter ||
          (roleFilter === '__staff' && isStaffRole(u.role))) &&
        (!q ||
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, search, roleFilter, roles]);

  const visible = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleCreate = async (values) => {
    try {
      const created = await adminCreateUser(values);
      setUsers((prev) => [created, ...prev]);
      notify.success(MESSAGES.users.created(created.email));
      setFormMode(null);
      return true;
    } catch (error) {
      notify.error(error, MESSAGES.users.createFailed);
      return false;
    }
  };

  const handleEdit = async (values) => {
    try {
      const updated = await adminUsers.update(editing.id, {
        name: values.name,
        role: editing.id === currentUser?.id ? undefined : values.role,
        status: editing.id === currentUser?.id ? undefined : values.status,
        avatar: values.avatar || undefined,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      if (updated.id === currentUser?.id) updateUser(updated);
      notify.success(MESSAGES.users.updated);
      setFormMode(null);
      setEditing(null);
      return true;
    } catch (error) {
      notify.error(error, MESSAGES.users.updateFailed);
      return false;
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await adminSendPasswordReset(resetTarget);
      notify.success(MESSAGES.users.resetSent(resetTarget.email));
      setResetTarget(null);
    } catch (error) {
      notify.error(error, MESSAGES.users.resetFailed);
    } finally {
      setResetting(false);
    }
  };

  if (!canView) {
    return (
      <Typography color="text.secondary">
        You don’t have permission to manage users.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" className="section-header">
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add people, change their role, unlock accounts, or help a customer
            by viewing the shop as them.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={loadUsers}
                disabled={loading}
                aria-label="Refresh users"
              >
                <FiRefreshCw />
              </IconButton>
            </span>
          </Tooltip>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() => {
                setEditing(null);
                setFormMode('create');
              }}
            >
              Add user
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          sx={{ flex: 1 }}
          inputProps={{ 'aria-label': 'Search users' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FiSearch />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Role"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All roles</MenuItem>
          <MenuItem value="__staff">Back office (any role)</MenuItem>
          {roles.map((role) => (
            <MenuItem key={role.code} value={role.code}>
              {role.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small" aria-label="Users">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Last sign-in</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    <TableCell colSpan={4}>
                      <Skeleton height={36} />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {loadFailed
                        ? MESSAGES.users.loadFailed
                        : search || roleFilter !== 'all'
                          ? 'No users match your search.'
                          : 'No users yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                visible.map((u) => (
                  <TableRow
                    key={u.id}
                    hover
                    data-testid={`user-row-${u.email}`}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={u.avatar}
                          alt=""
                          sx={{ width: 32, height: 32 }}
                        >
                          {(u.name || '?').charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {u.name}
                            {u.id === currentUser?.id && ' (you)'}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {u.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Chip
                          size="small"
                          label={roleLabel(u.role)}
                          color={isStaffRole(u.role) ? 'primary' : 'default'}
                          variant={isStaffRole(u.role) ? 'filled' : 'outlined'}
                        />
                        {u.status === 'suspended' && (
                          <Chip size="small" color="error" label="Suspended" />
                        )}
                        {u.lockedUntil && (
                          <Chip size="small" color="warning" label="Locked" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {canUpdate && (
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            aria-label={`Edit ${u.email}`}
                            onClick={() => {
                              setEditing(u);
                              setFormMode('edit');
                            }}
                          >
                            <FiEdit2 />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canReset && (
                        <Tooltip title="Send password reset email">
                          <IconButton
                            size="small"
                            aria-label={`Reset password for ${u.email}`}
                            onClick={() => setResetTarget(u)}
                          >
                            <FiKey />
                          </IconButton>
                        </Tooltip>
                      )}
                      <IconButton
                        size="small"
                        aria-label={`More actions for ${u.email}`}
                        onClick={(e) =>
                          setMenu({ anchor: e.currentTarget, user: u })
                        }
                      >
                        <FiMoreVertical />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <UserFormDialog
        open={formMode !== null}
        mode={formMode || 'create'}
        isSelf={formMode === 'edit' && editing?.id === currentUser?.id}
        roles={
          // Keep the user's current role selectable even if not assignable.
          editing && !assignableRoles.some((r) => r.code === editing.role)
            ? [
                ...assignableRoles,
                { code: editing.role, name: roleLabel(editing.role) },
              ]
            : assignableRoles
        }
        initialValues={
          formMode === 'edit' && editing
            ? {
                name: editing.name || '',
                email: editing.email || '',
                role: editing.role || 'customer',
                status: editing.status || 'active',
                avatar: editing.avatar || '',
              }
            : EMPTY_FORM
        }
        onClose={() => {
          setFormMode(null);
          setEditing(null);
        }}
        onSubmit={formMode === 'edit' ? handleEdit : handleCreate}
      />

      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
      >
        {menu &&
          canImpersonate &&
          !isStaffRole(menu.user.role) &&
          menu.user.status === 'active' && (
            <MenuItem
              onClick={() => {
                setActAs(menu.user);
                setMenu(null);
              }}
            >
              <ListItemIcon>
                <FiEye />
              </ListItemIcon>
              View as customer
            </MenuItem>
          )}
        <MenuItem
          onClick={() => {
            setActivityUser(menu.user);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <FiActivity />
          </ListItemIcon>
          Activity and sessions
        </MenuItem>
        {menu && canUpdate && menu.user.lockedUntil && (
          <MenuItem
            onClick={() => {
              unlock(menu.user);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <FiUnlock />
            </ListItemIcon>
            Unlock account
          </MenuItem>
        )}
        {menu && canUpdate && menu.user.id !== currentUser?.id && (
          <MenuItem
            onClick={() => {
              setSignOutTarget(menu.user);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <FiLogOut />
            </ListItemIcon>
            Sign out everywhere
          </MenuItem>
        )}
      </Menu>

      <UserActivityDialog
        user={activityUser}
        onClose={() => setActivityUser(null)}
      />

      <ConfirmationDialog
        open={Boolean(actAs)}
        title={`View the shop as ${actAs?.name}?`}
        content="You’ll see their cart, orders and account, and can place orders or request returns for them, for up to 30 minutes. They can’t change their password or post reviews through you. Everything you do is recorded under your name."
        confirmText="View as customer"
        loading={working}
        onConfirm={startActing}
        onCancel={() => setActAs(null)}
      />

      <ConfirmationDialog
        open={Boolean(signOutTarget)}
        title={`Sign ${signOutTarget?.email} out everywhere?`}
        content="They’ll be signed out on every device straight away and will need to sign in again."
        confirmText="Sign out"
        loading={working}
        onConfirm={signOutEverywhere}
        onCancel={() => setSignOutTarget(null)}
      />

      <ConfirmationDialog
        open={Boolean(resetTarget)}
        title="Send password reset email?"
        content={
          resetTarget
            ? `We’ll email ${resetTarget.email} a link to choose a new password. If they don’t have a login yet, the link lets them set one up.`
            : ''
        }
        confirmText="Send email"
        loading={resetting}
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
      />
    </Box>
  );
};

export default UsersSection;
