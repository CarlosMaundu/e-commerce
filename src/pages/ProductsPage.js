// src/pages/ProductsPage.js

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import FiltersSidebar from '../components/layout/FiltersSidebar';
import ProductGrid from '../components/common/ProductGrid';
import { fetchProducts } from '../redux/productsSlice';
import '../styles/productsPage.css';
import { useLocation } from 'react-router-dom';
import {
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';

const ProductsPage = () => {
  const dispatch = useDispatch();
  const {
    products: fetchedProducts,
    loading,
    error,
  } = useSelector((state) => state.products);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialCategory = queryParams.get('category') || '';

  // State for filters, sorting, and pagination
  const [filters, setFilters] = useState({
    categoryId: initialCategory,
    price_min: 0,
    price_max: 1000,
    title: '',
  });
  const [additionalFilters, setAdditionalFilters] = useState({
    rating: 0,
    availability: false,
  });
  const [sortOption, setSortOption] = useState('popularity'); // Sorting handled by API if possible
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(2); // Number of rows (number of columns per row)
  const columns = 5; // Number of columns in the grid
  const productsPerPage = rowsPerPage * columns; // Total products per page

  useEffect(() => {
    // Calculate limit and offset based on currentPage and productsPerPage
    const limit = productsPerPage;
    const offset = (currentPage - 1) * productsPerPage;

    // Prepare filter parameters for the API
    const apiFilters = {
      ...filters,
      limit,
      offset,
    };

    // Dispatch fetchProducts with filters
    dispatch(fetchProducts(apiFilters));
  }, [dispatch, filters, currentPage, productsPerPage]);

  // Handle filter changes from FiltersSidebar
  const handleFilterChange = (newFilters) => {
    // Separate API-supported filters and additional filters
    const { title, categoryId, price_min, price_max, rating, availability } =
      newFilters;

    const apiFilters = {
      title: title || '',
      categoryId: categoryId || '',
      price_min: price_min || 0,
      price_max: price_max || 1000,
    };
    setFilters(apiFilters);

    const clientSideFilters = {
      rating: rating || 0,
      availability: availability || false,
    };
    setAdditionalFilters(clientSideFilters);

    setCurrentPage(1); // Reset to first page when filters change
  };

  // Handle sorting changes
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  // Handle page changes
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // Handle rows per page changes
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  };

  // Apply additional client-side filters (rating, availability)
  const additionalFilteredProducts = fetchedProducts
    .filter((product) => {
      // Filter by rating
      if (
        additionalFilters.rating > 0 &&
        product.rating < additionalFilters.rating
      ) {
        return false;
      }
      // Filter by availability
      if (additionalFilters.availability && !product.inStock) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort products based on sortOption
      switch (sortOption) {
        case 'priceLowToHigh':
          return a.price - b.price;
        case 'priceHighToLow':
          return b.price - a.price;
        case 'newest':
          return new Date(b.creationAt) - new Date(a.creationAt);
        case 'popularity':
        default:
          return 0;
      }
    });

  // Pagination logic for client-side filters
  const totalFilteredProducts = additionalFilteredProducts.length;
  const totalPages = Math.ceil(totalFilteredProducts / productsPerPage);

  const currentProducts = additionalFilteredProducts.slice(0, productsPerPage);

  return (
    <Box className="products-page">
      <Box className="products-page__container">
        <FiltersSidebar
          filters={{ ...filters, ...additionalFilters }}
          onFilterChange={handleFilterChange}
        />
        <Box className="products-page__main">
          <Box
            className="products-page__header"
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h4">Shop</Typography>
            <Box className="products-page__controls">
              {/* Sorting Options */}
              <FormControl
                variant="outlined"
                size="small"
                sx={{ minWidth: 150 }}
              >
                <InputLabel id="sort-label">Sort by</InputLabel>
                <Select
                  labelId="sort-label"
                  value={sortOption}
                  onChange={handleSortChange}
                  label="Sort by"
                >
                  <MenuItem value="popularity">Popularity</MenuItem>
                  <MenuItem value="priceLowToHigh">Price: Low to High</MenuItem>
                  <MenuItem value="priceHighToLow">Price: High to Low</MenuItem>
                  <MenuItem value="newest">Newest Arrivals</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          {/* Product Grid */}
          <ProductGrid
            products={currentProducts}
            columns={columns}
            loading={loading}
          />
          {/* Error Message */}
          {error && (
            <Typography
              variant="h6"
              color="error"
              sx={{ mt: 2, textAlign: 'center' }}
            >
              {error}
            </Typography>
          )}
          {/* Pagination and Rows Per Page */}
          <Box
            className="products-page__footer"
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
            />
            <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="rows-per-page-label">Rows per page</InputLabel>
              <Select
                labelId="rows-per-page-label"
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                label="Rows per page"
              >
                <MenuItem value={2}>2</MenuItem>
                <MenuItem value={4}>4</MenuItem>
                <MenuItem value={6}>6</MenuItem>
                <MenuItem value={8}>8</MenuItem>
                <MenuItem value={10}>10</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ProductsPage;
