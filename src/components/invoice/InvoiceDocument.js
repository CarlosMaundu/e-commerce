// src/components/invoice/InvoiceDocument.js — an order's invoice as a
// printable document: the shop's details, bill-to and ship-to, items,
// totals with the tax line, and what's been paid. Used by customers in their
// account (and by the back office).
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { useStore } from '../../context/StoreContext';
import BrandMark from '../common/BrandMark';
import { Pill } from '../admin/DataTable';
import { formatDate, formatMoney, optionText } from '../../utils/format';
import { formatAddress } from '../../api/mappers';
import { countryName } from '../account/AddressForm';

/** The order's invoice number (older data: built from the order id). */
export const invoiceNumber = (order) =>
  order?.invoiceNumber || `INV-${String(order?.id ?? order).padStart(6, '0')}`;

export const invoiceState = (order) => {
  if (order.paymentStatus === 'refunded' || order.status === 'refunded')
    return ['Refunded', 'info'];
  if (order.status === 'cancelled') return ['Cancelled', 'default'];
  if (order.paymentStatus === 'paid') return ['Paid', 'success'];
  return ['Due', 'warning'];
};

const PAYMENT_NAMES = { stripe: 'Card (Stripe)', cod: 'Cash on delivery' };

const Party = ({ title, address, email }) => (
  <Box>
    <Typography variant="overline" color="text.secondary">
      {title}
    </Typography>
    {address ? (
      <Typography variant="body2" component="div" sx={{ lineHeight: 1.7 }}>
        <strong>
          {`${address.firstName || ''} ${address.lastName || ''}`.trim()}
        </strong>
        <br />
        {formatAddress({ ...address, country: countryName(address.country) })}
        {address.phone && (
          <>
            <br />
            {address.phone}
          </>
        )}
        {email && (
          <>
            <br />
            {email}
          </>
        )}
      </Typography>
    ) : (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    )}
  </Box>
);
Party.propTypes = {
  title: PropTypes.string.isRequired,
  address: PropTypes.object,
  email: PropTypes.string,
};

/** `showAmount`: the amount paid/due box beside the details (customers). */
const InvoiceDocument = ({ order, showAmount = true }) => {
  const shop = useStore();
  const money = (n) => formatMoney(n, order.currency || undefined);
  const t = order.totals || {};
  const [state, tone] = invoiceState(order);
  const paid = state === 'Paid' ? order.total : 0;
  const tax = shop.finance || {};
  const rows = [
    ['Subtotal', money(t.subtotal)],
    ...(t.discount
      ? [
          [
            `Discount${order.coupon ? ` (${order.coupon})` : ''}`,
            `− ${money(t.discount)}`,
          ],
        ]
      : []),
    ...(t.gift ? [['Gift boxes', money(t.gift)]] : []),
    ['Delivery', t.shipping ? money(t.shipping) : 'Free'],
    ...(tax.pricesIncludeTax
      ? []
      : [
          [
            `${tax.taxLabel || 'Tax'}${tax.taxRate ? ` (${tax.taxRate}%)` : ''}`,
            money(t.tax),
          ],
        ]),
  ];

  return (
    <Box
      data-testid="invoice-document"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: { xs: 2.5, sm: 4, md: 6 },
        '@media print': { border: 0, p: 0 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={3}
      >
        <Box>
          <BrandMark size={40} fontSize="1.25rem" />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, lineHeight: 1.7 }}
          >
            {[shop.address, shop.email, shop.phone]
              .filter(Boolean)
              .map((line) => (
                <React.Fragment key={line}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
          </Typography>
        </Box>
        <Box sx={{ textAlign: { sm: 'right' } }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.75rem',
              letterSpacing: '0.06em',
            }}
          >
            INVOICE
          </Typography>
          <Typography variant="subtitle1">{invoiceNumber(order)}</Typography>
          <Box sx={{ mt: 1 }}>
            <Pill label={state} tone={tone} />
          </Box>
        </Box>
      </Stack>

      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: `repeat(${showAmount ? 4 : 3}, minmax(0, 1fr))`,
          },
        }}
      >
        <Party
          title="Bill to"
          address={order.paymentAddress}
          email={order.email}
        />
        <Party title="Ship to" address={order.shippingAddress} />
        <Box>
          <Typography variant="overline" color="text.secondary">
            Details
          </Typography>
          <Typography variant="body2" component="div" sx={{ lineHeight: 1.7 }}>
            Issued {formatDate(order.placedAt)}
            <br />
            Order {order.number}
            <br />
            {PAYMENT_NAMES[order.paymentMethod] || order.paymentMethod}
          </Typography>
        </Box>
        {showAmount && (
          <Box
            sx={{
              bgcolor: 'background.neutral',
              borderRadius: '8px',
              p: 2,
              alignSelf: 'start',
            }}
          >
            <Typography variant="overline" color="text.secondary">
              {state === 'Paid' ? 'Amount paid' : 'Amount due'}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.4rem' }}>
              {money(order.total)}
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 4, overflowX: 'auto' }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            minWidth: 520,
            borderCollapse: 'collapse',
            '& th': {
              textAlign: 'left',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              bgcolor: 'background.neutral',
              px: 2,
              py: 1.5,
            },
            '& td': {
              px: 2,
              py: 1.75,
              borderBottom: 1,
              borderColor: 'divider',
              verticalAlign: 'top',
            },
            '& .num': { textAlign: 'right', whiteSpace: 'nowrap' },
          }}
        >
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  {optionText(item.options) && (
                    <Typography variant="caption">
                      {optionText(item.options)}
                    </Typography>
                  )}
                  {item.gift && (
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      Gift for {item.gift.to} from {item.gift.from}
                      {item.gift.box ? ` · ${item.gift.box.name}` : ''}
                    </Typography>
                  )}
                </td>
                <td className="num">{item.quantity}</td>
                <td className="num">{money(item.price)}</td>
                <td className="num">
                  <strong>{money(item.total)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>

      <Stack alignItems={{ sm: 'flex-end' }} sx={{ mt: 3 }}>
        <Stack spacing={1} sx={{ width: { xs: '100%', sm: 340 } }}>
          {rows.map(([label, value]) => (
            <Stack key={label} direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2">{value}</Typography>
            </Stack>
          ))}
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1">Total</Typography>
            <Typography variant="subtitle1">{money(order.total)}</Typography>
          </Stack>
          {tax.pricesIncludeTax && t.tax > 0 && (
            <Typography variant="caption" sx={{ textAlign: 'right' }}>
              Includes {tax.taxLabel || 'tax'} ({tax.taxRate}%) of{' '}
              {money(t.tax)}
            </Typography>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Paid
            </Typography>
            <Typography variant="body2">{money(paid)}</Typography>
          </Stack>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{
              bgcolor: 'background.neutral',
              borderRadius: '8px',
              px: 1.5,
              py: 1,
            }}
          >
            <Typography variant="subtitle2">Balance due</Typography>
            <Typography variant="subtitle2">
              {money(state === 'Due' ? order.total : 0)}
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 5, textAlign: 'center' }}
      >
        Thank you for shopping with {shop.name}.
        {shop.footerText ? ` ${shop.footerText}` : ''}
      </Typography>
    </Box>
  );
};

InvoiceDocument.propTypes = {
  order: PropTypes.object.isRequired,
  showAmount: PropTypes.bool,
};

export default InvoiceDocument;
