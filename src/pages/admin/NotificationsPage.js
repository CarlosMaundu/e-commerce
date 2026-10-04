// src/pages/admin/NotificationsPage.js — every notification for this person
// in the standard table: filter by unread or type, open, dismiss one, mark
// all read or clear all. The bell shows only the newest 10.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiCheck, FiExternalLink, FiTrash2, FiX } from 'react-icons/fi';
import { adminOrders } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import {
  EmptyRow,
  FilterMenu,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelTabs,
  PanelToolbar,
  Pill,
  SearchField,
  StandardPagination,
  TablePanel,
} from '../../components/admin/DataTable';
import {
  kindOf,
  NOTIFICATION_KINDS,
  timeAgo,
} from '../../components/admin/notificationKinds';
import { formatDateTime, formatShortDate } from '../../utils/format';

const KindPill = ({ kind }) => {
  const theme = useTheme();
  const { icon, tone, name } = kindOf(kind);
  const c = theme.palette[tone].main;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: c,
          bgcolor: alpha(c, 0.12),
        }}
      >
        {icon}
      </Box>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {name}
      </Typography>
    </Stack>
  );
};

const NotificationsPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('all');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    adminOrders
      .notifications({ all: true })
      .then(setData)
      .catch((e) => {
        notify.error(e, 'We couldn’t load notifications.');
        setData({ items: [], total: 0, unread: 0 });
      });
  }, [notify]);
  useEffect(load, [load]);

  const items = useMemo(() => data?.items || [], [data]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (tab === 'all' || i.unread) &&
        (!kind || i.kind === kind) &&
        (!q || `${i.title} ${i.body}`.toLowerCase().includes(q))
    );
  }, [items, tab, kind, search]);
  const rows = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => setPage(0), [tab, kind, search]);

  const dismiss = (key) => {
    setData((d) => ({ ...d, items: d.items.filter((i) => i.key !== key) }));
    adminOrders.dismissNotification(key).catch(load);
  };
  const markRead = () => {
    setData((d) => ({
      ...d,
      unread: 0,
      items: d.items.map((i) => ({ ...i, unread: false })),
    }));
    adminOrders.notificationsRead().catch(load);
  };
  const clearAll = () => {
    setData((d) => ({ ...d, items: [], unread: 0 }));
    adminOrders
      .notificationsClear()
      .then(() => notify.success('Notifications cleared.'))
      .catch(load);
  };

  const unread = items.filter((i) => i.unread).length;
  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Notifications', to: '/admin/notifications' },
        ]}
        title="Notifications"
        subtitle="What needs your attention, newest first."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FiCheck />}
              onClick={markRead}
              disabled={!unread}
              sx={{ bgcolor: 'background.paper' }}
            >
              Mark all read
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<FiTrash2 />}
              onClick={clearAll}
              disabled={!items.length}
              sx={{ bgcolor: 'background.paper' }}
            >
              Clear all
            </Button>
          </Stack>
        }
      />
      <TablePanel>
        <PanelTabs
          value={tab}
          onChange={setTab}
          tabs={[
            {
              value: 'all',
              label: 'All',
              count: data ? items.length : undefined,
            },
            {
              value: 'unread',
              label: 'Unread',
              count: data ? unread : undefined,
            },
          ]}
        />
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search notifications"
          />
          <Box sx={{ flex: 1 }} />
          <FilterMenu
            label="Type"
            value={kind}
            onChange={setKind}
            options={[
              { value: '', label: 'All' },
              ...Object.entries(NOTIFICATION_KINDS).map(([value, k]) => ({
                value,
                label: k.name,
              })),
            ]}
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Notifications">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Notification</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={5} rows={PAGE_SIZE} />
              ) : rows.length ? (
                rows.map((n) => (
                  <TableRow
                    key={n.key}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(n.link)}
                    data-testid={`notification-${n.key}`}
                  >
                    <TableCell>
                      <KindPill kind={n.kind} />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: n.unread ? 700 : 500 }}
                      >
                        {n.title}
                      </Typography>
                      <Typography variant="caption">{n.body}</Typography>
                    </TableCell>
                    <TableCell
                      sx={{ whiteSpace: 'nowrap' }}
                      title={formatDateTime(n.at)}
                    >
                      {formatShortDate(n.at)}
                      <Typography variant="caption" component="div">
                        {timeAgo(n.at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Pill
                        label={n.unread ? 'New' : 'Seen'}
                        tone={n.unread ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Open">
                        <IconButton
                          size="small"
                          aria-label={`Open: ${n.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(n.link);
                          }}
                        >
                          <FiExternalLink />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dismiss">
                        <IconButton
                          size="small"
                          aria-label={`Dismiss: ${n.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n.key);
                          }}
                        >
                          <FiX />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow cols={5}>
                  {items.length
                    ? 'No notifications match.'
                    : 'You’re all caught up.'}
                </EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {shown.length > 0 && (
          <StandardPagination
            count={shown.length}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="notifications"
          />
        )}
      </TablePanel>
    </Stack>
  );
};

export default NotificationsPage;
