// src/components/common/RichText.js — shows a formatted (sanitised) product
// description with the shop's typography.
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { toSafeHtml } from '../../utils/richText';

export const richTextSx = {
  color: 'text.secondary',
  lineHeight: 1.7,
  '& p': { m: 0, mb: 1.5 },
  '& p:last-child': { mb: 0 },
  '& ul, & ol': { pl: 3, my: 1.5 },
  '& li': { mb: 0.5 },
  '& h2, & h3, & h4': { color: 'text.primary', mt: 2, mb: 1, lineHeight: 1.3 },
  '& h2': { fontSize: '1.25rem' },
  '& h3': { fontSize: '1.1rem' },
  '& a': { color: 'primary.main' },
  '& blockquote': {
    m: 0,
    my: 1.5,
    pl: 2,
    borderLeft: 3,
    borderColor: 'divider',
  },
  '& strong, & b': { color: 'text.primary' },
};

const RichText = ({ html, sx, ...rest }) => (
  <Box
    sx={{ ...richTextSx, ...sx }}
    // Sanitised by toSafeHtml (DOMPurify) and on the server.
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{ __html: toSafeHtml(html) }}
    {...rest}
  />
);

RichText.propTypes = { html: PropTypes.string, sx: PropTypes.object };

export default RichText;
