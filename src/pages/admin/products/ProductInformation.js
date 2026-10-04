// src/pages/admin/products/ProductInformation.js — step 3 of the product
// form (Aurora's "Product information"): length, width and height with a
// unit, weight with a unit, and optional extra details (name + value) that
// shoppers see under Specifications.
import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiPlus, FiX } from 'react-icons/fi';

export const DIMENSION_UNITS = [
  ['cm', 'Centimetres'],
  ['mm', 'Millimetres'],
  ['m', 'Metres'],
  ['in', 'Inches'],
  ['ft', 'Feet'],
];
export const WEIGHT_UNITS = [
  ['kg', 'Kilograms'],
  ['g', 'Grams'],
  ['lb', 'Pounds'],
  ['oz', 'Ounces'],
];

/** "30 × 12 × 45 cm · 1.2 kg · 2 details" for the collapsed step. */
export const infoSummary = (f) => {
  const dims = [f.length, f.width, f.height].filter(
    (v) => v !== '' && v !== null
  );
  const parts = [
    dims.length ? `${dims.join(' × ')} ${f.dimensionUnit}` : null,
    f.weight !== '' && f.weight !== null ? `${f.weight} ${f.weightUnit}` : null,
    f.specs.length
      ? `${f.specs.length} detail${f.specs.length === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);
  return parts.join(' · ') || null;
};

/** Grey label box beside the value, as in Aurora's product information. */
const RowLabel = ({ children }) => (
  <Box
    sx={{
      width: { xs: '100%', sm: 150 },
      flexShrink: 0,
      height: 48,
      px: 2,
      display: 'flex',
      alignItems: 'center',
      borderRadius: '8px',
      bgcolor: 'background.neutralDeep',
      color: 'text.secondary',
      fontWeight: 600,
      fontSize: '0.9rem',
    }}
  >
    {children}
  </Box>
);
RowLabel.propTypes = { children: PropTypes.node };

const UnitSelect = ({ value, onChange, units, label }) => (
  <TextField
    select
    label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    sx={{ width: { xs: '100%', sm: 170 }, flexShrink: 0 }}
  >
    {units.map(([v, name]) => (
      <MenuItem key={v} value={v}>
        {name}
      </MenuItem>
    ))}
  </TextField>
);
UnitSelect.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  units: PropTypes.array.isRequired,
  label: PropTypes.string.isRequired,
};

const ProductInformation = ({ form, set, error }) => {
  const unitOf = (k) => (k === 'weight' ? form.weightUnit : form.dimensionUnit);
  const measure = (key, name) => (
    <Stack
      key={key}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ sm: 'center' }}
    >
      <RowLabel>{name}</RowLabel>
      <TextField
        type="number"
        label={`${name} value`}
        value={form[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        inputProps={{ min: 0, step: 'any' }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">{unitOf(key)}</InputAdornment>
          ),
        }}
        fullWidth
      />
      {key === 'length' && (
        <UnitSelect
          label="Size unit"
          value={form.dimensionUnit}
          onChange={(dimensionUnit) => set({ dimensionUnit })}
          units={DIMENSION_UNITS}
        />
      )}
      {key === 'weight' && (
        <UnitSelect
          label="Weight unit"
          value={form.weightUnit}
          onChange={(weightUnit) => set({ weightUnit })}
          units={WEIGHT_UNITS}
        />
      )}
      {(key === 'width' || key === 'height') && (
        <Box
          sx={{
            width: 170,
            flexShrink: 0,
            display: { xs: 'none', sm: 'block' },
          }}
        />
      )}
    </Stack>
  );

  const setSpec = (i, changes) =>
    set({
      specs: form.specs.map((x, j) => (j === i ? { ...x, ...changes } : x)),
    });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Size and weight
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The packed product. Used for delivery and shown under Specifications.
        </Typography>
        <Stack spacing={1.5}>
          {measure('length', 'Length')}
          {measure('width', 'Width')}
          {measure('height', 'Height')}
          {measure('weight', 'Weight')}
        </Stack>
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2">Optional details</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Anything else shoppers should know, such as material, power or what’s
          in the box.
        </Typography>
        <Stack spacing={1.5}>
          {form.specs.map((x, i) => (
            <Stack
              key={i}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ sm: 'center' }}
              data-testid={`spec-${i}`}
            >
              <TextField
                label="Detail"
                placeholder="e.g. Material"
                value={x.label}
                onChange={(e) => setSpec(i, { label: e.target.value })}
                inputProps={{
                  maxLength: 60,
                  'aria-label': `Detail ${i + 1} name`,
                }}
                sx={{ width: { sm: 220 }, flexShrink: 0 }}
              />
              <TextField
                label="Value"
                placeholder="e.g. Solid oak"
                value={x.value}
                onChange={(e) => setSpec(i, { value: e.target.value })}
                inputProps={{
                  maxLength: 200,
                  'aria-label': `Detail ${i + 1} value`,
                }}
                fullWidth
              />
              <Tooltip title="Remove detail">
                <IconButton
                  aria-label={`Remove detail ${i + 1}`}
                  onClick={() =>
                    set({ specs: form.specs.filter((_, j) => j !== i) })
                  }
                >
                  <FiX />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
        {form.specs.length < 30 && (
          <Button
            startIcon={<FiPlus />}
            onClick={() =>
              set({ specs: [...form.specs, { label: '', value: '' }] })
            }
            sx={{ mt: form.specs.length ? 1.5 : 0 }}
          >
            Add detail
          </Button>
        )}
      </Box>
      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
    </Stack>
  );
};

ProductInformation.propTypes = {
  form: PropTypes.object.isRequired,
  set: PropTypes.func.isRequired,
  error: PropTypes.string,
};

export default ProductInformation;
