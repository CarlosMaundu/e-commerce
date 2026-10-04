// src/components/common/PageBreadcrumbs.js — every step is a link, including
// the current page (marked aria-current), so any level can be opened.
import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs, Link } from '@mui/material';

const PageBreadcrumbs = ({ items, sx }) => (
  // Phones use the back arrow in the header instead.
  <Breadcrumbs
    aria-label="Breadcrumb"
    sx={{ ...sx, display: { xs: 'none', md: 'block' } }}
  >
    {items.map((item, i) => {
      const last = i === items.length - 1;
      return (
        <Link
          key={`${item.label}-${i}`}
          component={RouterLink}
          to={item.to}
          underline="hover"
          color={last ? 'text.primary' : 'primary.main'}
          aria-current={last ? 'page' : undefined}
          sx={last ? { fontWeight: 600 } : undefined}
        >
          {item.label}
        </Link>
      );
    })}
  </Breadcrumbs>
);

PageBreadcrumbs.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node.isRequired,
      to: PropTypes.string.isRequired,
    })
  ).isRequired,
  sx: PropTypes.object,
};

export default PageBreadcrumbs;
