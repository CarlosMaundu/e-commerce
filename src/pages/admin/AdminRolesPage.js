// src/pages/admin/AdminRolesPage.js — roles and their permissions (phase 2).
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiCopy, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminRoles, adminUsers } from '../../api';
import { hasPermission } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard } from '../../components/ui';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

const RoleDialog = ({ mode, role, groups, me, onClose, onSaved }) => {
  const notify = useNotify();
  const [name, setName] = useState(
    mode === 'duplicate' ? `${role.name} copy` : role?.name || ''
  );
  const [description, setDescription] = useState(role?.description || '');
  const [selected, setSelected] = useState(
    new Set((role?.permissions || []).filter((p) => p !== '*'))
  );
  const [busy, setBusy] = useState(false);

  const toggle = (code) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'create')
        await adminRoles.create({
          name,
          description,
          permissions: [...selected],
        });
      else if (mode === 'duplicate')
        await adminRoles.duplicate(role.code, name);
      else
        await adminRoles.update(role.code, {
          name,
          description,
          permissions: [...selected],
        });
      notify.success(mode === 'edit' ? 'Role updated.' : 'Role created.');
      onSaved();
    } catch (error) {
      notify.error(error, 'We couldn’t save the role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <form onSubmit={save}>
        <DialogTitle>
          {mode === 'create'
            ? 'New role'
            : mode === 'duplicate'
              ? `Duplicate ${role.name}`
              : `Edit ${role.name}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Role name"
              required
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {mode !== 'duplicate' && (
              <TextField
                label="What is this role for?"
                size="small"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
            {mode !== 'duplicate' && (
              <Grid container spacing={2}>
                {groups.map((g) => (
                  <Grid item xs={12} md={4} key={g.module}>
                    <Box
                      sx={{
                        bgcolor: 'background.neutral',
                        borderRadius: 1,
                        p: 2,
                        height: '100%',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {g.name}
                      </Typography>
                      {g.permissions.map((p) => {
                        const grantable = hasPermission(me, p.code);
                        return (
                          <Tooltip
                            key={p.code}
                            title={
                              grantable
                                ? p.code
                                : 'You can only grant permissions you have yourself.'
                            }
                            placement="left"
                            describeChild
                          >
                            <FormControlLabel
                              sx={{ display: 'flex', mr: 0 }}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={selected.has(p.code)}
                                  disabled={!grantable}
                                  onChange={() => toggle(p.code)}
                                />
                              }
                              label={
                                <Typography variant="body2">
                                  {p.description}
                                </Typography>
                              }
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || name.trim().length < 2}
          >
            {busy ? 'Saving…' : 'Save role'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

const AdminRolesPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const canManage = hasPermission(user, 'admin.roles.manage');
  const [roles, setRoles] = useState(null);
  const [groups, setGroups] = useState([]);
  const [dialog, setDialog] = useState(null); // { mode, role }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, perms] = await Promise.all([
        adminUsers.listRoles(),
        adminRoles.permissions(),
      ]);
      const detailed = await Promise.all(
        list.map((r) => adminRoles.get(r.code))
      );
      setRoles(detailed);
      setGroups(perms);
    } catch (error) {
      notify.error(error, 'We couldn’t load roles.');
      setRoles([]);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const describe = (permissions) => {
    if (permissions.includes('*')) return 'Everything';
    if (!permissions.length) return 'No back-office access';
    const all = groups.flatMap((g) => g.permissions);
    return permissions
      .map((code) => all.find((p) => p.code === code)?.description || code)
      .join(' · ');
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminRoles.remove(deleting.code);
      notify.success('Role deleted.');
      setDeleting(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t delete the role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-end"
      >
        <Box>
          <Typography variant="h3" component="h1">
            Roles
          </Typography>
          <Typography color="text.secondary">
            What each role can do in the back office.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<FiPlus />}
            onClick={() => setDialog({ mode: 'create' })}
          >
            New role
          </Button>
        )}
      </Stack>
      {!roles ? (
        <Skeleton variant="rounded" height={300} />
      ) : (
        <Grid container spacing={2}>
          {roles.map((r) => (
            <Grid item xs={12} md={6} xl={4} key={r.code}>
              <SectionCard
                tinted
                sx={{ height: '100%' }}
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{r.name}</span>
                    {r.is_system && <Chip size="small" label="Built-in" />}
                  </Stack>
                }
                subtitle={`${r.user_count} user${r.user_count === 1 ? '' : 's'}${r.description ? ` · ${r.description}` : ''}`}
                action={
                  canManage && (
                    <Stack direction="row">
                      {!r.is_system && (
                        <Tooltip title="Edit">
                          <IconButton
                            aria-label={`Edit role ${r.name}`}
                            onClick={() => setDialog({ mode: 'edit', role: r })}
                          >
                            <FiEdit2 />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Duplicate">
                        <IconButton
                          aria-label={`Duplicate role ${r.name}`}
                          onClick={() =>
                            setDialog({ mode: 'duplicate', role: r })
                          }
                        >
                          <FiCopy />
                        </IconButton>
                      </Tooltip>
                      {!r.is_system && (
                        <Tooltip title="Delete">
                          <IconButton
                            aria-label={`Delete role ${r.name}`}
                            onClick={() => setDeleting(r)}
                          >
                            <FiTrash2 />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  )
                }
              >
                <Typography variant="body2" color="text.secondary">
                  {describe(r.permissions)}
                </Typography>
              </SectionCard>
            </Grid>
          ))}
        </Grid>
      )}
      {dialog && (
        <RoleDialog
          {...dialog}
          groups={groups}
          me={user}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            load();
          }}
        />
      )}
      <ConfirmationDialog
        open={Boolean(deleting)}
        title={`Delete the ${deleting?.name} role?`}
        content="People can’t be left without a role, so this only works when nobody has it."
        confirmText="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Stack>
  );
};

export default AdminRolesPage;
