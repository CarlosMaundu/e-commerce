// src/components/profile/ManageProductTab.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  IconButton,
  Card,
  ImageList,
  ImageListItem,
  ImageListItemBar,
} from '@mui/material';
import { FiTrash2, FiPlus } from 'react-icons/fi'; // Using better icons
import { useDispatch, useSelector } from 'react-redux';
import {
  createProductThunk,
  updateProductThunk,
  fetchProducts,
} from '../../redux/productsSlice';
import { fetchCategories } from '../../redux/categoriesSlice';
import Notification from '../../notification/notification';
import ConfirmationDialog from '../common/ConfirmationDialog';

const ManageProductTab = ({ currentProduct, navigateToManageProduct }) => {
  const dispatch = useDispatch();
  const { categories, loading: categoriesLoading } = useSelector(
    (state) => state.categories
  );

  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    categoryId: '',
    images: [''],
  });

  const [errors, setErrors] = useState({});
  const [imagePreviews, setImagePreviews] = useState([]);

  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const isEditMode = Boolean(currentProduct);
  const editProductId = currentProduct?.id || null;

  // Fetch categories on mount
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Pre-populate form if editing
  useEffect(() => {
    if (isEditMode) {
      setFormData({
        title: currentProduct.title || '',
        price: currentProduct.price || '',
        description: currentProduct.description || '',
        categoryId: currentProduct.category?.id || '', // Corrected categoryId
        images: currentProduct.images.length > 0 ? currentProduct.images : [''],
      });
    } else {
      setFormData({
        title: '',
        price: '',
        description: '',
        categoryId: '',
        images: [''],
      });
    }
  }, [isEditMode, currentProduct]);

  // Generate image previews
  useEffect(() => {
    const validImages = formData.images.filter((url) => url.trim() !== '');
    setImagePreviews(validImages);
  }, [formData.images]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: '' });
  };

  // Handle image URL changes
  const handleImageChange = (index, value) => {
    const updatedImages = [...formData.images];
    updatedImages[index] = value;
    setFormData({ ...formData, images: updatedImages });
  };

  // Add new image field
  const handleAddImage = () => {
    setFormData({ ...formData, images: [...formData.images, ''] });
  };

  // Delete image field
  const handleDeleteImage = (index) => {
    const updatedImages = [...formData.images];
    updatedImages.splice(index, 1);
    setFormData({ ...formData, images: updatedImages });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.price || isNaN(formData.price))
      newErrors.price = 'Valid price is required';
    if (!formData.description.trim())
      newErrors.description = 'Description is required';
    if (!formData.categoryId)
      newErrors.categoryId = 'Category selection is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const productData = {
      title: formData.title,
      price: Number(formData.price),
      description: formData.description,
      categoryId: formData.categoryId,
      images: formData.images.filter((url) => url.trim() !== ''),
      inStock: true, // Assuming new products are in stock by default
    };

    try {
      if (isEditMode && editProductId) {
        await dispatch(
          updateProductThunk({ id: editProductId, updateData: productData })
        ).unwrap();
        setNotification({
          open: true,
          message: 'Product updated successfully.',
          severity: 'success',
        });
      } else {
        await dispatch(createProductThunk(productData)).unwrap();
        setNotification({
          open: true,
          message: 'Product created successfully.',
          severity: 'success',
        });
      }
      // Reset form
      setFormData({
        title: '',
        price: '',
        description: '',
        categoryId: '',
        images: [''],
      });
      setErrors({});
      navigateToManageProduct(); // Navigate back to All Products tab
      // Optionally, refetch products
      dispatch(fetchProducts({ limit: 10, offset: 0 }));
    } catch (err) {
      setNotification({
        open: true,
        message: `Action failed: ${err}`,
        severity: 'error',
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({
      title: '',
      price: '',
      description: '',
      categoryId: '',
      images: [''],
    });
    setErrors({});
    navigateToManageProduct(); // Navigate back to All Products tab
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* Add/Edit Product Form */}
      <Card sx={{ p: 2, boxShadow: 1, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontSize: '0.875rem' }}>
          {isEditMode ? 'Edit Product' : 'Add Product'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Left Column */}
            <Grid item xs={12} md={6}>
              <Grid container spacing={2}>
                {/* Title */}
                <Grid item xs={12}>
                  <TextField
                    label="Title"
                    name="title"
                    variant="outlined"
                    fullWidth
                    value={formData.title}
                    onChange={handleChange}
                    error={!!errors.title}
                    helperText={errors.title}
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Grid>
                {/* Price */}
                <Grid item xs={12}>
                  <TextField
                    label="Price"
                    name="price"
                    variant="outlined"
                    fullWidth
                    value={formData.price}
                    onChange={handleChange}
                    error={!!errors.price}
                    helperText={errors.price}
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: '0.01' }}
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Grid>
                {/* Description */}
                <Grid item xs={12}>
                  <TextField
                    label="Description"
                    name="description"
                    variant="outlined"
                    fullWidth
                    multiline
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                    error={!!errors.description}
                    helperText={errors.description}
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Grid>
                {/* Category */}
                <Grid item xs={12}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel
                      id="category-select-label"
                      sx={{ fontSize: '0.75rem' }}
                    >
                      Category
                    </InputLabel>
                    <Select
                      labelId="category-select-label"
                      label="Category"
                      name="categoryId"
                      value={formData.categoryId}
                      onChange={handleChange}
                      error={!!errors.categoryId}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.categoryId && (
                      <Typography color="error" variant="caption">
                        {errors.categoryId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                {/* Images */}
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontSize: '0.75rem' }}
                  >
                    Images
                  </Typography>
                  {formData.images.map((img, index) => (
                    <Box
                      key={index}
                      sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                    >
                      <TextField
                        label={`Image URL ${index + 1}`}
                        variant="outlined"
                        fullWidth
                        value={img}
                        onChange={(e) =>
                          handleImageChange(index, e.target.value)
                        }
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                      {formData.images.length > 1 && (
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteImage(index)}
                          sx={{ ml: 1 }}
                          size="small"
                        >
                          <FiTrash2 size={16} />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<FiPlus />}
                    onClick={handleAddImage}
                    size="small"
                    sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Add Image
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            {/* Right Column - Image Previews */}
            <Grid item xs={12} md={6}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontSize: '0.75rem' }}
              >
                Image Previews
              </Typography>
              {imagePreviews.length === 0 ? (
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  No images to preview.
                </Typography>
              ) : (
                <ImageList cols={3} gap={8}>
                  {imagePreviews.map((url, index) => (
                    <ImageListItem key={index}>
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        loading="lazy"
                        style={{ objectFit: 'cover', height: 100 }}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/100';
                        }}
                      />
                      <ImageListItemBar
                        actionIcon={
                          <IconButton
                            sx={{ color: 'rgba(255, 255, 255, 0.54)' }}
                            onClick={() => handleDeleteImage(index)}
                            size="small"
                          >
                            <FiTrash2 size={16} />
                          </IconButton>
                        }
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
              )}
            </Grid>
          </Grid>

          {/* Buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mt: 3,
              gap: 2,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Button
              variant="outlined"
              onClick={handleCancel}
              sx={{
                textTransform: 'none',
                color: 'error.main',
                borderColor: 'error.main',
                fontSize: '0.75rem',
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              sx={{
                textTransform: 'none',
                backgroundColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                fontSize: '0.75rem',
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              {isEditMode ? 'Update Product' : 'Save Product'}
            </Button>
          </Box>
        </form>
      </Card>

      {/* Notification */}
      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </Box>
  );
};

export default ManageProductTab;
