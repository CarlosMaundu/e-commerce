// src/components/profile/ManageProductTab.js

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { FiTrash2 } from 'react-icons/fi';
import { MdOutlineCameraEnhance } from 'react-icons/md';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';

import {
  createProductThunk,
  updateProductThunk,
  fetchProducts,
} from '../../redux/productsSlice';
import { fetchCategories } from '../../redux/categoriesSlice';
import Notification from '../../notification/notification';
import RoundedToggleSwitch from '../common/RoundedToggleSwitch';
import { uploadFileThunk } from '../../redux/fileSlice';
import placeholderImage from '../../images/placeholder.jpg';

/** A simple green progress bar (turns red if isError = true). */
function ProgressBar({ value = 0, isError = false }) {
  return (
    <Box
      sx={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e2e8f0', // neutral background
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: '100%',
          width: `${value}%`,
          backgroundColor: isError ? '#dc2626' : '#10b981', // red or green
          transition: 'width 0.2s ease',
        }}
      />
    </Box>
  );
}

/** Spinner from your snippet, indefinite spin. */
function SpinnerSvg() {
  return (
    <Box sx={{ width: '40px', height: '40px' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        style={{
          width: '100%',
          height: '100%',
          animation: 'spin 0.8s linear infinite',
          fill: '#2563eb',
        }}
      >
        <path d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z" />
      </svg>
    </Box>
  );
}

// Example subcategories – This will be addressed later usig API data
const subcategories = [
  { id: 'subcat1', name: 'Subcategory 1' },
  { id: 'subcat2', name: 'Subcategory 2' },
];

const ManageProductTab = ({
  currentProduct,
  navigateToManageProduct,
  navigateToManageCategoryTab,
}) => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state) => state.categories);

  const fileInputRef = useRef(null);

  // spinner for main image
  const [mainImageLoading, setMainImageLoading] = useState(false);

  // upload progress states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(false);

  // discount toggles
  const [discountAllCustomers, setDiscountAllCustomers] = useState(false);
  const [discountFirstTime, setDiscountFirstTime] = useState(false);
  const [discountLifetime, setDiscountLifetime] = useState(false);
  const [discountTemporary, setDiscountTemporary] = useState(false);

  // If "Temporary Discount" is on, user can pick a start & end date
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const isEditMode = Boolean(currentProduct);
  const editProductId = currentProduct?.id || null;

  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    description: '',
    price: '',
    stock: '0',
    discount: '0',
    discountType: '',
    categoryId: '',
    subcategoryId: '',
    images: [], // up to 6
  });

  // toggles for size & color
  const [enableSize, setEnableSize] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [enableColor, setEnableColor] = useState(false);
  const [selectedColors, setSelectedColors] = useState([]);

  // main image index
  const [mainImageIndex, setMainImageIndex] = useState(-1);

  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // fetch categories on mount
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // load product data if editing
  useEffect(() => {
    if (isEditMode && currentProduct) {
      const imagesArr = currentProduct.images || [];
      setFormData({
        title: currentProduct.title || '',
        brand: currentProduct.brand || '',
        description: currentProduct.description || '',
        price: currentProduct.price?.toString() || '',
        stock: currentProduct.stock?.toString() || '0',
        discount: currentProduct.discount?.toString() || '0',
        discountType: currentProduct.discountType || '',
        categoryId: currentProduct.category?.id || '',
        subcategoryId: currentProduct.subcategory?.id || '',
        images: imagesArr.slice(0, 6),
      });

      setEnableSize(!!currentProduct.sizes?.length);
      setSelectedSizes(currentProduct.sizes || []);
      setEnableColor(!!currentProduct.colors?.length);
      setSelectedColors(currentProduct.colors || []);

      // If images exist, show the first as main
      if (imagesArr.length > 0) {
        setMainImageIndex(0);
      } else {
        setMainImageIndex(-1);
      }
    } else {
      // for add product
      setFormData({
        title: '',
        brand: '',
        description: '',
        price: '',
        stock: '0',
        discount: '0',
        discountType: '',
        categoryId: '',
        subcategoryId: '',
        images: [],
      });
      setEnableSize(false);
      setSelectedSizes([]);
      setEnableColor(false);
      setSelectedColors([]);
      setMainImageIndex(-1);
    }
  }, [isEditMode, currentProduct]);

  // keep mainImageIndex valid
  useEffect(() => {
    if (formData.images.length === 0) {
      setMainImageIndex(-1);
    } else if (mainImageIndex < 0 || mainImageIndex >= formData.images.length) {
      setMainImageIndex(Math.max(0, formData.images.length - 1));
    }
  }, [formData.images, mainImageIndex]);

  // derived states
  const mainImage =
    mainImageIndex >= 0 && mainImageIndex < formData.images.length
      ? formData.images[mainImageIndex]
      : '';

  // 6-slot thumbnail approach
  const thumbnailSlots = new Array(6)
    .fill(null)
    .map((_, i) => formData.images[i] || null);

  // handlers
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file) return;

    // limit 6
    if (formData.images.length >= 6) {
      setNotification({
        open: true,
        message: 'Maximum of 6 images allowed.',
        severity: 'warning',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(false);

    try {
      const result = await dispatch(
        uploadFileThunk({
          file,
          onProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percent);
          },
        })
      ).unwrap();

      const newURL = result.location;
      if (newURL) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, newURL].slice(0, 6),
        }));
        if (formData.images.length === 0) {
          setMainImageIndex(0);
        } else {
          // newly added as main?
          setMainImageIndex(formData.images.length);
        }
      }

      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
      }, 600);
    } catch (error) {
      setUploadError(true);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
      }, 1200);
      setNotification({
        open: true,
        message: `File upload failed: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleDeleteImage = (index) => {
    setFormData((prev) => {
      const updated = [...prev.images];
      updated.splice(index, 1);
      return { ...prev, images: updated };
    });
  };

  const handleMainImageLoadStart = () => setMainImageLoading(true);
  const handleMainImageLoad = () => setMainImageLoading(false);

  const handleSaveDraft = () => {
    setNotification({
      open: true,
      message: 'Draft saved (no validation).',
      severity: 'info',
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Product Name is required';
    if (!formData.brand.trim()) newErrors.brand = 'Brand is required';
    if (!formData.price || isNaN(formData.price))
      newErrors.price = 'Valid price is required';
    if (!formData.stock || isNaN(formData.stock))
      newErrors.stock = 'Valid stock number is required';
    if (!formData.categoryId)
      newErrors.categoryId = 'Category selection is required';
    if (!formData.subcategoryId)
      newErrors.subcategoryId = 'Subcategory selection is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // If discountTemporary is on, store date range if needed
    const productData = {
      ...formData,
      price: Number(formData.price),
      stock: Number(formData.stock),
      discount: Number(formData.discount),
      images: formData.images.filter((url) => url.trim() !== ''),
      sizes: enableSize ? selectedSizes : [],
      colors: enableColor ? selectedColors : [],
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
      dispatch(fetchProducts({ limit: 10, offset: 0 }));
      handleCancel();
    } catch (err) {
      setNotification({
        open: true,
        message: `Action failed: ${err}`,
        severity: 'error',
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      brand: '',
      description: '',
      price: '',
      stock: '0',
      discount: '0',
      discountType: '',
      categoryId: '',
      subcategoryId: '',
      images: [],
    });
    setEnableSize(false);
    setSelectedSizes([]);
    setEnableColor(false);
    setSelectedColors([]);
    setStartDate(null);
    setEndDate(null);
    navigateToManageProduct();
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Card sx={{ p: 2, boxShadow: 1, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            {isEditMode ? 'Edit Product' : 'Add Product'}
          </Typography>

          <form onSubmit={handleSaveProduct}>
            <Grid container spacing={3}>
              {/* LEFT GRID */}
              <Grid item xs={12} md={8}>
                {/* GENERAL INFORMATION */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    General Information
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Product Name"
                        name="title"
                        value={formData.title}
                        onChange={handleFormChange}
                        error={!!errors.title}
                        helperText={errors.title}
                        variant="outlined"
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Brand"
                        placeholder="Brand Name"
                        name="brand"
                        value={formData.brand}
                        onChange={handleFormChange}
                        error={!!errors.brand}
                        helperText={errors.brand}
                        variant="outlined"
                        fullWidth
                        size="small"
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    label="Description"
                    name="description"
                    multiline
                    rows={3}
                    value={formData.description}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) handleFormChange(e);
                    }}
                    variant="outlined"
                    fullWidth
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', textAlign: 'right', mb: 2 }}
                  >
                    {formData.description.length}/500
                  </Typography>
                </Box>

                {/* CATEGORY & SUBCATEGORY */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Category & Subcategory
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl
                        fullWidth
                        size="small"
                        error={!!errors.categoryId}
                      >
                        <InputLabel>Category</InputLabel>
                        <Select
                          name="categoryId"
                          value={formData.categoryId}
                          onChange={handleFormChange}
                          label="Category"
                        >
                          <MenuItem value="">
                            <em>Select Category</em>
                          </MenuItem>
                          {categories.map((cat) => (
                            <MenuItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl
                        fullWidth
                        size="small"
                        error={!!errors.subcategoryId}
                      >
                        <InputLabel>Subcategory</InputLabel>
                        <Select
                          name="subcategoryId"
                          value={formData.subcategoryId}
                          onChange={handleFormChange}
                          label="Subcategory"
                        >
                          <MenuItem value="">
                            <em>Select Subcategory</em>
                          </MenuItem>
                          {subcategories.map((subcat) => (
                            <MenuItem key={subcat.id} value={subcat.id}>
                              {subcat.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          if (navigateToManageCategoryTab) {
                            navigateToManageCategoryTab();
                          }
                        }}
                        sx={{
                          textTransform: 'capitalize',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Add category
                      </Button>
                    </Grid>
                  </Grid>
                </Box>

                {/* PRICING & STOCK */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Pricing & Stock
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Base Price"
                        name="price"
                        value={formData.price}
                        onChange={handleFormChange}
                        error={!!errors.price}
                        helperText={errors.price}
                        variant="outlined"
                        type="number"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Stock"
                        name="stock"
                        value={formData.stock}
                        onChange={handleFormChange}
                        error={!!errors.stock}
                        helperText={errors.stock}
                        variant="outlined"
                        type="number"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Discount (%)"
                        name="discount"
                        value={formData.discount}
                        onChange={handleFormChange}
                        variant="outlined"
                        type="number"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Discount Type</InputLabel>
                        <Select
                          name="discountType"
                          value={formData.discountType}
                          onChange={handleFormChange}
                          label="Discount Type"
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          <MenuItem value="Seasonal Discount">
                            Seasonal Discount
                          </MenuItem>
                          <MenuItem value="Clearance">Clearance</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Discount toggles with MUI date pickers for date range */}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Discount Applicability
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      <RoundedToggleSwitch
                        label="All Customers"
                        labelPlacement="start" // toggle left, text right
                        checked={discountAllCustomers}
                        onChange={(e) => {
                          setDiscountAllCustomers(e.target.checked);
                          if (e.target.checked) setDiscountFirstTime(false);
                        }}
                      />
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <RoundedToggleSwitch
                        label="First Time Customers"
                        labelPlacement="start" // toggle left, text right
                        checked={discountFirstTime}
                        onChange={(e) => {
                          setDiscountFirstTime(e.target.checked);
                          if (e.target.checked) setDiscountAllCustomers(false);
                        }}
                      />
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <RoundedToggleSwitch
                        label="Lifetime Discount"
                        labelPlacement="start" // toggle left, text right
                        checked={discountLifetime}
                        onChange={(e) => {
                          // Turn off temporary discount if lifetime is turned on
                          setDiscountLifetime(e.target.checked);
                          if (e.target.checked) setDiscountTemporary(false);
                        }}
                      />
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <RoundedToggleSwitch
                        label="Temporary Discount"
                        labelPlacement="start" // toggle left, text right
                        checked={discountTemporary}
                        onChange={(e) => {
                          // Turn off lifetime discount if temporary is turned on
                          setDiscountTemporary(e.target.checked);
                          if (e.target.checked) setDiscountLifetime(false);
                        }}
                      />
                    </Box>
                    {/* Simple date range using two MUI free DatePickers */}
                    <Box sx={{ mt: 2 }}>
                      <Typography
                        sx={{ fontSize: '0.9rem', mb: 1, fontWeight: 'bold' }}
                      >
                        Discount Period{' '}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontStyle: 'italic',
                            marginLeft: '4px',
                          }}
                        >
                          (Select Temporary Discount to enable section)
                        </span>
                      </Typography>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <Grid
                          container
                          spacing={2}
                          sx={{ alignItems: 'center' }}
                        >
                          <Grid item>
                            <DatePicker
                              label="Start Date"
                              disabled={!discountTemporary}
                              value={startDate}
                              onChange={(val) => setStartDate(val)}
                              disablePast
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  sx={{ width: 150 }}
                                  disabled={!discountTemporary}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item>
                            <DatePicker
                              label="End Date"
                              disabled={!discountTemporary}
                              value={endDate}
                              onChange={(val) => setEndDate(val)}
                              disablePast
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  sx={{ width: 150 }}
                                  disabled={!discountTemporary}
                                />
                              )}
                            />
                          </Grid>
                        </Grid>
                      </LocalizationProvider>
                    </Box>
                  </Box>
                </Box>

                {/* SIZE & COLOR SELECTION */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Size & Color Selection
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <RoundedToggleSwitch
                        label="Enable Size Selection"
                        labelPlacement="start" // toggle left, text right
                        checked={enableSize}
                        onChange={(e) => {
                          setEnableSize(e.target.checked);
                          if (!e.target.checked) setSelectedSizes([]);
                        }}
                      />
                      {enableSize && (
                        <Box
                          sx={{
                            mt: 1,
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                          }}
                        >
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => (
                            <Button
                              key={size}
                              variant={
                                selectedSizes.includes(size)
                                  ? 'contained'
                                  : 'outlined'
                              }
                              onClick={() => {
                                setSelectedSizes((prev) =>
                                  prev.includes(size)
                                    ? prev.filter((s) => s !== size)
                                    : [...prev, size]
                                );
                              }}
                              size="small"
                              sx={{ textTransform: 'capitalize' }}
                            >
                              {size}
                            </Button>
                          ))}
                        </Box>
                      )}
                    </Grid>
                    <Grid item xs={12}>
                      <RoundedToggleSwitch
                        label="Enable Color Selection"
                        labelPlacement="start" // toggle left, text right
                        checked={enableColor}
                        onChange={(e) => {
                          setEnableColor(e.target.checked);
                          if (!e.target.checked) setSelectedColors([]);
                        }}
                      />
                      {enableColor && (
                        <Box
                          sx={{
                            mt: 1,
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                          }}
                        >
                          {['Red', 'Blue', 'Green', 'Black', 'White'].map(
                            (color) => (
                              <Button
                                key={color}
                                variant={
                                  selectedColors.includes(color)
                                    ? 'contained'
                                    : 'outlined'
                                }
                                onClick={() => {
                                  setSelectedColors((prev) =>
                                    prev.includes(color)
                                      ? prev.filter((c) => c !== color)
                                      : [...prev, color]
                                  );
                                }}
                                size="small"
                                sx={{ textTransform: 'capitalize' }}
                              >
                                {color}
                              </Button>
                            )
                          )}
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* RIGHT GRID - IMAGES */}
              <Grid item xs={12} md={4}>
                {/* MAIN IMAGE */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Product Images
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      height: 220,
                      border: '1px solid #ccc',
                      borderRadius: 2,
                      overflow: 'hidden',
                      mb: 2,
                    }}
                  >
                    {mainImageLoading && (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        <SpinnerSvg />
                      </Box>
                    )}
                    {mainImage ? (
                      <img
                        src={mainImage}
                        alt="Main"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onLoadStart={handleMainImageLoadStart}
                        onLoad={handleMainImageLoad}
                        onError={(e) => {
                          e.target.src = placeholderImage;
                          setMainImageLoading(false);
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#f9f9f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          No main image
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* 6 THUMBNAIL SLOTS + 1 UPLOAD SLOT */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {thumbnailSlots.map((imgUrl, i) => {
                      if (imgUrl) {
                        const isActive = i === mainImageIndex;
                        return (
                          <Box
                            key={`thumb-${i}`}
                            sx={{
                              position: 'relative',
                              width: 60,
                              height: 60,
                              border: isActive
                                ? '2px solid #000'
                                : '1px solid #ccc',
                              borderRadius: 1,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              '&:hover': { borderColor: 'primary.main' },
                            }}
                            onClick={() => {
                              if (imgUrl) setMainImageIndex(i);
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`Thumb-${i}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => (e.target.src = placeholderImage)}
                            />
                            <IconButton
                              color="error"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                backgroundColor: 'rgba(255,255,255,0.7)',
                              }}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDeleteImage(i);
                              }}
                            >
                              <FiTrash2 size={14} />
                            </IconButton>
                          </Box>
                        );
                      } else {
                        // empty slot
                        return (
                          <Box
                            key={`thumb-empty-${i}`}
                            sx={{
                              width: 60,
                              height: 60,
                              border: '1px dashed #ccc',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f0f0f0',
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Empty
                            </Typography>
                          </Box>
                        );
                      }
                    })}

                    {/* Separate upload slot (7th slot) */}
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        border: '1px solid #ccc',
                        borderRadius: 1,
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        '&:hover': { borderColor: 'primary.main' },
                      }}
                      onClick={handleUploadClick}
                    >
                      <MdOutlineCameraEnhance size={22} />
                    </Box>
                  </Box>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </Box>

                {/* Upload progress */}
                {uploading && (
                  <Box sx={{ mb: 2 }}>
                    <ProgressBar value={uploadProgress} isError={uploadError} />
                  </Box>
                )}
              </Grid>
            </Grid>

            {/* Footer buttons */}
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
                  width: { xs: '100%', sm: 'auto' }, // full width on mobile
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveDraft}
                sx={{
                  textTransform: 'capitalize',
                  fontSize: '0.875rem',
                  width: { xs: '100%', sm: 'auto' }, // full width on mobile
                }}
              >
                Save Draft
              </Button>
              <Button
                variant="contained"
                type="submit"
                sx={{
                  textTransform: 'capitalize',
                  fontSize: '0.875rem',
                  width: { xs: '100%', sm: 'auto' }, // full width on mobile
                }}
              >
                {isEditMode ? 'Update Product' : 'Save Product'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>

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
