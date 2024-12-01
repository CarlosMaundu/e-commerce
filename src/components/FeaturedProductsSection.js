// src/components/FeaturedProductsSection.js

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ProductCard from './ProductCard';
import '../styles/homePage.css';
import { fetchProducts } from '../redux/productsSlice';
import { CircularProgress, IconButton } from '@mui/material';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';

const FeaturedProductsSection = () => {
  const dispatch = useDispatch();
  const { products, loading, error } = useSelector((state) => state.products);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 10; // 5 cards per row * 2 rows
  const maxSlides = 2; // Limit to two slides

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  // Calculate total pages based on 10 products per page and limit to 2
  const totalPages = Math.min(
    maxSlides,
    Math.ceil(products.length / productsPerPage)
  );

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  // Determine the products to display on the current page
  const indexOfFirstProduct = (currentPage - 1) * productsPerPage;
  const currentProducts = products.slice(
    indexOfFirstProduct,
    indexOfFirstProduct + productsPerPage
  );

  return (
    <section className="featured-products-section">
      <h2>Featured Products</h2>
      {loading ? (
        <div className="loading">
          <CircularProgress />
        </div>
      ) : error ? (
        <p className="error-message">
          Error loading products. Please try again later.
        </p>
      ) : (
        <div className="featured-products-wrapper">
          {/* Left Pagination Arrow */}
          <IconButton
            className="pagination-arrow left-arrow"
            onClick={handlePrev}
            disabled={currentPage === 1}
            aria-label="Previous Page"
          >
            <ArrowBackIos />
          </IconButton>

          {/* Products Grid */}
          <div className="featured-products-grid">
            {currentProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Right Pagination Arrow */}
          <IconButton
            className="pagination-arrow right-arrow"
            onClick={handleNext}
            disabled={currentPage === totalPages}
            aria-label="Next Page"
          >
            <ArrowForwardIos />
          </IconButton>
        </div>
      )}
    </section>
  );
};

export default FeaturedProductsSection;
