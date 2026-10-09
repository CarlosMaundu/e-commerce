// src/pages/account/SupportPages.js — the customer's support requests: a
// list with status, and each request as a conversation they can reply to.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Link,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiLifeBuoy, FiPlus } from 'react-icons/fi';
import { support } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { EmptyState, SectionCard } from '../../components/ui';
import SupportThread, {
  StatusPill,
} from '../../components/support/SupportThread';
import { formatDate } from '../../utils/format';

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
  const [list, setList] = useState(null);
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
      action={<NewRequest />}
    >
      {!list ? (
        <Skeleton variant="rounded" height={200} />
      ) : !list.length ? (
        <SectionCard>
          <EmptyState icon={<FiLifeBuoy />} title="No requests yet">
            Need help? Send us a request and our replies will appear here.
          </EmptyState>
        </SectionCard>
      ) : (
        <Stack spacing={1.5}>
          {list.map((t) => (
            <Box
              key={t.number}
              component={RouterLink}
              to={`/account/support/${t.number}`}
              data-testid={`support-request-${t.number}`}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                alignItems: 'center',
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.neutral',
                textDecoration: 'none',
                color: 'text.primary',
                '&:hover': { bgcolor: 'background.neutralDeep' },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography sx={{ fontWeight: 700 }}>{t.subject}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t.number} · {t.category_name}
                  {t.order ? ` · order ${t.order.order_number}` : ''} · updated{' '}
                  {formatDate(t.last_message_at)}
                </Typography>
              </Box>
              {t.last_from === 'staff' && t.status === 'waiting' && (
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontWeight: 700 }}
                >
                  New reply
                </Typography>
              )}
              <StatusPill status={t.status} label={t.status_name} />
            </Box>
          ))}
        </Stack>
      )}
    </AccountPage>
  );
};

export const SupportRequestPage = () => {
  const { number } = useParams();
  const notify = useNotify();
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

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
      subtitle={
        ticket ? (
          <>
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
        <Skeleton variant="rounded" height={260} />
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
