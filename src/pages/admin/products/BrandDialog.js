// src/pages/admin/products/BrandDialog.js — add or edit a brand and its logo.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { adminCatalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import ImageField from '../../../components/admin/ImageField';

const BrandDialog = ({ open, brand, initialName = '', onClose, onSaved }) => {
  const notify = useNotify();
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
      maxWidth="sm"
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
            <ImageField
              label="Logo"
              value={logo}
              onChange={setLogo}
              onUploading={setUploading}
              contain
              hint="PNG with a transparent background works best (JPG, WebP or GIF also work). Up to 5 MB."
            />
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
