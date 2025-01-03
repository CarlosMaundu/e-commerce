import React from 'react';
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

const ViewProductModal = ({ open, onClose, product, onEdit }) => {
  if (!product) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="view-product-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <DialogTitle id="view-product-dialog-title">Product Details</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {/* Product Image */}
          <Grid item xs={12} sm={4}>
            <Box
              component="img"
              src={product.images[0]}
              alt={product.title}
              sx={{
                width: '100%',
                height: 'auto',
                borderRadius: 2,
                objectFit: 'cover',
              }}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/150';
              }}
            />
          </Grid>

          {/* Product Information */}
          <Grid item xs={12} sm={8}>
            <Typography variant="h6" gutterBottom>
              {product.title}
            </Typography>
            <Typography variant="body1" gutterBottom>
              <strong>Category:</strong> {product.category?.name || 'N/A'}
            </Typography>
            <Typography variant="body1" gutterBottom>
              <strong>Price:</strong> ${product.price}
            </Typography>
            <Typography variant="body1" gutterBottom>
              <strong>Stock Status:</strong>{' '}
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </Typography>
            <Typography variant="body1" gutterBottom>
              <strong>Description:</strong>{' '}
              {product.description || 'No description provided.'}
            </Typography>
            {/* Add more product details as needed */}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<FiEdit />}
          onClick={() => {
            onEdit(product);
            onClose();
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
