// src/pages/admin/AuditLogPage.js — who did what, when (the portal's
// AuditLogsModule, simplified): search, area and date filters.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Chip,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { adminSecurity } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { EmptyState } from '../../components/ui';
import {
  PAGE_SIZE,
  PageHeader,
  PanelToolbar,
  SearchField,
  StandardPagination,
  TablePanel,
} from '../../components/admin/DataTable';
import { formatDateTime } from '../../utils/format';

const AREAS = [
  { value: '', label: 'Everything' },
  { value: 'auth.', label: 'Sign-in' },
  { value: 'account.', label: 'Own account changes' },
  { value: 'admin.', label: 'User and security admin' },
  { value: 'admin.impersonation', label: 'Acting as customers' },
  { value: 'catalog.', label: 'Catalog' },
  { value: 'order', label: 'Orders and returns' },
];

const tone = (action) =>
  action.includes('failed') || action.includes('locked')
    ? 'warning'
    : action.includes('deleted') ||
        action.includes('revoked') ||
        action.includes('signed_out')
      ? 'error'
      : 'default';

const AuditLogPage = () => {
  const notify = useNotify();
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    from: '',
    to: '',
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setData(null);
    try {
      setData(
        await adminSecurity.audit({
          ...filters,
          page: page + 1,
          limit: rowsPerPage,
        })
      );
    } catch (error) {
      notify.error(error, 'We couldn’t load the audit log.');
      setData({ total: 0, activity: [] });
    }
  }, [filters, page, rowsPerPage, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (changes) => {
    setFilters((f) => ({ ...f, ...changes }));
    setPage(0);
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Audit log', to: '/admin/audit' },
        ]}
        title="Audit log"
        subtitle="Sign-ins and every change made in the back office. Actions taken while acting as a customer show who really did them."
      />

      <TablePanel>
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(q) => set({ search: q })}
            placeholder="Search by person or target"
            label="Search the audit log"
          />
          <TextField
            select
            size="small"
            label="Area"
            value={filters.action}
            onChange={(e) => set({ action: e.target.value })}
            sx={{ minWidth: 220 }}
          >
            {AREAS.map((a) => (
              <MenuItem key={a.value} value={a.value}>
                {a.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Audit log" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Who</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>IP address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data &&
                [0, 1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton height={32} />
                    </TableCell>
                  </TableRow>
                ))}
              {data?.activity.map((a) => (
                <TableRow key={a.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(a.createdAt)}
                  </TableCell>
                  <TableCell>
                    {a.user ? (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {a.user.name}
                        </Typography>
                        <Typography variant="caption">
                          {a.user.email}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                    {a.impersonatedBy && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={`by ${a.impersonatedBy}`}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={tone(a.action)}
                      label={a.description}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {a.target || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {a.ip || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {data && !data.activity.length && (
          <EmptyState title="Nothing matches those filters." />
        )}
        <StandardPagination
          count={data?.total || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
        />
      </TablePanel>
    </Stack>
  );
};

export default AuditLogPage;
