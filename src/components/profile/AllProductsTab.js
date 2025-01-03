import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts, deleteProductThunk } from '../../redux/productsSlice';
import { fetchCategories } from '../../redux/categoriesSlice';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Notification from '../../notification/notification';

const AllProductsTab = ({ navigateToManageProduct }) => {
  const dispatch = useDispatch();
  const { products, loading, error } = useSelector((state) => state.products);
  const { categories } = useSelector((state) => state.categories);

  const [filters, setFilters] = useState({
    categoryId: '',
    status: '',
    price: '',
    date: '',
    search: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // New state for loading animation
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // Placeholder for total products. Replace with actual count if available.
  const totalProducts = 200;

  // Fetch categories on mount
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Fetch products whenever filters or pagination changes
  useEffect(() => {
    const offset = (currentPage - 1) * rowsPerPage;
    const appliedFilters = {
      ...filters,
      limit: rowsPerPage,
      offset,
    };
    dispatch(fetchProducts(appliedFilters));
  }, [dispatch, filters, currentPage, rowsPerPage]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setFilters((prev) => ({
      ...prev,
      search: e.target.value,
    }));
    setCurrentPage(1);
  };

  const handleAddProduct = () => {
    navigateToManageProduct();
  };

  const handleDeleteClick = () => {
    if (selectedProducts.length === 0) return;
    setConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true); // Start loading animation
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
      setIsDeleting(false); // Stop loading animation
      setConfirmationOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmationOpen(false);
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

  const isAllSelected =
    products.length > 0 && selectedProducts.length === products.length;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = products.map((product) => product.id);
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

  // Create an array for skeleton placeholders
  const skeletonArray = Array.from(new Array(rowsPerPage));

  // Calculate total pages
  const totalPages = Math.ceil(totalProducts / rowsPerPage);

  return (
    <Box
      sx={{
        margin: '0 auto',
        px: 0,
        py: 0,
      }}
    >
      {/* Filter Bar */}
      <Box
        sx={{
          mb: 2,
          p: 2,
          backgroundColor: '#fff',
          borderRadius: 2,
          boxShadow: 1,
        }}
      >
        <Grid container spacing={2} alignItems="center">
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
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

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
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="price-filter-label">Price</InputLabel>
              <Select
                labelId="price-filter-label"
                label="Price"
                name="price"
                value={filters.price}
                onChange={handleFilterChange}
                sx={{ fontSize: '0.75rem' }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                <MenuItem value="lowToHigh">Low to High</MenuItem>
                <MenuItem value="highToLow">High to Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="date-filter-label">Date</InputLabel>
              <Select
                labelId="date-filter-label"
                label="Date"
                name="date"
                value={filters.date}
                onChange={handleFilterChange}
                sx={{ fontSize: '0.75rem' }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                <MenuItem value="newest">Newest to Oldest</MenuItem>
                <MenuItem value="oldest">Oldest to Newest</MenuItem>
              </Select>
            </FormControl>
          </Grid>

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
                  <SearchIcon color="action" sx={{ mr: 1, fontSize: '1rem' }} />
                ),
                sx: { fontSize: '0.75rem' },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              fullWidth
              onClick={handleAddProduct}
              sx={{
                backgroundColor: '#1976d2',
                color: '#fff',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#115293',
                },
                fontSize: '0.75rem',
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
          p: 2,
          backgroundColor: '#fff',
          borderRadius: 2,
          boxShadow: 1,
        }}
      >
        {loading ? (
          // Skeleton placeholders while loading
          <Box>
            {skeletonArray.map((_, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" height={50} />
              </Box>
            ))}
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : products.length === 0 ? (
          <Typography>No products found.</Typography>
        ) : (
          <Box>
            {/* Bulk Actions */}
            {selectedProducts.length > 0 && (
              <Box
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
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

            {/* Table */}
            <TableContainer component={Paper}>
              <Table aria-label="products table">
                <TableHead>
                  <TableRow>
                    {/* Select All Checkbox */}
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
                    {/* Product Image */}
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Product Image
                    </TableCell>
                    {/* Name */}
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Name
                    </TableCell>
                    {/* Category */}
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Category
                    </TableCell>
                    {/* Price */}
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Price
                    </TableCell>
                    {/* Stock Status */}
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Stock Status
                    </TableCell>
                    {/* Actions */}
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                      align="center"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow
                      key={product.id}
                      hover
                      selected={selectedProducts.includes(product.id)}
                    >
                      {/* Checkbox */}
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
                      {/* Product Image */}
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
                      {/* Name */}
                      <TableCell sx={{ padding: '8px', fontSize: '0.75rem' }}>
                        {product.title}
                      </TableCell>
                      {/* Category */}
                      <TableCell sx={{ padding: '8px', fontSize: '0.75rem' }}>
                        {product.category?.name || 'N/A'}
                      </TableCell>
                      {/* Price */}
                      <TableCell sx={{ padding: '8px', fontSize: '0.75rem' }}>
                        ${product.price}
                      </TableCell>
                      {/* Stock Status */}
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
                      {/* Actions */}
                      <TableCell sx={{ padding: '8px' }} align="center">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination and Rows per Page controls */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 2,
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
              />
              <FormControl
                variant="outlined"
                size="small"
                sx={{ minWidth: 120 }}
              >
                <InputLabel id="rows-per-page-label">Rows per page</InputLabel>
                <Select
                  labelId="rows-per-page-label"
                  value={rowsPerPage}
                  onChange={handleRowsPerPageChange}
                  label="Rows per page"
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Deletion"
        content={`Are you sure you want to delete the selected product(s)? This action is irreversible.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={isDeleting} // Pass loading state
        confirmText="Delete"
        cancelText="Cancel"
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
