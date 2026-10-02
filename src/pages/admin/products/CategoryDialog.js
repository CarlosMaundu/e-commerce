// src/pages/admin/products/CategoryDialog.js — add or edit a category with
// its image and subcategories.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Button,
  Chip,
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

const CategoryDialog = ({ open, category, onClose, onSaved }) => {
  const notify = useNotify();
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name || '');
      setImage(category?.image || '');
      setSubcategories((category?.subcategories || []).map((s) => s.name));
    }
  }, [open, category]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name, image, subcategories };
      const saved = category
        ? await adminCatalog.updateCategory(category.id, body)
        : await adminCatalog.createCategory(body);
      notify.success(category ? 'Category updated.' : 'Category added.');
      onSaved(saved);
    } catch (error) {
      notify.error(error, 'We couldn’t save the category.');
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
        <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              fullWidth
            />
            <ImageField
              label="Image"
              value={image}
              onChange={setImage}
              onUploading={setUploading}
              hint="Shown in Curated picks on the home page. Landscape photos work best."
            />
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={subcategories}
              onChange={(_, values) =>
                setSubcategories([
                  ...new Set(values.map((v) => v.trim()).filter(Boolean)),
                ])
              }
              renderTags={(values, getTagProps) =>
                values.map((v, i) => (
                  <Chip
                    {...getTagProps({ index: i })}
                    key={v}
                    size="small"
                    label={v}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Subcategories"
                  placeholder={
                    subcategories.length ? '' : 'Type a name and press Enter'
                  }
                  helperText="A subcategory that still has products can’t be removed."
                />
              )}
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
            {busy ? 'Saving…' : 'Save category'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

CategoryDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  category: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default CategoryDialog;
