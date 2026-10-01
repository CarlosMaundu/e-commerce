// src/components/common/Breadcrumb.js
import React from 'react';
import { Box, Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const Breadcrumb = ({ items }) => {
  return (
    <Box
      sx={{
        mt: 0.5,
        display: 'flex',
        justifyContent: 'flex-start',
        width: '100%',
      }}
    >
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{
          flexWrap: 'nowrap',
        }}
      >
        {items.map((item, index) => (
          <Link
            key={index}
            color={
              index === items.length - 1 ? 'text.primary' : 'text.secondary'
            }
            href={item.href}
            underline="hover"
            sx={{
              cursor: 'pointer',
              fontSize: {
                xs: '0.75rem',
                sm: '0.85rem',
                md: '0.85rem',
              },
              fontWeight: index === items.length - 1 ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.label}
          </Link>
        ))}
      </Breadcrumbs>
    </Box>
  );
};

export default Breadcrumb;
