// src/components/common/OptionRows.js — an item's chosen variations as
// "Size  M" rows (cart, orders, order details).
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';

/** "Size: M" rows for an item's chosen variations. */
const OptionRows = ({ options, dense }) => {
  const entries = Object.entries(options || {});
  if (!entries.length) return null;
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        columnGap: 1.5,
        rowGap: dense ? 0.25 : 0.5,
        fontSize: dense ? '0.8rem' : '0.85rem',
        '& dt': { color: 'text.secondary', fontWeight: 600 },
        '& dd': { m: 0, color: 'text.primary' },
      }}
    >
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </Box>
  );
};
OptionRows.propTypes = { options: PropTypes.object, dense: PropTypes.bool };

export default OptionRows;
