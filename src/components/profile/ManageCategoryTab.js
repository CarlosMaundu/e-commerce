// src/components/profile/ManageCategoryTab.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Skeleton,
  LinearProgress,
  Checkbox,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { FiTrash2, FiEdit } from 'react-icons/fi';
import AddIcon from '@mui/icons-material/Add';
import { useDispatch, useSelector } from 'react-redux';
import {
  createCategoryThunk,
  updateCategoryThunk,
  deleteCategoryThunk,
  fetchCategories,
} from '../../redux/categoriesSlice';
import { uploadFileThunk } from '../../redux/fileSlice';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Notification from '../../notification/notification';
import placeholderImage from '../../images/placeholder.jpg';

const tableHeaderStyle = {
  fontSize: '0.75rem',
  fontWeight: 'bold',
  padding: '8px', // for consistent row height
};

const tableCellStyle = {
  fontSize: '0.75rem',
  padding: '8px', // match row height from AllProductsTab
};

const uploadLabelStyle = {
  fontFamily: 'Roboto, Arial, sans-serif',
  fontSize: '0.875rem',
  color: '#6c757d',
  backgroundColor: '#fff',
  textAlign: 'center',
  borderRadius: '4px',
  width: '100%',
  minHeight: '100px',
  py: 0.7,
  px: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: '2px dashed #ccc',
  mx: 'auto',
};

