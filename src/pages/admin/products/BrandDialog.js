// src/pages/admin/products/BrandDialog.js — add or edit a brand and its logo.
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiImage, FiUpload, FiX } from 'react-icons/fi';
import { adminCatalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';

const BrandDialog = ({ open, brand, initialName = '', onClose, onSaved }) => {
  const notify = useNotify();
  const fileRef = useRef(null);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(brand?.name || initialName);
      setLogo(brand?.logo || '');
    }
  }, [open, brand, initialName]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await adminCatalog.uploadFile(file);
      setLogo(url);
    } catch (error) {
      notify.error(error, 'We couldn’t upload that logo.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = brand
        ? await adminCatalog.updateBrand(brand.id, { name: name.trim(), logo })
        : await adminCatalog.createBrand({ name: name.trim(), logo });
      notify.success(brand ? 'Brand updated.' : 'Brand added.');
      onSaved(saved);
    } catch (error) {
      notify.error(error, 'We couldn’t save the brand.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={save}>
        <DialogTitle>{brand ? 'Edit brand' : 'Add brand'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Brand name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              fullWidth
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Logo
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 160,
                    height: 72,
                    borderRadius: '8px',
                    bgcolor: 'background.neutral',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'text.disabled',
                    overflow: 'hidden',
                  }}
                >
                  {logo ? (
                    <Box
                      component="img"
                      src={logo}
                      alt={`${name} logo`}
                      sx={{ maxWidth: '90%', maxHeight: '80%' }}
                    />
                  ) : (
                    <FiImage size={24} />
                  )}
                </Box>
                <Stack spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FiUpload />}
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading…' : logo ? 'Replace' : 'Upload'}
                  </Button>
                  {logo && (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<FiX />}
                      onClick={() => setLogo('')}
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
                  aria-label="Logo file"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </Stack>
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                PNG with a transparent background works best. Up to 5 MB.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || uploading || !name.trim()}
          >
            {busy ? 'Saving…' : 'Save brand'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

BrandDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  brand: PropTypes.object,
  initialName: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default BrandDialog;
