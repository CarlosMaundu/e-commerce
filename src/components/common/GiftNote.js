// src/components/common/GiftNote.js — a line sent as a gift: who it's for,
// who from, the message for the packing slip and whether it goes in a box.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import { FiGift } from 'react-icons/fi';

const GiftNote = ({ gift, sx }) => {
  if (!gift) return null;
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      data-testid="gift-note"
      sx={{
        mt: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: '8px',
        bgcolor: 'background.neutral',
        display: 'inline-flex',
        ...sx,
      }}
    >
      <Box sx={{ color: 'primary.main', mt: '3px' }}>
        <FiGift />
      </Box>
      <Typography variant="body2" component="div">
        <strong>Gift</strong> for {gift.to} from {gift.from}
        {gift.giftBox ? ' · in a gift box' : ''}
        {gift.message && (
          <Box component="span" sx={{ display: 'block', fontStyle: 'italic' }}>
            “{gift.message}”
          </Box>
        )}
      </Typography>
    </Stack>
  );
};

GiftNote.propTypes = {
  gift: PropTypes.shape({
    to: PropTypes.string,
    from: PropTypes.string,
    message: PropTypes.string,
    giftBox: PropTypes.bool,
  }),
  sx: PropTypes.object,
};

export default GiftNote;
