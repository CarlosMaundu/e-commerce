// src/pages/admin/products/VariationsEditor.js — Aurora-style variations:
// each option (Color, Size, Fabric material…) is a card with a list of values;
// every value can be linked to product photos, which shoppers see when they
// pick it.
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiLink, FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import { isColorAttribute, swatchFor } from '../../../utils/colors';

export const OPTION_NAMES = [
  'Color',
  'Size',
  'Fabric material',
  'Material',
  'Style',
  'Shade',
  'Scent',
  'Strap',
  'Capacity',
];

/** Pick which product photos belong to one value; upload new ones too. */
const LinkImagesDialog = ({
  open,
  title,
  images,
  chosen,
  onChange,
  onClose,
  onUpload,
  uploading,
}) => {
  const fileRef = useRef(null);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shoppers see these photos first when they choose this option.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
            gap: 1.5,
          }}
        >
          {images.map((src, i) => {
            const on = chosen.includes(src);
            return (
              <Box
                key={src}
                component="button"
                type="button"
                aria-pressed={on}
                aria-label={`Photo ${i + 1}`}
                onClick={() =>
                  onChange(
                    on ? chosen.filter((s) => s !== src) : [...chosen, src]
                  )
                }
                sx={{
                  position: 'relative',
                  p: 0,
                  aspectRatio: '1 / 1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: 2,
                  borderColor: on ? 'primary.main' : 'divider',
                  bgcolor: 'transparent',
                }}
              >
                <Box
                  component="img"
                  src={src}
                  alt=""
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: on ? 1 : 0.7,
                  }}
                />
                <Checkbox
                  checked={on}
                  size="small"
                  tabIndex={-1}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'background.paper',
                    p: 0.25,
                    borderRadius: '6px',
                    pointerEvents: 'none',
                  }}
                />
              </Box>
            );
          })}
          <Box
            component="button"
            type="button"
            onClick={() => fileRef.current?.click()}
            sx={{
              aspectRatio: '1 / 1',
              borderRadius: '8px',
              border: '2px dashed',
              borderColor: 'divider',
              bgcolor: 'background.neutral',
              cursor: 'pointer',
              color: 'text.secondary',
              display: 'grid',
              placeItems: 'center',
              font: 'inherit',
            }}
          >
            <Stack alignItems="center" spacing={0.5}>
              <FiUpload />
              <span>{uploading ? 'Uploading…' : 'Upload'}</span>
            </Stack>
          </Box>
        </Box>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Upload photos for this option"
          onChange={async (e) => {
            const urls = await onUpload(e.target.files);
            e.target.value = '';
            if (urls.length) onChange([...chosen, ...urls]);
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {chosen.length} selected
        </Typography>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

LinkImagesDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  images: PropTypes.array.isRequired,
  chosen: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpload: PropTypes.func.isRequired,
  uploading: PropTypes.bool,
};

const ValueRow = ({
  attribute,
  value,
  index,
  linked,
  onRename,
  onRemove,
  onLink,
}) => {
  const colour = isColorAttribute(attribute.name);
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      {colour && (
        <Box
          aria-hidden
          sx={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            background: swatchFor(value),
            border: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        />
      )}
      <TextField
        size="small"
        value={value}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Value"
        inputProps={{
          'aria-label': `${attribute.name || 'Option'} value ${index + 1}`,
        }}
        sx={{ flex: 1 }}
      />
      <Button
        size="small"
        onClick={onLink}
        startIcon={<FiLink />}
        disabled={!value.trim()}
        aria-label={`Link images to ${value || 'this value'}`}
        sx={{
          whiteSpace: 'nowrap',
          color: linked ? 'primary.main' : 'text.secondary',
          minWidth: 150,
        }}
      >
        {linked} image{linked === 1 ? '' : 's'} linked
      </Button>
      <Tooltip title="Remove value">
        <IconButton
          size="small"
          aria-label={`Remove ${value || 'value'}`}
          onClick={onRemove}
        >
          <FiX />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

ValueRow.propTypes = {
  attribute: PropTypes.object.isRequired,
  value: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  linked: PropTypes.number.isRequired,
  onRename: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onLink: PropTypes.func.isRequired,
};

/**
 * attributes: [{ name, values }]; links: { [name]: { [value]: urls[] } }.
 * Values are edited as drafts ("" allowed while typing) and cleaned on save.
 */
const VariationsEditor = ({
  attributes,
  onChange,
  links,
  onLinksChange,
  images,
  onUpload,
  uploading,
}) => {
  const [linking, setLinking] = useState(null); // { name, value }

  const setAttr = (i, changes) =>
    onChange(attributes.map((a, j) => (j === i ? { ...a, ...changes } : a)));

  const renameValue = (i, k, next) => {
    const a = attributes[i];
    const old = a.values[k];
    if (next === old) return;
    setAttr(i, { values: a.values.map((v, j) => (j === k ? next : v)) });
    if (links[a.name]?.[old]) {
      const byValue = { ...links[a.name], [next]: links[a.name][old] };
      delete byValue[old];
      onLinksChange({ ...links, [a.name]: byValue });
    }
  };

  const renameOption = (i, name) => {
    const old = attributes[i].name;
    if (name === old) return; // the field reports its value on mount
    setAttr(i, { name });
    if (links[old]) {
      const next = { ...links, [name]: links[old] };
      delete next[old];
      onLinksChange(next);
    }
  };

  const chosen = linking ? links[linking.name]?.[linking.value] || [] : [];

  return (
    <Stack spacing={2}>
      {attributes.map((a, i) => (
        <Box
          key={i}
          sx={{
            bgcolor: 'background.neutral',
            borderRadius: 1,
            p: { xs: 2, md: 3 },
          }}
          data-testid={`variation-${i}`}
        >
          <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              Option {i + 1}
            </Typography>
            <Tooltip title="Remove option">
              <IconButton
                aria-label={`Remove option ${a.name || i + 1}`}
                onClick={() => onChange(attributes.filter((_, j) => j !== i))}
              >
                <FiTrash2 />
              </IconButton>
            </Tooltip>
          </Stack>
          <Autocomplete
            freeSolo
            options={OPTION_NAMES.filter(
              (s) => !attributes.some((x, j) => j !== i && x.name === s)
            )}
            value={a.name}
            onInputChange={(_, name) => renameOption(i, name)}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Option name"
                placeholder="e.g. Color"
              />
            )}
          />
          <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1.25 }}>
            Values
          </Typography>
          <Stack spacing={1.25}>
            {a.values.map((v, k) => (
              <ValueRow
                key={k}
                attribute={a}
                value={v}
                index={k}
                linked={(links[a.name]?.[v] || []).length}
                onRename={(next) => renameValue(i, k, next)}
                onRemove={() =>
                  setAttr(i, { values: a.values.filter((_, j) => j !== k) })
                }
                onLink={() => setLinking({ name: a.name, value: v })}
              />
            ))}
          </Stack>
          <Button
            size="small"
            startIcon={<FiPlus />}
            onClick={() => setAttr(i, { values: [...a.values, ''] })}
            sx={{ mt: 1.5 }}
          >
            Add another value
          </Button>
        </Box>
      ))}
      {attributes.length < 5 && (
        <Button
          startIcon={<FiPlus />}
          onClick={() => onChange([...attributes, { name: '', values: [''] }])}
          sx={{ alignSelf: 'flex-start' }}
        >
          Add another option
        </Button>
      )}
      <LinkImagesDialog
        open={Boolean(linking)}
        title={linking ? `Photos for ${linking.name}: ${linking.value}` : ''}
        images={images}
        chosen={chosen}
        uploading={uploading}
        onUpload={onUpload}
        onChange={(urls) =>
          onLinksChange({
            ...links,
            [linking.name]: {
              ...(links[linking.name] || {}),
              [linking.value]: urls,
            },
          })
        }
        onClose={() => setLinking(null)}
      />
    </Stack>
  );
};

VariationsEditor.propTypes = {
  attributes: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  links: PropTypes.object.isRequired,
  onLinksChange: PropTypes.func.isRequired,
  images: PropTypes.array.isRequired,
  onUpload: PropTypes.func.isRequired,
  uploading: PropTypes.bool,
};

export default VariationsEditor;
