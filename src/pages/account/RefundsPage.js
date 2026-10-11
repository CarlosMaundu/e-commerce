// src/pages/account/RefundsPage.js — the customer's refunds: how much has
// been paid back, how (card, M-Pesa, bank…), with its reference, and which
// order or return it was for.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Link,
  Stack,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiCheckCircle, FiClock, FiCornerUpLeft } from 'react-icons/fi';
import { orders as ordersApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { Pill } from '../../components/admin/DataTable';
import AccountTable from '../../components/account/AccountTable';
import {
  formatDate,
  formatMoney,
  formatMoneyList,
  totalsByCurrency,
} from '../../utils/format';

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

  // Totals per currency: a refund keeps its order's currency.
  const sum = (status) =>
    formatMoneyList(
      totalsByCurrency((list || []).filter((r) => r.status === status))
    );
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
      <Stack spacing={2}>
        {list?.length > 0 && (
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
              value={sum('refunded')}
              tone="success"
            />
            <Total
              icon={<FiClock />}
              label="Being processed"
              value={sum('processing')}
              tone="warning"
            />
          </Box>
        )}
        <AccountTable
          label="Refunds"
          columns={[
            { label: 'Refund' },
            { label: 'Order' },
            { label: 'Date' },
            { label: 'Paid back' },
            { label: 'Amount', align: 'right' },
            { label: 'Status' },
          ]}
          loading={!list}
          empty={{
            icon: <FiCornerUpLeft />,
            title: 'No refunds',
            text: 'When we refund you for a return or a cancelled order, it shows here.',
          }}
          count={list?.length || 0}
          page={page}
          rowsPerPage={PAGE_SIZE}
          onPageChange={setPage}
          itemsLabel="refunds"
        >
          {shown.map((r) => {
            const [label, tone] = STATUS[r.status] || [r.status, 'default'];
            return (
              <TableRow key={r.id} hover data-testid={`refund-${r.id}`}>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {r.image ? (
                      <Box
                        component="img"
                        src={r.image}
                        alt=""
                        sx={{
                          width: 40,
                          height: 40,
                          objectFit: 'contain',
                          borderRadius: '8px',
                          bgcolor: 'background.neutral',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '8px',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'background.neutral',
                          color: 'primary.main',
                          flexShrink: 0,
                        }}
                      >
                        <FiCornerUpLeft />
                      </Box>
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.product
                        ? `Return of ${r.product}`
                        : 'Refund on your order'}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Link
                    component={RouterLink}
                    to={`/account/orders/${r.orderId}`}
                    underline="hover"
                  >
                    {r.orderNumber}
                  </Link>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDate(r.processedAt || r.date)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {METHOD_WORDS[r.method] || 'Refunded'}
                  </Typography>
                  {r.reference && (
                    <Typography variant="caption" color="text.secondary">
                      Ref {r.reference}
                    </Typography>
                  )}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {formatMoney(r.amount, r.currency)}
                </TableCell>
                <TableCell>
                  <Pill label={label} tone={tone} />
                </TableCell>
              </TableRow>
            );
          })}
        </AccountTable>
      </Stack>
    </AccountPage>
  );
};

export default RefundsPage;
