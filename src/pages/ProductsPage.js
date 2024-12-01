// src/pages/ProductsPage.js

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import FiltersSidebar from '../components/FiltersSidebar';
import ProductGrid from '../components/ProductGrid';
import { fetchProducts } from '../redux/productsSlice';
import '../styles/productsPage.css';

const ProductsPage = () => {
  const dispatch = useDispatch();
  const { products } = useSelector((state) => state.products);

  // State for filters, sorting, and pagination
  const [filters, setFilters] = useState({
    category: '',
    priceRange: [0, 1000],
    brand: '',
    rating: 0,
  });
  const [sortOption, setSortOption] = useState('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  // Apply filters and sorting
  const filteredProducts = products
    .filter((product) => {
      // Filter by category
      if (filters.category && product.category.id !== filters.category) {
        return false;
      }
      // Filter by price range
      if (
        product.price < filters.priceRange[0] ||
        product.price > filters.priceRange[1]
      ) {
        return false;
      }
      // Filter by rating (assuming product has a rating property)
      if (product.rating < filters.rating) {
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
        default:
          return 0;
      }
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const indexOfFirstProduct = (currentPage - 1) * productsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstProduct,
    indexOfFirstProduct + productsPerPage
  );

  // Handlers for filters and sorting
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="products-page">
      <div className="products-page__container">
        <FiltersSidebar onFilterChange={handleFilterChange} />
        <div className="products-page__main">
          <div className="products-page__header">
            <h1>Shop</h1>
            <div className="products-page__sorting">
              <label htmlFor="sort">Sort by:</label>
              <select id="sort" value={sortOption} onChange={handleSortChange}>
                <option value="popularity">Popularity</option>
                <option value="priceLowToHigh">Price: Low to High</option>
                <option value="priceHighToLow">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>
          <ProductGrid products={currentProducts} />
          {/* Pagination */}
          <div className="products-page__pagination">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index + 1}
                className={`pagination-button ${
                  currentPage === index + 1 ? 'active' : ''
                }`}
                onClick={() => handlePageChange(index + 1)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
