// src/pages/admin/SupportPages.js — Back office → Support: the inbox of
// customer requests (standard table: status tabs with counts, search, topic
// filter, pagination) and one request: the conversation, a reply box that
// emails the customer and sets the status, and the customer and order.
import React, { useContext, useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Link,
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
import { FiSend } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { adminSupport, support } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard } from '../../components/ui';
import {
  EmptyRow,
  FilterMenu,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelTabs,
  PanelToolbar,
  SearchField,
  StandardPagination,
  TablePanel,
} from '../../components/admin/DataTable';
import SupportThread, {
  StatusPill,
} from '../../components/support/SupportThread';
import { formatDateTime, formatShortDate } from '../../utils/format';

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'waiting', label: 'Waiting on customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];
const AFTER_REPLY = [
  ['waiting', 'Waiting on customer'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
];

export const SupportInboxPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) =>
      v ? next.set(k, v) : next.delete(k)
    );
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };
  const tab = get('tab') || 'open';
  const page = Number(get('page') || 1) - 1;
  const [search, setSearch] = useState(get('search'));
  const [categories, setCategories] = useState({});
  const [data, setData] = useState(null);

  useEffect(() => {
    support
      .categories()
      .then(setCategories)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let live = true;
    setData(null);
    adminSupport
      .list({
        page: page + 1,
        limit: PAGE_SIZE,
        ...(tab !== 'all' ? { status: tab } : {}),
        ...(get('search') ? { search: get('search') } : {}),
        ...(get('category') ? { category: get('category') } : {}),
      })
      .then((d) => live && setData(d))
      .catch((e) => {
        notify.error(e, 'We couldn’t load support requests.');
        if (live) setData({ tickets: [], total: 0, counts: {} });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);

  const counts = data?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Support', to: '/admin/support' },
        ]}
        title="Support requests"
        subtitle="Questions from customers and visitors. Replies are emailed to them."
      />
      <TablePanel>
        <PanelTabs
          value={tab}
          onChange={(v) => set({ tab: v })}
          tabs={TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: data
              ? t.value === 'all'
                ? all
                : counts[t.value] || 0
              : undefined,
          }))}
        />
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(q) => set({ search: q })}
            placeholder="Search number, subject, name, email or order"
            label="Search support requests"
          />
          <Box sx={{ flex: 1 }} />
          <FilterMenu
            label="Topic"
            value={get('category')}
            onChange={(v) => set({ category: v })}
            options={[
              { value: '', label: 'All' },
              ...Object.entries(categories).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Support requests">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>From</TableCell>
                <TableCell>Topic</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Last update</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data ? (
                <LoadingRows cols={6} rows={PAGE_SIZE} />
              ) : data.tickets.length ? (
                data.tickets.map((t) => (
                  <TableRow
                    key={t.ticket_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      if (!e.target.closest('a'))
                        navigate(`/admin/support/${t.ticket_id}`);
                    }}
                    data-testid={`support-row-${t.number}`}
                  >
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: t.status === 'open' ? 700 : 500 }}
                        noWrap
                      >
                        {t.subject}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {t.customer_id ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/users/${t.customer_id}`}
                          underline="hover"
                        >
                          {t.name}
                        </Link>
                      ) : (
                        <Typography variant="body2">{t.name}</Typography>
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                      >
                        {t.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{t.category_name}</TableCell>
                    <TableCell>
                      {t.order ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/orders/${t.order.order_id}`}
                          underline="hover"
                        >
                          {t.order.order_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell
                      sx={{ whiteSpace: 'nowrap' }}
                      title={formatDateTime(t.last_message_at)}
                    >
                      {formatShortDate(t.last_message_at)}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                      >
                        {t.last_from === 'customer'
                          ? 'Customer wrote'
                          : 'We replied'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={t.status} label={t.status_name} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow cols={6}>No requests here.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && data.total > 0 && (
          <StandardPagination
            count={data.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => set({ page: String(p + 1) })}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="requests"
          />
        )}
      </TablePanel>
    </Stack>
  );
};

export const SupportTicketPage = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const canReply = hasPermission(user, PERMISSIONS.supportReply);
  const notify = useNotify();
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [after, setAfter] = useState('waiting');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminSupport
      .get(id)
      .then(setTicket)
      .catch((e) => notify.error(e, 'We couldn’t load this request.'));
  }, [id, notify]);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setTicket(await adminSupport.reply(id, reply, after));
      setReply('');
      notify.success(`Reply sent to ${ticket.email}.`);
    } catch (error) {
      notify.error(error, 'We couldn’t send the reply.');
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (status) => {
    setBusy(true);
    try {
      setTicket(await adminSupport.setStatus(id, status));
      notify.success('Status updated.');
    } catch (error) {
      notify.error(error, 'We couldn’t update the status.');
    } finally {
      setBusy(false);
    }
  };

  if (!ticket) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={320} height={56} />
        <Skeleton variant="rounded" height={360} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Support', to: '/admin/support' },
          { label: ticket.number, to: `/admin/support/${ticket.ticket_id}` },
        ]}
        title={
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <span>{ticket.subject}</span>
            <StatusPill status={ticket.status} label={ticket.status_name} />
          </Stack>
        }
        subtitle={`${ticket.number} · ${ticket.category_name} · opened ${formatDateTime(ticket.created_at)}`}
      />
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            <SectionCard title="Conversation">
              <SupportThread
                messages={ticket.messages}
                me="staff"
                customerName={ticket.name}
              />
            </SectionCard>
            {canReply && (
              <SectionCard
                title="Reply"
                subtitle={`Emailed to ${ticket.email}.`}
              >
                <Box component="form" onSubmit={send}>
                  <TextField
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={`Write to ${ticket.name}…`}
                    multiline
                    minRows={5}
                    fullWidth
                    inputProps={{ maxLength: 5000, 'aria-label': 'Reply' }}
                  />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="flex-end"
                    alignItems={{ sm: 'center' }}
                    spacing={1.5}
                    sx={{ mt: 1.5 }}
                  >
                    <TextField
                      select
                      size="small"
                      label="Then mark as"
                      value={after}
                      onChange={(e) => setAfter(e.target.value)}
                      sx={{ minWidth: 220 }}
                    >
                      {AFTER_REPLY.map(([v, l]) => (
                        <MenuItem key={v} value={v}>
                          {l}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<FiSend />}
                      disabled={busy || reply.trim().length < 2}
                    >
                      {busy ? 'Sending…' : 'Send reply'}
                    </Button>
                  </Stack>
                </Box>
              </SectionCard>
            )}
          </Stack>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <SectionCard title="Customer">
              <Stack spacing={0.75}>
                {ticket.customer_id ? (
                  <Link
                    component={RouterLink}
                    to={`/admin/users/${ticket.customer_id}`}
                    sx={{ fontWeight: 700 }}
                  >
                    {ticket.name}
                  </Link>
                ) : (
                  <Typography sx={{ fontWeight: 700 }}>
                    {ticket.name}{' '}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      (not signed in)
                    </Typography>
                  </Typography>
                )}
                <Link
                  href={`mailto:${ticket.email}`}
                  underline="hover"
                  variant="body2"
                >
                  {ticket.email}
                </Link>
                {ticket.phone && (
                  <Typography variant="body2">{ticket.phone}</Typography>
                )}
                {ticket.order && (
                  <Typography variant="body2">
                    Order{' '}
                    <Link
                      component={RouterLink}
                      to={`/admin/orders/${ticket.order.order_id}`}
                    >
                      {ticket.order.order_number}
                    </Link>
                  </Typography>
                )}
              </Stack>
            </SectionCard>
            {canReply && (
              <SectionCard title="Status">
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Status"
                  value={ticket.status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={busy}
                >
                  {TABS.filter((t) => t.value !== 'all').map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
};
