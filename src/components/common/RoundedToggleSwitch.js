// src/components/common/RoundedToggleSwitch.js
import React from 'react';
import { styled } from '@mui/system';
import { Switch, FormControlLabel } from '@mui/material';

const StyledSwitch = styled(Switch)(({ theme }) => ({
  width: 37, // Icon width
  height: 17, // Icon height
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 1,
    '&.Mui-checked': {
      transform: 'translateX(20px)',
      color: theme.palette.common.white,
      '& + .MuiSwitch-track': {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
      },
      '& .MuiSwitch-thumb:before': {
        content: '"On"',
        fontSize: '7px', // font size
        color: theme.palette.primary.main,
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 15, // thumb width
    height: 15, // thumb height
    backgroundColor: theme.palette.common.white,
    border: '1px solid ' + theme.palette.grey[300],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '7px', //  font size
    '&:before': {
      content: '"Off"',
      fontSize: '7px', //  font size
      color: theme.palette.grey[500],
    },
  },
  '& .MuiSwitch-track': {
    borderRadius: 12,
    backgroundColor: theme.palette.grey[300],
    opacity: 1,
  },
}));

const RoundedToggleSwitch = ({ label, checked, onChange }) => {
  return (
    <FormControlLabel
      label={label}
      labelPlacement="end"
      control={
        <StyledSwitch
          checked={checked}
          onChange={onChange}
          inputProps={{ 'aria-label': label }}
        />
      }
      sx={{
        ml: 0,
        '& .MuiFormControlLabel-label': {
          ml: 1.5,
        },
      }}
    />
  );
};

export default RoundedToggleSwitch;
