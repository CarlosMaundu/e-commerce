// src/components/products/AllProductsTab.js

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Typography,
  Skeleton,
  Chip,
  IconButton,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Pagination,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';
import { FiEye, FiEdit, FiTrash2 } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts, deleteProductThunk } from '../../redux/productsSlice';
import { fetchCategories } from '../../redux/categoriesSlice';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Notification from '../../notification/notification';
import ViewProductModal from '../common/ViewProductModal';

// We'll call getAllProducts once to get the total item count
import { getAllProducts } from '../../services/productsService';

const AllProductsTab = ({ navigateToManageProduct }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const dispatch = useDispatch();
  const { products, loading, error } = useSelector((state) => state.products);
  const { categories } = useSelector((state) => state.categories);
  const [filters, setFilters] = useState({
    categoryId: '',
    status: '',
    priceSort: '', // for client-side sorting: "lowToHigh" or "highToLow"
    stock: '', // "inStock" or "outOfStock"
    search: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // View modal states
  const [viewOpen, setViewOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);

  // Real total count of all products
  const [totalProducts, setTotalProducts] = useState(0);

  // Fetch categories on mount
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // 1) Fetch total product count (without limit/offset)
  useEffect(() => {
    (async () => {
      try {
        const allData = await getAllProducts();
        setTotalProducts(allData.length);
      } catch (err) {
        console.error('Failed to fetch all products for total count:', err);
      }
    })();
  }, []);

  // 2) Fetch only the slice of products for the current page
  useEffect(() => {
    const offset = (currentPage - 1) * rowsPerPage;

    // For now, we only filter by categoryId or search in the API
    // Since "stock" or "priceSort" are done client-side, we won't pass them to the service
    const appliedFilters = {
      categoryId: filters.categoryId,
      search: filters.search, // mapped to title
      limit: rowsPerPage,
      offset,
    };

    console.log(
      'Dispatching fetchProducts with offset:',
      offset,
      'limit:',
      rowsPerPage,
      'filters:',
      appliedFilters
    );

    dispatch(fetchProducts(appliedFilters));
  }, [dispatch, filters.categoryId, filters.search, currentPage, rowsPerPage]);

  // 3) Client-side sorting & stock filtering
  //    a) Sort by price if "priceSort" is "lowToHigh" or "highToLow"
  //    b) Filter by stock if "stock" is "inStock" or "outOfStock"
  const processedProducts = useMemo(() => {
    // Start from the Redux store's products
    let data = [...products];

    // a) Sort by price
    if (filters.priceSort === 'lowToHigh') {
      data.sort((a, b) => a.price - b.price);
    } else if (filters.priceSort === 'highToLow') {
      data.sort((a, b) => b.price - a.price);
    }

    // b) Filter by stock
    if (filters.stock === 'inStock') {
      data = data.filter((p) => p.inStock === true);
    } else if (filters.stock === 'outOfStock') {
      data = data.filter((p) => p.inStock === false);
    }

    return data;
  }, [products, filters.priceSort, filters.stock]);

  // Handlers
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
    setCurrentPage(1);
  };

  const handleAddProduct = () => {
    // navigate to product form
    navigateToManageProduct();
  };

  const handleDeleteClick = () => {
    if (selectedProducts.length === 0) return;
    setConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(
        selectedProducts.map((id) => dispatch(deleteProductThunk(id)).unwrap())
      );
      setNotification({
        open: true,
        message: 'Selected products deleted successfully.',
        severity: 'success',
      });
      setSelectedProducts([]);
    } catch (err) {
      setNotification({
        open: true,
        message: `Failed to delete some products: ${err}`,
        severity: 'error',
      });
    } finally {
      setIsDeleting(false);
      setConfirmationOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmationOpen(false);
  };

  const handleViewProduct = (product) => {
    setViewProduct(product);
    setViewOpen(true);
  };

  const handleCloseView = () => {
    setViewOpen(false);
    setViewProduct(null);
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Bulk selection logic
  const isAllSelected =
    processedProducts.length > 0 &&
    selectedProducts.length === processedProducts.length;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = processedProducts.map((product) => product.id);
      setSelectedProducts(allIds);
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (e, id) => {
    if (e.target.checked) {
      setSelectedProducts((prev) => [...prev, id]);
    } else {
      setSelectedProducts((prev) => prev.filter((pid) => pid !== id));
    }
  };

  // Number of pages from the real total count
  const totalPages = Math.ceil(totalProducts / rowsPerPage);

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.default,
        borderRadius: 3,
        px: 0,
        py: 0,
      }}
    >
      <Box sx={{ px: isMobile ? 1 : 0, py: isMobile ? 1 : 2 }}>
        {/* Filter Bar */}
        <Box
          sx={{
            mb: 2,
            px: 2,
            py: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            {/* Category Filter */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="category-filter-label">Category</InputLabel>
                <Select
                  labelId="category-filter-label"
                  label="Category"
                  name="categoryId"
                  value={filters.categoryId}
                  onChange={handleFilterChange}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {categories.map((cat) => (
                    <MenuItem
                      key={cat.id}
                      value={cat.id}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Status Filter (Active/Inactive) */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="Status"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  <MenuItem value="active" sx={{ fontSize: '0.75rem' }}>
                    Active
                  </MenuItem>
                  <MenuItem value="inactive" sx={{ fontSize: '0.75rem' }}>
                    Inactive
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Price Sort (lowToHigh, highToLow) - client-side */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="price-sort-label">Sort by Price</InputLabel>
                <Select
                  labelId="price-sort-label"
                  label="Sort by Price"
                  name="priceSort"
                  value={filters.priceSort}
                  onChange={handleFilterChange}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  <MenuItem value="lowToHigh" sx={{ fontSize: '0.75rem' }}>
                    Low to High
                  </MenuItem>
                  <MenuItem value="highToLow" sx={{ fontSize: '0.75rem' }}>
                    High to Low
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Stock Filter (inStock, outOfStock) */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="stock-filter-label">Stock</InputLabel>
                <Select
                  labelId="stock-filter-label"
                  label="Stock"
                  name="stock"
                  value={filters.stock}
                  onChange={handleFilterChange}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  <MenuItem value="inStock" sx={{ fontSize: '0.75rem' }}>
                    In Stock
                  </MenuItem>
                  <MenuItem value="outOfStock" sx={{ fontSize: '0.75rem' }}>
                    Out of Stock
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Search */}
            <Grid item xs={12} sm={2}>
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                placeholder="Search Products..."
                value={filters.search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <SearchIcon
                      color="action"
                      sx={{ mr: 1, fontSize: '1rem' }}
                    />
                  ),
                  sx: { fontSize: '0.75rem' },
                }}
              />
            </Grid>

            {/* Add Product (Default MUI primary color) */}
            <Grid item xs={12} sm={2}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                fullWidth
                onClick={handleAddProduct}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  height: '100%',
                }}
              >
                Add Product
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Products Table */}
        <Box
          sx={{
            px: 2,
            py: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          {loading ? (
            <Box>
              {Array.from({ length: rowsPerPage }).map((_, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Skeleton variant="rectangular" height={50} />
                </Box>
              ))}
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : processedProducts.length === 0 ? (
            <Typography>No products found.</Typography>
          ) : (
            <Box>
              {/* Top Bar: total products + bulk delete if selected */}
              <Box
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.75rem' }}>
                  Total Products: {totalProducts}
                </Typography>

                {selectedProducts.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ fontSize: '0.75rem' }}>
                      {selectedProducts.length} selected
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<FiTrash2 />}
                      onClick={handleDeleteClick}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.75rem',
                      }}
                    >
                      Delete Selected
                    </Button>
                  </Box>
                )}
              </Box>

              <TableContainer component={Paper}>
                <Table aria-label="products table">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ padding: '8px' }}>
                        <Checkbox
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          inputProps={{
                            'aria-label': 'select all products',
                          }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        Product Image
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        Name
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        Category
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        Price
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        Stock Status
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                        align="center"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processedProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        hover
                        selected={selectedProducts.includes(product.id)}
                      >
                        <TableCell sx={{ padding: '8px' }}>
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onChange={(e) => handleSelectProduct(e, product.id)}
                            inputProps={{
                              'aria-label': `select product ${product.title}`,
                            }}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ padding: '8px' }}>
                          <Box
                            component="img"
                            src={product.images[0]}
                            alt={product.title}
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/40';
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ padding: '8px', fontSize: '0.75rem' }}>
                          {product.title}
                        </TableCell>
                        <TableCell sx={{ padding: '8px', fontSize: '0.75rem' }}>
                          {product.category?.name || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ padding: '8px', fontSize: '0.75rem' }}>
                          ${product.price}
                        </TableCell>
                        <TableCell sx={{ padding: '8px' }}>
                          {product.inStock ? (
                            <Chip
                              label="In Stock"
                              variant="outlined"
                              color="success"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Chip
                              label="Out of Stock"
                              variant="outlined"
                              color="error"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ padding: '8px' }} align="center">
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              flexWrap: 'nowrap',
                            }}
                          >
                            {/* View Icon */}
                            <Tooltip title="View">
                              <IconButton
                                onClick={() => handleViewProduct(product)}
                                size="small"
                                sx={{ mr: 1 }}
                              >
                                <FiEye
                                  size={16}
                                  color={theme.palette.text.secondary}
                                />
                              </IconButton>
                            </Tooltip>

                            {/* Edit Icon */}
                            <Tooltip title="Edit">
                              <IconButton
                                color="primary"
                                onClick={() => navigateToManageProduct(product)}
                                size="small"
                                sx={{ mr: 1 }}
                              >
                                <FiEdit size={16} />
                              </IconButton>
                            </Tooltip>

                            {/* Delete Icon */}
                            <Tooltip title="Delete">
                              <IconButton
                                color="error"
                                onClick={() => {
                                  setSelectedProducts([product.id]);
                                  setConfirmationOpen(true);
                                }}
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

              {/* Pagination and Rows per Page controls */}
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
            </Box>
          )}
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Deletion"
        content="Are you sure you want to delete the selected product(s)? This action is irreversible."
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={isDeleting}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* View Product Modal */}
      <ViewProductModal
        open={viewOpen}
        onClose={handleCloseView}
        product={viewProduct}
        onEdit={(p) => {
          navigateToManageProduct(p);
          setViewOpen(false);
        }}
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

export default AllProductsTab;
