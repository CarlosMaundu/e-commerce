// src/components/FiltersSidebar.js

import React, { useState, useEffect } from 'react';
import { fetchCategories } from '../services/categoryService'; // Corrected import
import '../styles/filtersSidebar.css';

const FiltersSidebar = ({ onFilterChange }) => {
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: '',
    priceRange: [0, 1000],
    rating: 0,
  });

  useEffect(() => {
    const fetchCategoriesData = async () => {
      try {
        const data = await fetchCategories(); // Corrected function call
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error.message);
      }
    };
    fetchCategoriesData();
  }, []);

  const handleCategoryChange = (e) => {
    setFilters({ ...filters, category: e.target.value });
    onFilterChange({ ...filters, category: e.target.value });
  };

  // Implement other filter handlers...

  return (
    <aside className="filters-sidebar">
      <h2>Filters</h2>
      <div className="filter-group">
        <h3>Category</h3>
        <select value={filters.category} onChange={handleCategoryChange}>
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      {/* Implement other filters: Price Range, Rating, etc. */}
    </aside>
  );
};

export default FiltersSidebar;
