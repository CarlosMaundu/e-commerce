// src/pages/admin/AdminRolesPage.js — roles and the permission catalogue in
// the standard tables. Built-in roles can be viewed and duplicated; custom
// roles can be edited and deleted. You can only grant what you hold.
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import PropTypes from 'prop-types';
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
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiCopy, FiEdit2, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { adminRoles, adminUsers } from '../../api';
import { hasPermission } from '../../auth/permissions';
import { useNotify } from '../../notification/NotificationProvider';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  PanelTabs,
  PanelToolbar,
  RowActions,
  SearchField,
  StandardPagination,
  TablePanel,
  usePaging,
} from '../../components/admin/DataTable';

const RoleDialog = ({ mode, role, groups, me, onClose, onSaved }) => {
  const notify = useNotify();
  const readOnly = mode === 'view';
  const [name, setName] = useState(
    mode === 'duplicate' ? `${role.name} copy` : role?.name || ''
  );
  const [description, setDescription] = useState(role?.description || '');
  const [selected, setSelected] = useState(
    new Set((role?.permissions || []).filter((p) => p !== '*'))
  );
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const everything = role?.permissions?.includes('*');

  const grantable = (code) => hasPermission(me, code);
  const toggle = (code) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const toggleGroup = (g, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      g.permissions
        .filter((p) => grantable(p.code))
        .forEach((p) => (on ? next.add(p.code) : next.delete(p.code)));
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

  const q = filter.trim().toLowerCase();
  const total = groups.reduce((s, g) => s + g.permissions.length, 0);
  const title = {
    create: 'New role',
    edit: `Edit ${role?.name}`,
    duplicate: `Duplicate ${role?.name}`,
    view: role?.name,
  }[mode];

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <form onSubmit={save}>
        <DialogTitle>
          {title}
          {readOnly && (
            <Typography variant="body2" color="text.secondary">
              {role.is_system
                ? 'Built-in roles can’t be changed. Duplicate one to make a custom version.'
                : 'Read only.'}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {!readOnly && (
              <TextField
                label="Role name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                fullWidth
              />
            )}
            {(mode === 'create' || mode === 'edit') && (
              <TextField
                label="What is this role for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
              />
            )}
            {mode === 'duplicate' && (
              <Typography color="text.secondary">
                The copy gets the same {role.permissions.length} permissions;
                edit it afterwards to change them.
              </Typography>
            )}
            {mode !== 'duplicate' &&
              (everything ? (
                <Chip
                  color="primary"
                  label="Everything, including roles and security"
                  sx={{ alignSelf: 'flex-start' }}
                />
              ) : (
                <>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <SearchField
                      value={filter}
                      onChange={setFilter}
                      placeholder="Find a permission"
                    />
                    <Typography variant="body2" color="text.secondary">
                      {selected.size} of {total} selected
                    </Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {groups.map((g) => {
                      const shown = g.permissions.filter(
                        (p) =>
                          !q ||
                          p.description.toLowerCase().includes(q) ||
                          p.code.includes(q)
                      );
                      if (!shown.length) return null;
                      const onCount = g.permissions.filter((p) =>
                        selected.has(p.code)
                      ).length;
                      return (
                        <Grid item xs={12} md={6} key={g.module}>
                          <Box
                            sx={{
                              bgcolor: 'background.neutral',
                              borderRadius: 1,
                              p: 2,
                              height: '100%',
                            }}
                          >
                            <FormControlLabel
                              disabled={readOnly}
                              control={
                                <Checkbox
                                  checked={onCount === g.permissions.length}
                                  indeterminate={
                                    onCount > 0 &&
                                    onCount < g.permissions.length
                                  }
                                  onChange={(e) =>
                                    toggleGroup(g, e.target.checked)
                                  }
                                />
                              }
                              label={
                                <Typography variant="subtitle2">
                                  {g.name}{' '}
                                  <Typography
                                    component="span"
                                    variant="caption"
                                  >
                                    ({onCount}/{g.permissions.length})
                                  </Typography>
                                </Typography>
                              }
                            />
                            <Stack sx={{ pl: 3 }}>
                              {shown.map((p) => (
                                <Tooltip
                                  key={p.code}
                                  title={
                                    grantable(p.code)
                                      ? p.code
                                      : 'You can only grant permissions you have yourself.'
                                  }
                                  placement="left"
                                  describeChild
                                >
                                  <FormControlLabel
                                    disabled={readOnly || !grantable(p.code)}
                                    sx={{ mr: 0 }}
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={selected.has(p.code)}
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
                              ))}
                            </Stack>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </>
              ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button
              type="submit"
              variant="contained"
              disabled={busy || name.trim().length < 2}
            >
              {busy ? 'Saving…' : 'Save role'}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

RoleDialog.propTypes = {
  mode: PropTypes.oneOf(['create', 'edit', 'duplicate', 'view']).isRequired,
  role: PropTypes.object,
  groups: PropTypes.array.isRequired,
  me: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const has = (role, code) =>
  role.permissions.includes('*') || role.permissions.includes(code);

const AdminRolesPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const canManage = hasPermission(user, 'admin.roles.manage');
  const [tab, setTab] = useState('roles');
  const [roles, setRoles] = useState(null);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [dialog, setDialog] = useState(null); // { mode, role }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const rolePaging = usePaging();
  const permPaging = usePaging();

  const load = useCallback(async () => {
    try {
      const [list, perms] = await Promise.all([
        adminUsers.listRoles(),
        adminRoles.permissions(),
      ]);
      const detailed = await Promise.all(
        list.map((r) => adminRoles.get(r.code))
      );
      setRoles(
        detailed.map((r) => ({
          ...r,
          is_staff: list.find((x) => x.code === r.code)?.is_staff,
        }))
      );
      setGroups(perms);
    } catch (error) {
      notify.error(error, 'We couldn’t load roles.');
      setRoles([]);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const allPerms = useMemo(
    () =>
      groups.flatMap((g) =>
        g.permissions.map((p) => ({
          ...p,
          module: g.module,
          moduleName: g.name,
        }))
      ),
    [groups]
  );

  const q = search.trim().toLowerCase();
  const shownRoles = (roles || []).filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
  );
  const shownPerms = allPerms.filter(
    (p) =>
      (!moduleFilter || p.module === moduleFilter) &&
      (!q || p.description.toLowerCase().includes(q) || p.code.includes(q))
  );

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
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Roles', to: '/admin/roles' },
        ]}
        title="Roles and permissions"
        subtitle="What each role can do in the back office. Every permission is enforced by the server."
        actions={
          canManage && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() => setDialog({ mode: 'create' })}
            >
              New role
            </Button>
          )
        }
      />

      <TablePanel>
        <PanelTabs
          value={tab}
          onChange={(v) => {
            setTab(v);
            setSearch('');
          }}
          tabs={[
            { value: 'roles', label: 'Roles', count: roles?.length },
            {
              value: 'permissions',
              label: 'Permissions',
              count: allPerms.length || undefined,
            },
          ]}
        />
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              rolePaging.reset();
              permPaging.reset();
            }}
            placeholder={
              tab === 'roles' ? 'Search roles' : 'Search permissions'
            }
          />
          {tab === 'permissions' && (
            <TextField
              select
              size="small"
              label="Area"
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                permPaging.reset();
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All areas</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.module} value={g.module}>
                  {g.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </PanelToolbar>

        {tab === 'roles' ? (
          <>
            <TableContainer>
              <Table aria-label="Roles" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Users</TableCell>
                    <TableCell>Permissions</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!roles && <LoadingRows cols={6} />}
                  {roles && !shownRoles.length && (
                    <EmptyRow cols={6}>No roles match your search.</EmptyRow>
                  )}
                  {rolePaging.slice(shownRoles).map((r) => {
                    const count = r.permissions.includes('*')
                      ? allPerms.length
                      : r.permissions.length;
                    return (
                      <TableRow
                        key={r.code}
                        hover
                        data-testid={`role-row-${r.code}`}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {r.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {r.code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {r.description || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={r.is_system ? 'Built-in' : 'Custom'}
                            color={r.is_system ? 'default' : 'primary'}
                          />
                        </TableCell>
                        <TableCell align="right">{r.user_count}</TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {r.permissions.includes('*')
                              ? 'Everything'
                              : count
                                ? `${count} of ${allPerms.length}`
                                : 'No back-office access'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <RowActions
                            label={`Actions for ${r.name}`}
                            items={[
                              {
                                label: 'View permissions',
                                icon: <FiEye />,
                                onClick: () =>
                                  setDialog({ mode: 'view', role: r }),
                              },
                              {
                                label: 'Edit',
                                icon: <FiEdit2 />,
                                hidden: !canManage || r.is_system,
                                onClick: () =>
                                  setDialog({ mode: 'edit', role: r }),
                              },
                              {
                                label: 'Duplicate',
                                icon: <FiCopy />,
                                hidden:
                                  !canManage || r.permissions.includes('*'),
                                onClick: () =>
                                  setDialog({ mode: 'duplicate', role: r }),
                              },
                              {
                                label: 'Delete',
                                icon: <FiTrash2 />,
                                color: 'error',
                                hidden: !canManage || r.is_system,
                                onClick: () => setDeleting(r),
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <StandardPagination
              count={shownRoles.length}
              {...rolePaging.props}
            />
          </>
        ) : (
          <>
            <TableContainer>
              <Table aria-label="Permissions" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Permission</TableCell>
                    <TableCell>Area</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Roles with it</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!roles && <LoadingRows cols={4} />}
                  {roles && !shownPerms.length && (
                    <EmptyRow cols={4}>No permissions match.</EmptyRow>
                  )}
                  {roles &&
                    permPaging.slice(shownPerms).map((p) => {
                      const holders = roles.filter((r) => has(r, p.code));
                      return (
                        <TableRow key={p.code} hover>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              {p.description}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={p.moduleName}
                              sx={{ bgcolor: 'background.neutralDeep' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              {p.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              {holders.map((r) => (
                                <Chip
                                  key={r.code}
                                  size="small"
                                  variant="outlined"
                                  label={r.name}
                                />
                              ))}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
            <StandardPagination
              count={shownPerms.length}
              {...permPaging.props}
            />
          </>
        )}
      </TablePanel>

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
