// src/pages/account/SupportPages.js — the customer's support requests: a
// list with status, and each request as a conversation they can reply to.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  IconButton,
  Link,
  Skeleton,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FiLifeBuoy, FiPlus, FiSend } from 'react-icons/fi';
import StickyActionBar from '../../components/common/StickyActionBar';
import { support } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { SectionCard } from '../../components/ui';
import SupportThread, {
  StatusPill,
} from '../../components/support/SupportThread';
import { formatDate } from '../../utils/format';
import { PAGE_SIZE } from '../../components/admin/DataTable';
import AccountTable from '../../components/account/AccountTable';
import { CardSkeleton, ThreadSkeleton } from '../../components/skeletons';

const NewRequest = () => (
  <Button
    variant="contained"
    startIcon={<FiPlus />}
    component={RouterLink}
    to="/support"
  >
    New request
  </Button>
);

export const SupportRequestsPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    support
      .mine()
      .then(setList)
      .catch((e) => {
        notify.error(e, 'We couldn’t load your requests.');
        setList([]);
      });
  }, [notify]);

  return (
    <AccountPage
      title="Support"
      subtitle="Your questions to us and our replies."
      action={
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <NewRequest />
        </Box>
      }
      barActions={
        <IconButton
          component={RouterLink}
          to="/support"
          aria-label="New request"
          sx={{
            width: 44,
            height: 44,
            borderRadius: '8px',
            bgcolor: 'background.neutral',
          }}
        >
          <FiPlus />
        </IconButton>
      }
    >
      <AccountTable
        label="Support requests"
        columns={[
          { label: 'Request' },
          { label: 'Topic' },
          { label: 'Order' },
          { label: 'Updated' },
          { label: 'Status' },
        ]}
        loading={!list}
        empty={{
          icon: <FiLifeBuoy />,
          title: 'No requests yet',
          text: 'Need help? Send us a request and our replies will appear here.',
        }}
        count={list?.length || 0}
        page={page}
        rowsPerPage={PAGE_SIZE}
        onPageChange={setPage}
        itemsLabel="requests"
      >
        {(list || [])
          .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
          .map((t) => (
            <TableRow
              key={t.number}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => navigate(`/account/support/${t.number}`)}
              data-testid={`support-request-${t.number}`}
            >
              <TableCell>
                <Link
                  component={RouterLink}
                  to={`/account/support/${t.number}`}
                  underline="hover"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ fontWeight: 700 }}
                >
                  {t.subject}
                </Link>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                >
                  {t.number}
                  {t.last_from === 'staff' && t.status === 'waiting' && (
                    <Box
                      component="span"
                      sx={{ color: 'primary.main', fontWeight: 700, ml: 1 }}
                    >
                      New reply
                    </Box>
                  )}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {t.category_name}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {t.order?.order_number || '—'}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(t.last_message_at)}
              </TableCell>
              <TableCell>
                <StatusPill status={t.status} label={t.status_name} />
              </TableCell>
            </TableRow>
          ))}
      </AccountTable>
    </AccountPage>
  );
};

export const SupportRequestPage = () => {
  const { number } = useParams();
  const notify = useNotify();
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  // Phones: the reply box is pinned at the bottom, like a chat.
  const phone = useMediaQuery((t) => t.breakpoints.down('md'));
  // Open at the newest message, and follow new ones.
  const count = ticket?.messages?.length || 0;
  useEffect(() => {
    if (!phone || !count) return;
    requestAnimationFrame(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      })
    );
  }, [phone, count]);

  useEffect(() => {
    support
      .get(number)
      .then(setTicket)
      .catch((e) => notify.error(e, 'We couldn’t load this request.'));
  }, [number, notify]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      setTicket(await support.reply(number, reply));
      setReply('');
      notify.success('Reply sent.');
    } catch (error) {
      notify.error(error, 'We couldn’t send your reply.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AccountPage
      title={ticket ? ticket.subject : 'Support request'}
      barTitle={ticket ? ticket.number : 'Support request'}
      subtitle={
        ticket ? (
          <>
            {/* Phones: the subject isn't in the header bar. */}
            <Box
              component="strong"
              sx={{
                display: { xs: 'block', md: 'none' },
                color: 'text.primary',
              }}
            >
              {ticket.subject}
            </Box>
            {ticket.number} · {ticket.category_name}
            {ticket.order && (
              <>
                {' · '}
                <Link
                  component={RouterLink}
                  to={`/account/orders/${ticket.order.order_id}`}
                >
                  order {ticket.order.order_number}
                </Link>
              </>
            )}
          </>
        ) : (
          ' '
        )
      }
      back="/account/support"
      backLabel="Support"
      action={
        ticket && (
          <StatusPill status={ticket.status} label={ticket.status_name} />
        )
      }
    >
      {!ticket ? (
        <Stack spacing={3} aria-busy="true">
          <CardSkeleton title={false}>
            <ThreadSkeleton messages={2} reply={false} />
          </CardSkeleton>
          <CardSkeleton>
            <Skeleton variant="rounded" height={120} />
          </CardSkeleton>
        </Stack>
      ) : (
        <Stack spacing={3}>
          <SectionCard>
            <SupportThread
              messages={ticket.messages}
              me="customer"
              customerName="You"
            />
          </SectionCard>
          {ticket.status === 'closed' ? (
            <Typography color="text.secondary">
              This request is closed. Need more help?{' '}
              <Link component={RouterLink} to="/support">
                Send a new request
              </Link>
              .
            </Typography>
          ) : phone ? (
            <StickyActionBar aboveNav={false} data-testid="reply-bar">
              <Box
                component="form"
                onSubmit={send}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 1,
                  flex: 1,
                }}
              >
                <TextField
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write your reply…"
                  multiline
                  maxRows={4}
                  fullWidth
                  size="small"
                  inputProps={{
                    maxLength: 5000,
                    'aria-label': 'Your reply',
                    enterKeyHint: 'send',
                  }}
                />
                <IconButton
                  type="submit"
                  aria-label="Send reply"
                  disabled={sending || !reply.trim()}
                  sx={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: '10px',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&.Mui-disabled': { bgcolor: 'background.neutral' },
                  }}
                >
                  <FiSend />
                </IconButton>
              </Box>
            </StickyActionBar>
          ) : (
            <SectionCard title="Reply">
              <Box component="form" onSubmit={send}>
                <TextField
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write your reply…"
                  multiline
                  minRows={3}
                  fullWidth
                  inputProps={{ maxLength: 5000, 'aria-label': 'Your reply' }}
                />
                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  sx={{ mt: 1.5 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={sending || !reply.trim()}
                  >
                    {sending ? 'Sending…' : 'Send reply'}
                  </Button>
                </Stack>
              </Box>
            </SectionCard>
          )}
        </Stack>
      )}
    </AccountPage>
  );
};