const ManageCategoryTab = ({
  navigateToManageCategoryTab,
  navigateToManageProduct,
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { categories, loading, error } = useSelector(
    (state) => state.categories
  );

  // State for form: allowing multiple subcategories
  const [formData, setFormData] = useState({
    name: '',
    subcategories: [''], // start with one subcategory
    imageUrl: '',
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(false);
  const [uploadedFileDetails, setUploadedFileDetails] = useState(null);

  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Handles Category Name changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Add subcategory field
  const handleAddSubcategory = () => {
    setFormData((prev) => ({
      ...prev,
      subcategories: [...prev.subcategories, ''],
    }));
  };

  // Remove a subcategory field
  const handleRemoveSubcategory = (index) => {
    setFormData((prev) => {
      const updatedSubs = [...prev.subcategories];
      updatedSubs.splice(index, 1);
      return { ...prev, subcategories: updatedSubs };
    });
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validations
    if (!formData.name.trim()) {
      setNotification({
        open: true,
        message: 'Category name is required.',
        severity: 'error',
      });
      return;
    }
    if (!formData.imageUrl.trim()) {
      setNotification({
        open: true,
        message: 'Category image is required. Please upload an image.',
        severity: 'error',
      });
      return;
    }

    // Build category data with multiple subcategories
    const categoryData = {
      name: formData.name,
      image: formData.imageUrl,
      subcategories: formData.subcategories.filter((s) => s.trim() !== ''),
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
      dispatch(fetchCategories());
      // Reset form
      setFormData({ name: '', subcategories: [''], imageUrl: '' });
      setIsEditMode(false);
      setEditCategoryId(null);
      setUploadedFileDetails(null);
    } catch (err) {
      setNotification({
        open: true,
        message: `Action failed: ${err}`,
        severity: 'error',
      });
    }
  };

  // Cancel & Reset
  const handleCancel = () => {
    setFormData({ name: '', subcategories: [''], imageUrl: '' });
    setIsEditMode(false);
    setEditCategoryId(null);
    setNotification({ open: false, message: '', severity: '' });
    setUploadedFileDetails(null);
  };

  // Edit Category
  const handleEditClick = (category) => {
    setIsEditMode(true);
    setEditCategoryId(category.id);

    const scArr = Array.isArray(category.subcategories)
      ? category.subcategories
      : [];

    setFormData({
      name: category.name,
      subcategories: scArr.length ? scArr : [''],
      imageUrl: category.image || '',
    });

    setUploadedFileDetails({
      fileName: category.image,
      fileSize: '-',
      status: 'Loaded from existing category',
    });
  };

  // Single Delete
  const handleDeleteClick = (category) => {
    // sets up single deletion
    setSelectedCategories([category.id]);
    setConfirmationOpen(true);
  };

  // Bulk Selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = categories.map((cat) => cat.id);
      setSelectedCategories(allIds);
    } else {
      setSelectedCategories([]);
    }
  };

  const handleSelectCategory = (e, id) => {
    if (e.target.checked) {
      setSelectedCategories((prev) => [...prev, id]);
    } else {
      setSelectedCategories((prev) => prev.filter((cid) => cid !== id));
    }
  };

  // Confirm Deletion (Single or Bulk)
  const handleConfirmDelete = async () => {
    if (selectedCategories.length === 0) return;
    setIsDeleting(true);
    try {
      await Promise.all(
        selectedCategories.map((id) =>
          dispatch(deleteCategoryThunk(id)).unwrap()
        )
      );
      setNotification({
        open: true,
        message: 'Selected categories deleted successfully.',
        severity: 'success',
      });
      setSelectedCategories([]);
      dispatch(fetchCategories());
    } catch (err) {
      if (err && err.includes('404')) {
        setNotification({
          open: true,
          message: `One or more categories not found (404). Refreshing list.`,
          severity: 'error',
        });
        dispatch(fetchCategories());
      } else {
        setNotification({
          open: true,
          message: `Failed to delete categories: ${err}`,
          severity: 'error',
        });
      }
    } finally {
      setIsDeleting(false);
      setConfirmationOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmationOpen(false);
    setSelectedCategories([]);
  };

  // Upload
  const handleFileSelect = async (e) => {
    if (uploadError) return;
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadError(false);
    try {
      const result = await dispatch(
        uploadFileThunk({
          file,
          onProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          },
        })
      ).unwrap();

      setFormData((prev) => ({ ...prev, imageUrl: result.location }));
      setUploadedFileDetails({
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        status: 'File Successfully Uploaded',
      });
      setNotification({
        open: true,
        message: 'File uploaded successfully.',
        severity: 'success',
      });
    } catch (error) {
      setUploadError(true);
      setUploadedFileDetails({
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        status: 'File Failed to Upload',
      });
      setNotification({
        open: true,
        message: `File upload failed: ${error}`,
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Pagination
  const totalPages = Math.ceil(categories.length / rowsPerPage);
  const paginatedCategories = categories.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {/* LEFT COLUMN: Category Form */}
        <Grid item xs={12} md={5}>
          <Card sx={{ p: 2, boxShadow: 1, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {isEditMode ? 'Edit Category' : 'Add Category'}
              </Typography>

              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  {/* Category Name */}
                  <Grid item xs={12}>
                    <TextField
                      label="Category Name"
                      name="name"
                      variant="outlined"
                      fullWidth
                      size="small"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </Grid>

                  {/* Multiple Subcategories */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      Subcategories
                    </Typography>
                    {formData.subcategories.map((sub, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <TextField
                          variant="outlined"
                          size="small"
                          fullWidth
                          value={sub}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => {
                              const updatedSubs = [...prev.subcategories];
                              updatedSubs[index] = val;
                              return { ...prev, subcategories: updatedSubs };
                            });
                          }}
                        />
                        {formData.subcategories.length > 1 && (
                          <Tooltip title="Remove subcategory">
                            <IconButton
                              color="error"
                              onClick={() => handleRemoveSubcategory(index)}
                              size="small"
                            >
                              <FiTrash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    ))}
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddSubcategory}
                      size="small"
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.875rem',
                        mt: 1,
                      }}
                    >
                      Add another subcategory
                    </Button>
                  </Grid>

                  {/* Upload Section */}
                  <Grid item xs={12}>
                    <Box
                      sx={uploadLabelStyle}
                      onClick={() =>
                        document.getElementById('uploadFile').click()
                      }
                    >
                      {uploading ? (
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="body2" color="text.secondary">
                            Uploading...
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={uploadProgress}
                            sx={{ mt: 2, width: '100%' }}
                          />
                        </Box>
                      ) : (
                        <>
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            Upload file
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Drag &amp; Drop or{' '}
                            <span style={{ color: '#1976d2' }}>
                              Choose file
                            </span>{' '}
                            to upload
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 2 }}
                          >
                            PNG, JPG, SVG, WEBP, and GIF are allowed.
                          </Typography>
                        </>
                      )}
                    </Box>
                    <input
                      type="file"
                      id="uploadFile"
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </Grid>
                </Grid>

                {/* Uploaded File Details */}
                {uploadedFileDetails && (
                  <Box
                    sx={{
                      mt: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      p: 1,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.primary.main,
                          fontWeight: 'bold',
                        }}
                      >
                        {uploadedFileDetails.fileName}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'grey.600', fontSize: '0.75rem' }}
                      >
                        {uploadedFileDetails.fileSize}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: uploadedFileDetails.status.includes(
                            'Successfully'
                          )
                            ? 'success.main'
                            : 'error.main',
                        }}
                      >
                        {uploadedFileDetails.status}
                      </Typography>
                    </Box>
                    <IconButton
                      color="error"
                      onClick={() => {
                        setUploadedFileDetails(null);
                        setFormData((prev) => ({ ...prev, imageUrl: '' }));
                        setUploadError(false);
                      }}
                      size="small"
                    >
                      <FiTrash2 size={16} />
                    </IconButton>
                  </Box>
                )}

                {/* Actions */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'flex-end',
                    mt: 3,
                    gap: 2,
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleCancel}
                    sx={{
                      textTransform: 'capitalize',
                      color: 'error.main',
                      borderColor: 'error.main',
                      fontSize: '0.875rem',
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={uploading}
                    sx={{
                      textTransform: 'capitalize',
                      fontSize: '0.875rem',
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  >
                    {isEditMode ? 'Update Category' : 'Save Category'}
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT COLUMN: Categories List */}
        <Grid item xs={12} md={7}>
          <Card sx={{ p: 2, boxShadow: 1, borderRadius: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 2,
                }}
              >
                <Typography variant="h5">Categories</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCancel}
                  fullWidth={isMobile}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    height: '100%',
                  }}
                >
                  Add Category
                </Button>
              </Box>
            </Box>

            {/* Bulk delete bar */}
            {selectedCategories.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  mb: 2,
                  gap: 2,
                }}
              >
                <Typography sx={{ fontSize: '0.75rem' }}>
                  {selectedCategories.length} selected
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<FiTrash2 />}
                  onClick={() => setConfirmationOpen(true)}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    height: '100%',
                  }}
                >
                  Delete Selected
                </Button>
              </Box>
            )}

            {loading ? (
              <Box>
                {/* Skeletons for table rows */}
                {Array.from(new Array(5)).map((_, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Skeleton variant="rectangular" height={50} />
                  </Box>
                ))}

                {/* Skeleton for pagination controls */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 2,
                  }}
                >
                  {/* Skeleton for rows per page */}
                  <Skeleton variant="rectangular" width={120} height={40} />

                  {/* Skeleton for pagination */}
                  <Skeleton variant="rectangular" width={150} height={40} />
                </Box>
              </Box>
            ) : error ? (
              <Typography color="error">{error}</Typography>
            ) : categories.length === 0 ? (
              <Typography>No categories found.</Typography>
            ) : (
              <>
                {/* Table with pagination */}
                <TableContainer component={Paper}>
                  <Table aria-label="categories table">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" sx={{ padding: '8px' }}>
                          <Checkbox
                            checked={
                              categories.length > 0 &&
                              selectedCategories.length === categories.length
                            }
                            onChange={handleSelectAll}
                            inputProps={{
                              'aria-label': 'select all categories',
                            }}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={tableHeaderStyle}>Thumbnail</TableCell>
                        <TableCell sx={tableHeaderStyle}>Name</TableCell>
                        <TableCell sx={tableHeaderStyle}>Subcategory</TableCell>
                        <TableCell
                          sx={{ ...tableHeaderStyle, textAlign: 'center' }}
                        >
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedCategories.map((category) => (
                        <TableRow key={category.id} hover>
                          <TableCell padding="checkbox" sx={{ padding: '8px' }}>
                            <Checkbox
                              checked={selectedCategories.includes(category.id)}
                              onChange={(e) =>
                                handleSelectCategory(e, category.id)
                              }
                              inputProps={{
                                'aria-label': `select category ${category.name}`,
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell sx={tableCellStyle}>
                            <Box
                              component="img"
                              src={category.image}
                              alt={category.name}
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                e.target.src = placeholderImage;
                              }}
                            />
                          </TableCell>
                          <TableCell sx={tableCellStyle}>
                            {category.name}
                          </TableCell>
                          <TableCell sx={tableCellStyle}>
                            {Array.isArray(category.subcategories) &&
                            category.subcategories.length > 0
                              ? category.subcategories.join(', ')
                              : '-'}
                          </TableCell>
                          <TableCell
                            sx={{ ...tableCellStyle, textAlign: 'center' }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: 1,
                              }}
                            >
                              <Tooltip title="Edit">
                                <IconButton
                                  color="primary"
                                  onClick={() => handleEditClick(category)}
                                  size="small"
                                >
                                  <FiEdit size={16} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  color="error"
                                  onClick={() => handleDeleteClick(category)}
                                  size="small"
                                >
                                  <FiTrash2 size={16} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination Controls */}
                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: 1,
                  }}
                >
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    variant="outlined"
                    shape="rounded"
                    color="primary"
                    showFirstButton
                    showLastButton
                    size="small"
                    siblingCount={isMobile ? 1 : 2}
                  />
                  <FormControl
                    variant="outlined"
                    size="small"
                    sx={{ minWidth: 120, mt: isMobile ? 1 : 0 }}
                  >
                    <InputLabel id="rows-per-page-label">
                      Rows per page
                    </InputLabel>
                    <Select
                      labelId="rows-per-page-label"
                      value={rowsPerPage}
                      onChange={handleRowsPerPageChange}
                      label="Rows per page"
                      sx={{ fontSize: '0.75rem' }}
                    >
                      <MenuItem value={5}>5</MenuItem>
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={20}>20</MenuItem>
                      <MenuItem value={30}>30</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Deletion"
        content="Are you sure you want to delete the selected category(ies)? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={isDeleting}
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

export default ManageCategoryTab;
