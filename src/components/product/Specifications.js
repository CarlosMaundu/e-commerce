// src/components/product/Specifications.js — the product page's
// Specifications tab: identity (brand, model, product ID), size and weight,
// available options and any extra details entered in the back office.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

const fmt = (n) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });

export const specRows = (product, variant) => {
  const d = product.dimensions;
  const dims = d
    ? [d.length, d.width, d.height].filter((v) => v !== null && v !== undefined)
    : [];
  return [
    ['Brand', product.brand?.name],
    [
      'Manufacturer',
      product.manufacturer !== product.brand?.name ? product.manufacturer : '',
    ],
    ['Category', product.category?.name],
    ['Model / SKU', variant?.sku || product.sku],
    ['Manufacturer part number', product.mfrPartNumber],
    [
      product.barcode?.type
        ? `Product ID (${product.barcode.type})`
        : 'Product ID',
      product.barcode?.value,
    ],
    [
      'Dimensions (L × W × H)',
      dims.length === 3 ? `${dims.map(fmt).join(' × ')} ${d.unit}` : '',
    ],
    ...(dims.length && dims.length < 3
      ? [
          ['Length', d.length ? `${fmt(d.length)} ${d.unit}` : ''],
          ['Width', d.width ? `${fmt(d.width)} ${d.unit}` : ''],
          ['Height', d.height ? `${fmt(d.height)} ${d.unit}` : ''],
        ]
      : []),
    [
      'Weight',
      product.weight
        ? `${fmt(product.weight.value)} ${product.weight.unit}`
        : '',
    ],
    ...product.attributes.map((a) => [
      `${a.name} options`,
      a.values.join(', '),
    ]),
    ...product.specs.map((s) => [s.label, s.value]),
  ].filter(([, value]) => value);
};

const Specifications = ({ product, variant }) => {
  const rows = specRows(product, variant);
  if (!rows.length) {
    return (
      <Typography color="text.secondary">No specifications yet.</Typography>
    );
  }
  return (
    <Box
      component="dl"
      data-testid="specifications"
      sx={{
        m: 0,
        maxWidth: 820,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 260px) 1fr' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        '& > dt, & > dd': {
          m: 0,
          px: 2.5,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        },
        '& > dt:nth-last-of-type(1), & > dd:last-of-type': {
          borderBottom: { sm: 0 },
        },
        '& > dd:last-of-type': { borderBottom: 0 },
      }}
    >
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <Box
            component="dt"
            sx={{
              bgcolor: 'background.neutral',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {label}
          </Box>
          <Box
            component="dd"
            sx={{ color: 'text.secondary', fontSize: '0.9rem' }}
          >
            {value}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

Specifications.propTypes = {
  product: PropTypes.object.isRequired,
  variant: PropTypes.object,
};

export default Specifications;
