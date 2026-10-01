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
import { FiEdit2, FiKey, FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AuthContext } from '../../../context/AuthContext';
import { useNotify } from '../../../notification/NotificationProvider';
import { MESSAGES } from '../../../notification/messages';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import { adminUsers, USER_ROLES } from '../../../api';

const roleLabel = (role) =>
  role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Customer';

const userSchema = Yup.object({
  name: Yup.string().trim().required('Please enter a name.'),
  email: Yup.string()
    .trim()
    .email('Please enter a valid email address.')
    .required('Please enter an email address.'),
  role: Yup.string().oneOf(USER_ROLES).required(),
  avatar: Yup.string()
    .trim()
    .url('Please enter a full image link starting with https://'),
});

const UserFormDialog = ({
  open,
  mode,
  initialValues,
  isSelf,
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
              {USER_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {roleLabel(role)}
                </MenuItem>
              ))}
            </TextField>
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
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

const EMPTY_FORM = { name: '', email: '', role: 'customer', avatar: '' };

const UsersSection = () => {
  const {
    user: currentUser,
    adminCreateUser,
    adminSendPasswordReset,
    updateUser,
  } = useContext(AuthContext);
  const notify = useNotify();

  const [users, setUsers] = useState([]);
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
      const data = await adminUsers.list();
      setUsers([...data].sort((a, b) => b.id - a.id));
    } catch (error) {
      setLoadFailed(true);
      notify.error(error, MESSAGES.users.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === 'all' || u.role === roleFilter) &&
        (!q ||
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q))
    );
  }, [users, search, roleFilter]);

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
      await adminSendPasswordReset({
        email: resetTarget.email,
        name: resetTarget.name,
      });
      notify.success(MESSAGES.users.resetSent(resetTarget.email));
      setResetTarget(null);
    } catch (error) {
      notify.error(error, MESSAGES.users.resetFailed);
    } finally {
      setResetting(false);
    }
  };

  if (!isAdmin) {
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
            Add people, change their role, or send them a password reset link.
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
          {USER_ROLES.map((role) => (
            <MenuItem key={role} value={role}>
              {roleLabel(role)}
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
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    <TableCell colSpan={3}>
                      <Skeleton height={36} />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
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
                      <Chip
                        size="small"
                        label={roleLabel(u.role)}
                        color={u.role === 'admin' ? 'primary' : 'default'}
                        variant={u.role === 'admin' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
                      <Tooltip title="Send password reset email">
                        <IconButton
                          size="small"
                          aria-label={`Reset password for ${u.email}`}
                          onClick={() => setResetTarget(u)}
                        >
                          <FiKey />
                        </IconButton>
                      </Tooltip>
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
        initialValues={
          formMode === 'edit' && editing
            ? {
                name: editing.name || '',
                email: editing.email || '',
                role: editing.role || 'customer',
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
