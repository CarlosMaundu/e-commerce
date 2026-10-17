// src/components/password/PasswordRules.js — the password rules under the
// field, ticked off as you type (a tooltip can't be seen on a touch screen).
// The same four things the strength meter counts.
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { FiCheck, FiCircle } from 'react-icons/fi';

const PASSWORD_RULES = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['An uppercase letter', (p) => /[A-Z]/.test(p)],
  ['A lowercase letter', (p) => /[a-z]/.test(p)],
  ['A number or symbol', (p) => /[0-9!@#$%^&*]/.test(p)],
];

const PasswordRules = ({ password }) => (
  <Box
    component="ul"
    aria-label="Password rules"
    sx={{
      listStyle: 'none',
      p: 0,
      m: 0,
      mt: 0.5,
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
      gap: 0.5,
    }}
  >
    {PASSWORD_RULES.map(([label, test]) => {
      const met = test(password || '');
      return (
        <Box
          component="li"
          key={label}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: '0.8rem',
            color: met ? 'success.main' : 'text.secondary',
          }}
        >
          {met ? <FiCheck aria-hidden /> : <FiCircle aria-hidden size={10} />}
          <span>
            {label}
            {met ? ' ✓' : ''}
          </span>
        </Box>
      );
    })}
  </Box>
);
PasswordRules.propTypes = { password: PropTypes.string };

export default PasswordRules;
