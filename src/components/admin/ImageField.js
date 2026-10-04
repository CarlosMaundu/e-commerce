// src/components/admin/ImageField.js — one image (category picture, brand
// logo): preview, upload, replace, remove.
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Stack, Typography } from '@mui/material';
import { FiImage, FiUpload, FiX } from 'react-icons/fi';
import { adminCatalog } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';

const ImageField = ({
  label,
  value,
  onChange,
  hint,
  contain = false,
  onUploading,
}) => {
  const notify = useNotify();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    onUploading?.(true);
    try {
      const { url } = await adminCatalog.uploadFile(file);
      onChange(url);
    } catch (error) {
      notify.error(error, 'We couldn’t upload that image.');
    } finally {
      setUploading(false);
      onUploading?.(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 160,
            height: 96,
            borderRadius: '8px',
            bgcolor: 'background.neutral',
            border: 1,
            borderColor: 'divider',
            display: 'grid',
            placeItems: 'center',
            color: 'text.disabled',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {value ? (
            <Box
              component="img"
              src={value}
              alt={label}
              sx={
                contain
                  ? { maxWidth: '80%', maxHeight: '70%' }
                  : { width: '100%', height: '100%', objectFit: 'cover' }
              }
            />
          ) : (
            <FiImage size={24} />
          )}
        </Box>
        <Stack spacing={1} className="image-field-actions">
          <Button
            size="small"
            variant="outlined"
            startIcon={<FiUpload />}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button
              size="small"
              color="error"
              startIcon={<FiX />}
              onClick={() => onChange('')}
            >
              Remove
            </Button>
          )}
        </Stack>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          aria-label={`${label} file`}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </Stack>
      {hint && (
        <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
};

ImageField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  hint: PropTypes.string,
  contain: PropTypes.bool,
  onUploading: PropTypes.func,
};

export default ImageField;
