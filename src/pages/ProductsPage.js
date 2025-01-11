// src/pages/ProductsPage.js

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { fetchProducts } from '../redux/productsSlice';
import { fetchCategories } from '../redux/categoriesSlice';
import ProductGrid from '../components/common/ProductGrid';
import ProductsFilter from '../components/layout/ProductsFilter';
import ShopByCategorySection from '../components/layout/ShopByCategorySection';

import bannerVid from '../images/productspage.mp4';
import { getAllProducts } from '../services/productsService'; // Import to fetch all products for total count

const ProductsPage = () => {
  const dispatch = useDispatch();
  const {
    products: fetchedProducts,
    loading,
    error,
  } = useSelector((state) => state.products);
  const { categories } = useSelector((state) => state.categories);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialCategory = queryParams.get('category') || '';

  // API filters
  const [filters, setFilters] = useState({
    search: '',
    categoryId: initialCategory,
    price_min: 0,
    price_max: 1000,
  });

  // Client filters
  const [clientFilters, setClientFilters] = useState({
    rating: 0,
    availability: '',
  });

  // Sorting
  const [sortOption, setSortOption] = useState('popularity');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [totalProducts, setTotalProducts] = useState(0); // For total count

  const columns = isMobile ? 2 : 5;
  const productsPerPage = rowsPerPage * columns;

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Fetch total product count for current filters (without limit/offset)
  useEffect(() => {
    (async () => {
      try {
        const allData = await getAllProducts({
          title: filters.search || '',
          categoryId: filters.categoryId || undefined,
          price_min: filters.price_min,
          price_max: filters.price_max,
          // No limit/offset parameters to fetch all matching products
        });
        setTotalProducts(allData.length);
      } catch (err) {
        console.error('Failed to fetch all products for total count:', err);
      }
    })();
  }, [filters]);

  useEffect(() => {
    const limit = productsPerPage;
    const offset = (currentPage - 1) * productsPerPage;

    const apiFilters = {
      title: filters.search || '',
      categoryId: filters.categoryId,
      price_min: filters.price_min,
      price_max: filters.price_max,
      limit,
      offset,
    };
    dispatch(fetchProducts(apiFilters));
  }, [dispatch, filters, currentPage, productsPerPage]);

  const processedProducts = useMemo(() => {
    let data = [...fetchedProducts];

    if (clientFilters.availability === 'inStock') {
      data = data.filter((p) => p.inStock);
    } else if (clientFilters.availability === 'outOfStock') {
      data = data.filter((p) => !p.inStock);
    }

    if (clientFilters.rating > 0) {
      data = data.filter((p) => (p.rating || 0) >= clientFilters.rating);
    }

    switch (sortOption) {
      case 'priceLowToHigh':
        data.sort((a, b) => a.price - b.price);
        break;
      case 'priceHighToLow':
        data.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        data.sort((a, b) => new Date(b.creationAt) - new Date(a.creationAt));
        break;
      default:
        break;
    }
    return data;
  }, [fetchedProducts, clientFilters, sortOption]);

  // Use totalProducts from separate fetch to calculate totalPages
  const totalPages = Math.ceil(totalProducts / productsPerPage);

  // Do not slice processedProducts further; it's already the current page's data
  const currentProducts = processedProducts;

  const handlePageChange = (_, value) => {
    setCurrentPage(value);
  };
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      categoryId: '',
      price_min: 0,
      price_max: 1000,
    });
    setClientFilters({
      rating: 0,
      availability: '',
    });
    setSortOption('popularity');
    setCurrentPage(1);
  };

  const chosenCategory = categories.find(
    (cat) => String(cat.id) === filters.categoryId
  );
  const pageTitle = chosenCategory ? chosenCategory.name : 'All Products';

  const handleCategorySelect = (catId) => {
    setFilters((prev) => ({ ...prev, categoryId: String(catId) }));
    setCurrentPage(1);
  };

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.default,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 3 },
        gap: 2,
      }}
    >
      {/* MP4 banner */}
      <Box
        sx={{
          width: '100%',
          height: { xs: '150px', sm: '220px', md: '300px' },
          overflow: 'hidden',
          borderRadius: theme.shape.borderRadius,
        }}
      >
        <video
          src={bannerVid}
          autoPlay
          muted
          loop
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </Box>

      {/* Shop by Category */}
      <ShopByCategorySection onCategorySelect={handleCategorySelect} />

      {/* Title */}
      <Typography
        variant="h4"
        sx={{
          ...theme.typography.h4,
          color: theme.palette.text.primary,
          textAlign: 'left',
        }}
      >
        {pageTitle}
      </Typography>

      {/* Filters */}
      <ProductsFilter
        filters={filters}
        setFilters={setFilters}
        clientFilters={clientFilters}
        setClientFilters={setClientFilters}
        sortOption={sortOption}
        setSortOption={setSortOption}
        onResetFilters={handleResetFilters}
      />

      {/* Products */}
      <Box sx={{ flex: 1 }}>
        <ProductGrid
          products={currentProducts}
          columns={columns}
          loading={loading}
        />

        {error && (
          <Typography
            variant="h6"
            color="error"
            sx={{ mt: 2, textAlign: 'center' }}
          >
            {error}
          </Typography>
        )}

        {/* Pagination & Rows Per Page */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2,
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
            <InputLabel id="rows-per-page-label">Rows per page</InputLabel>
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
    </Box>
  );
};

export default ProductsPage;
