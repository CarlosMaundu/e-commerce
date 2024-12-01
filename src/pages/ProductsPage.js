// src/pages/ProductsPage.js

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import FiltersSidebar from '../components/FiltersSidebar';
import ProductGrid from '../components/ProductGrid';
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
  const { products } = useSelector((state) => state.products);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialCategory = queryParams.get('category') || '';

  // State for filters, sorting, and pagination
  const [filters, setFilters] = useState({
    category: initialCategory,
    priceRange: [0, 1000],
    rating: 0,
    availability: false,
    searchTerm: '',
  });
  const [sortOption, setSortOption] = useState('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(2); // Rows per page (number of rows)
  const columns = 5; // Number of columns in the grid
  const productsPerPage = rowsPerPage * columns; // Total products per page

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  // Apply filters and sorting
  const filteredProducts = products
    .filter((product) => {
      // Filter by category
      if (
        filters.category &&
        product.category &&
        String(product.category.id) !== filters.category
      ) {
        return false;
      }
      // Filter by price range
      if (
        product.price < filters.priceRange[0] ||
        product.price > filters.priceRange[1]
      ) {
        return false;
      }
      // Filter by rating
      if (filters.rating > 0 && product.rating < filters.rating) {
        return false;
      }
      // Filter by availability
      if (filters.availability && !product.inStock) {
        return false;
      }
      // Filter by search term
      if (
        filters.searchTerm &&
        !product.title.toLowerCase().includes(filters.searchTerm.toLowerCase())
      ) {
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

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  // Handlers for filters and sorting
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  };

  return (
    <Box className="products-page">
      <Box className="products-page__container">
        <FiltersSidebar filters={filters} onFilterChange={handleFilterChange} />
        <Box className="products-page__main">
          <Box className="products-page__header">
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
          <ProductGrid products={currentProducts} columns={columns} />
          {/* Pagination and Rows Per Page */}
          <Box className="products-page__footer">
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
