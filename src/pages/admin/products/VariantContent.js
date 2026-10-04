// src/pages/admin/products/VariantContent.js — optional variant-specific
// content: when switched on, each variant can have its own description and
// its own specification rows (e.g. the Pro model's camera). Shoppers see
// them when they pick that variant; empty fields fall back to the product's.
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import RichTextEditor from '../../../components/admin/RichTextEditor';
import { Pill } from '../../../components/admin/DataTable';

const label = (options) => Object.values(options).join(' / ');

const SpecRows = ({ rows, onChange }) => (
  <Stack spacing={1.5}>
    {rows.map((x, i) => (
      <Stack
        key={i}
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
      >
        <TextField
          label="Detail"
          placeholder="e.g. Camera"
          value={x.label}
          onChange={(e) =>
            onChange(
              rows.map((r, j) =>
                j === i ? { ...r, label: e.target.value } : r
              )
            )
          }
          inputProps={{
            maxLength: 60,
            'aria-label': `Variant detail ${i + 1} name`,
          }}
          sx={{ width: { sm: 220 }, flexShrink: 0 }}
        />
        <TextField
          label="Value"
          placeholder="e.g. 48 MP main camera"
          value={x.value}
          onChange={(e) =>
            onChange(
              rows.map((r, j) =>
                j === i ? { ...r, value: e.target.value } : r
              )
            )
          }
          inputProps={{
            maxLength: 200,
            'aria-label': `Variant detail ${i + 1} value`,
          }}
          fullWidth
        />
        <Tooltip title="Remove detail">
          <IconButton
            aria-label={`Remove variant detail ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <FiX />
          </IconButton>
        </Tooltip>
      </Stack>
    ))}
    {rows.length < 30 && (
      <Button
        startIcon={<FiPlus />}
        onClick={() => onChange([...rows, { label: '', value: '' }])}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add detail
      </Button>
    )}
  </Stack>
);
SpecRows.propTypes = {
  rows: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

const VariantContent = ({
  enabled,
  onToggle,
  variants,
  onChange,
  disabled,
}) => {
  const [editing, setEditing] = useState(null); // variant index
  const [draft, setDraft] = useState(null);

  const open = (i) => {
    setEditing(i);
    setDraft({
      description: variants[i].description || '',
      specs: (variants[i].specs || []).map((x) => ({ ...x })),
    });
  };
  const save = () => {
    onChange(
      variants.map((v, i) =>
        i === editing
          ? {
              ...v,
              description: draft.description,
              specs: draft.specs.filter(
                (x) => x.label.trim() && x.value.trim()
              ),
            }
          : v
      )
    );
    setEditing(null);
  };

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2.5 }}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={disabled}
          />
        }
        label={
          <Box>
            <Typography sx={{ fontWeight: 600 }}>
              Variant-specific description and specifications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Optional. Give a variant its own description or spec rows (for
              example a Pro model’s camera). Anything left empty uses the
              product’s.
            </Typography>
          </Box>
        }
        sx={{
          alignItems: 'flex-start',
          m: 0,
          gap: 1.5,
          '& .MuiSwitch-root': { mt: -0.5 },
        }}
      />
      {enabled && (
        <Stack spacing={1} sx={{ mt: 2.5 }} data-testid="variant-content">
          {variants.map((v, i) => {
            const own = Boolean(v.description && v.description.trim());
            const specCount = (v.specs || []).length;
            return (
              <Stack
                key={label(v.options)}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderRadius: '8px',
                  bgcolor: 'background.neutral',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
                  noWrap
                >
                  {label(v.options)}
                </Typography>
                <Pill
                  label={own ? 'Own description' : 'Product description'}
                  tone={own ? 'info' : 'default'}
                />
                {specCount > 0 && (
                  <Pill
                    label={`${specCount} spec${specCount === 1 ? '' : 's'}`}
                    tone="success"
                  />
                )}
                <Button
                  size="small"
                  startIcon={<FiEdit2 />}
                  onClick={() => open(i)}
                  disabled={disabled}
                  aria-label={`Edit content for ${label(v.options)}`}
                >
                  Edit
                </Button>
              </Stack>
            );
          })}
          {!variants.length && (
            <Typography variant="body2" color="text.secondary">
              Add variations above to give each variant its own content.
            </Typography>
          )}
        </Stack>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editing !== null &&
            `Content for ${label(variants[editing].options)}`}
        </DialogTitle>
        <DialogContent dividers>
          {draft && (
            <Stack spacing={3}>
              <RichTextEditor
                label="Description for this variant"
                value={draft.description}
                onChange={(description) =>
                  setDraft((d) => ({ ...d, description }))
                }
                placeholder="Leave empty to use the product’s description."
              />
              <Box>
                <Typography variant="subtitle2">
                  Specifications for this variant
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  A row with the same name as one of the product’s replaces it;
                  new names are added.
                </Typography>
                <SpecRows
                  rows={draft.specs}
                  onChange={(specs) => setDraft((d) => ({ ...d, specs }))}
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

VariantContent.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  variants: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default VariantContent;
