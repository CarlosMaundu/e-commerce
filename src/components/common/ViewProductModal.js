// src/components/common/ViewProductModal.js

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Box,
} from '@mui/material';
import { FiEdit } from 'react-icons/fi';
import { useTheme } from '@mui/material/styles';

const ViewProductModal = ({ open, onClose, product, onEdit }) => {
  const theme = useTheme();
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);

  // If no product, return null (still safe to call useState unconditionally above)
  if (!product) return null;

  const images = product.images || [];

  const handleChangeImage = (idx) => {
    setSelectedImgIndex(idx);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="view-product-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <DialogTitle id="view-product-dialog-title" sx={{ fontWeight: 700 }}>
        Product Details
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ backgroundColor: theme.palette.background.default }}
      >
        <Grid container spacing={2}>
          {/* Main Image */}
          <Grid item xs={12} sm={5}>
            <Box
              component="img"
              src={images[selectedImgIndex] || ''}
              alt={product.title}
              sx={{
                width: '100%',
                height: 'auto',
                borderRadius: theme.shape.borderRadius, // Updated to use theme's borderRadius
                objectFit: 'cover',
              }}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/150';
              }}
            />
            {/* Thumbnails if multiple images */}
            {images.length > 1 && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2, overflowX: 'auto' }}>
                {images.map((img, idx) => (
                  <Box
                    key={idx}
                    component="img"
                    src={img}
                    alt={`thumb-${idx}`}
                    onClick={() => handleChangeImage(idx)}
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: theme.shape.borderRadius, // Updated to use theme's borderRadius
                      objectFit: 'cover',
                      cursor: 'pointer',
                      border:
                        idx === selectedImgIndex
                          ? `2px solid ${theme.palette.primary.main}`
                          : '2px solid transparent',
                    }}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/60';
                    }}
                  />
                ))}
              </Box>
            )}
          </Grid>

          {/* Product Info */}
          <Grid item xs={12} sm={7}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                color: theme.palette.text.primary,
                fontWeight: 700,
              }}
            >
              {product.title}
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              sx={{ color: theme.palette.text.secondary }}
            >
              <strong>Category:</strong> {product.category?.name || 'N/A'}
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              sx={{ color: theme.palette.text.secondary }}
            >
              <strong>Price:</strong> ${product.price}
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              sx={{ color: theme.palette.text.secondary }}
            >
              <strong>Stock Status:</strong>{' '}
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              sx={{ color: theme.palette.text.secondary }}
            >
              <strong>Description:</strong>{' '}
              {product.description || 'No description provided.'}
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          startIcon={<FiEdit />}
          onClick={() => {
            onEdit(product);
          }}
          color="primary"
          variant="contained"
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Edit Product
        </Button>
        <Button
          onClick={onClose}
          color="secondary"
          variant="outlined"
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViewProductModal;
