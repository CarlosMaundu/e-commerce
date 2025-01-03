// src/components/profile/ManageCategoryTab.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import {
  createCategoryThunk,
  updateCategoryThunk,
  deleteCategoryThunk,
} from '../../redux/categoriesSlice';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Notification from '../../notification/notification';

const ManageCategoryTab = () => {
  const dispatch = useDispatch();
  const { categories, loading, error } = useSelector(
    (state) => state.categories
  );

  const [formData, setFormData] = useState({
    name: '',
    image: '',
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name.trim()) {
      setNotification({
        open: true,
        message: 'Category name is required.',
        severity: 'error',
      });
      return;
    }

    if (!formData.image.trim()) {
      setNotification({
        open: true,
        message: 'Category image URL is required.',
        severity: 'error',
      });
      return;
    }

    const categoryData = {
      name: formData.name,
      image: formData.image,
    };

    try {
      if (isEditMode && editCategoryId) {
        await dispatch(
          updateCategoryThunk({ id: editCategoryId, updateData: categoryData })
        ).unwrap();
        setNotification({
          open: true,
          message: 'Category updated successfully.',
          severity: 'success',
        });
      } else {
        await dispatch(createCategoryThunk(categoryData)).unwrap();
        setNotification({
          open: true,
          message: 'Category created successfully.',
          severity: 'success',
        });
      }
      // Reset form
      setFormData({ name: '', image: '' });
      setIsEditMode(false);
      setEditCategoryId(null);
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
    setFormData({ name: '', image: '' });
    setIsEditMode(false);
    setEditCategoryId(null);
  };

  // Handle edit button click
  const handleEditClick = (category) => {
    setIsEditMode(true);
    setEditCategoryId(category.id);
    setFormData({
      name: category.name,
      image: category.image,
    });
  };

  // Handle delete button click
  const handleDeleteClick = (category) => {
    setSelectedCategory(category);
    setConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedCategory) {
      try {
        await dispatch(deleteCategoryThunk(selectedCategory.id)).unwrap();
        setNotification({
          open: true,
          message: 'Category deleted successfully.',
          severity: 'success',
        });
      } catch (err) {
        setNotification({
          open: true,
          message: `Failed to delete category: ${err}`,
          severity: 'error',
        });
      } finally {
        setConfirmationOpen(false);
        setSelectedCategory(null);
      }
    }
  };

  const handleCancelDelete = () => {
    setConfirmationOpen(false);
    setSelectedCategory(null);
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* Categories Table */}
      <Card sx={{ p: 2, mb: 2, boxShadow: 1, borderRadius: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6">Categories</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsEditMode(false)}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
            }}
          >
            Add Category
          </Button>
        </Box>

        {loading ? (
          // Skeleton placeholders
          <Box>
            {Array.from(new Array(3)).map((_, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" height={50} />
              </Box>
            ))}
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : categories.length === 0 ? (
          <Typography>No categories found.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Thumbnail</th>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} style={tableRowStyle}>
                    {/* Thumbnail */}
                    <td style={tableCellStyle}>
                      <img
                        src={category.image}
                        alt={category.name}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    </td>
                    {/* Name */}
                    <td style={tableCellStyle}>{category.name}</td>
                    {/* Actions */}
                    <td style={tableCellStyle}>
                      <IconButton
                        color="primary"
                        onClick={() => handleEditClick(category)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteClick(category)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Card>

      {/* Add/Edit Category Form */}
      <Card sx={{ p: 2, boxShadow: 1, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {isEditMode ? 'Edit Category' : 'Add Category'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                name="name"
                variant="outlined"
                fullWidth
                value={formData.name}
                onChange={handleChange}
                size="small"
              />
            </Grid>
            {/* Image URL */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Image URL"
                name="image"
                variant="outlined"
                fullWidth
                value={formData.image}
                onChange={handleChange}
                size="small"
              />
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
              {isEditMode ? 'Update Category' : 'Save Category'}
            </Button>
          </Box>
        </form>
      </Card>

      {/* Confirmation Dialog for Delete */}
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to delete the category "${selectedCategory?.name}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

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

// Styles for table
const tableHeaderStyle = {
  padding: '8px',
  borderBottom: '1px solid #ddd',
  textAlign: 'left',
};

const tableCellStyle = {
  padding: '8px',
  borderBottom: '1px solid #ddd',
};

const tableRowStyle = {
  transition: 'background-color 0.3s',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
};

export default ManageCategoryTab;
