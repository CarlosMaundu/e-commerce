// src/pages/account/RefundsPage.js — the customer's refunds: how much has
// been paid back, how (card, M-Pesa, bank…), with its reference, and which
// order or return it was for.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Skeleton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiCheckCircle, FiClock, FiCornerUpLeft } from 'react-icons/fi';
import { orders as ordersApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { EmptyState, SectionCard } from '../../components/ui';
import { Pill, StandardPagination } from '../../components/admin/DataTable';
import { formatDate, formatMoney } from '../../utils/format';

const PAGE_SIZE = 10;

const METHOD_WORDS = {
  stripe: 'To your card',
  mpesa: 'By M-Pesa',
  bank: 'By bank transfer',
  cash: 'In cash or M-Pesa',
  cod: 'In cash or M-Pesa',
};
const STATUS = {
  refunded: ['Refunded', 'success'],
  processing: ['Being processed', 'warning'],
  failed: ['Needs attention', 'error'],
};

const Total = ({ icon, label, value, tone }) => {
  const theme = useTheme();
  const c = theme.palette[tone].main;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        p: 2,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          color: c,
          bgcolor: alpha(c, 0.12),
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" component="div">
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
      </Box>
    </Stack>
  );
};

const RefundsPage = () => {
  const notify = useNotify();
  const [list, setList] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    ordersApi
      .refunds()
      .then(setList)
      .catch((error) => {
        notify.error(error, 'We couldn’t load your refunds.');
        setList([]);
      });
  }, [notify]);

  const sum = (status) =>
    (list || [])
      .filter((r) => r.status === status)
      .reduce((s, r) => s + r.amount, 0);
  const shown = (list || []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AccountPage
      title="Refunds"
      subtitle={
        <>
          Money we’ve paid back to you. See our{' '}
          <Link component={RouterLink} to="/policies/refunds">
            Refund &amp; Return Policy
          </Link>
          .
        </>
      }
    >
      {!list ? (
        <Skeleton variant="rounded" height={200} />
      ) : !list.length ? (
        <SectionCard>
          <EmptyState icon={<FiCornerUpLeft />} title="No refunds">
            When we refund you for a return or a cancelled order, it shows here.
          </EmptyState>
        </SectionCard>
      ) : (
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
              },
            }}
          >
            <Total
              icon={<FiCheckCircle />}
              label="Refunded to you"
              value={formatMoney(sum('refunded'))}
              tone="success"
            />
            <Total
              icon={<FiClock />}
              label="Being processed"
              value={formatMoney(sum('processing'))}
              tone="warning"
            />
          </Box>
          {shown.map((r) => {
            const [label, tone] = STATUS[r.status] || [r.status, 'default'];
            return (
              <Stack
                key={r.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
                data-testid={`refund-${r.id}`}
                sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 2 }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {r.image ? (
                    <Box
                      component="img"
                      src={r.image}
                      alt=""
                      sx={{
                        width: 52,
                        height: 52,
                        objectFit: 'contain',
                        borderRadius: '8px',
                        bgcolor: 'background.paper',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '8px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      <FiCornerUpLeft />
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {r.product
                        ? `Return of ${r.product}`
                        : 'Refund on your order'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <Link
                        component={RouterLink}
                        to={`/account/orders/${r.orderId}`}
                      >
                        Order {r.orderNumber}
                      </Link>
                      {' · '}
                      {formatDate(r.processedAt || r.date)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {METHOD_WORDS[r.method] || 'Refunded'}
                      {r.reference ? ` · Ref ${r.reference}` : ''}
                    </Typography>
                  </Box>
                </Stack>
                <Stack
                  direction={{ xs: 'row', sm: 'column' }}
                  alignItems={{ xs: 'center', sm: 'flex-end' }}
                  justifyContent="space-between"
                  spacing={0.75}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatMoney(r.amount, r.currency)}
                  </Typography>
                  <Pill label={label} tone={tone} />
                </Stack>
              </Stack>
            );
          })}
          {list.length > PAGE_SIZE && (
            <Box
              sx={{
                borderRadius: 1,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <StandardPagination
                count={list.length}
                page={page}
                rowsPerPage={PAGE_SIZE}
                label="refunds"
                maxShowAll={0}
                onRowsPerPageChange={() => {}}
                onPageChange={(_, p) => setPage(p)}
              />
            </Box>
          )}
        </Stack>
      )}
    </AccountPage>
  );
};

export default RefundsPage;
