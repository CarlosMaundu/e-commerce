// src/components/layout/FiltersSidebar.js

import React, { useState, useEffect } from 'react';
import { fetchCategories } from '../../services/categoryService';
import {
  IconButton,
  Slider,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Drawer,
  useMediaQuery,
  Typography,
  Box,
  TextField,
} from '@mui/material';
import { FilterList, Close, ExpandMore } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const FiltersSidebar = ({ filters, onFilterChange }) => {
  const [categories, setCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false); // For mobile responsiveness
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error.message);
      }
    };

    loadCategories();
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Handle filter changes
  const handleCategoryChange = (e) => {
    onFilterChange({ ...filters, categoryId: e.target.value });
  };

  const handlePriceChange = (event, newValue) => {
    onFilterChange({
      ...filters,
      price_min: newValue[0],
      price_max: newValue[1],
    });
  };

  const handleRatingChange = (e) => {
    onFilterChange({ ...filters, rating: Number(e.target.value) });
  };

  const handleAvailabilityChange = (e) => {
    onFilterChange({ ...filters, availability: e.target.checked });
  };

  const handleSearchChange = (e) => {
    onFilterChange({ ...filters, title: e.target.value });
  };

  // Sidebar content
  const sidebarContent = (
    <Box sx={{ width: { xs: 250, md: 300 }, p: 2 }}>
      {/* Close Button for Mobile View */}
      {isMobile && (
        <Box display="flex" justifyContent="flex-end">
          <IconButton onClick={toggleSidebar}>
            <Close />
          </IconButton>
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Filters
      </Typography>

      {/* Search Filter */}
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search by Title"
          variant="outlined"
          size="small"
          fullWidth
          value={filters.title || ''}
          onChange={handleSearchChange}
        />
      </Box>

      {/* Category Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Category</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="category-label">Category</InputLabel>
            <Select
              labelId="category-label"
              value={filters.categoryId || ''}
              onChange={handleCategoryChange}
              label="Category"
            >
              <MenuItem value="">
                <em>All Categories</em>
              </MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      {/* Price Range Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Price Range</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Slider
            value={[filters.price_min || 0, filters.price_max || 1000]}
            onChange={handlePriceChange}
            valueLabelDisplay="auto"
            min={0}
            max={1000}
          />
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2">${filters.price_min || 0}</Typography>
            <Typography variant="body2">
              ${filters.price_max || 1000}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Rating Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Rating</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="rating-label">Rating</InputLabel>
            <Select
              labelId="rating-label"
              value={filters.rating || 0}
              onChange={handleRatingChange}
              label="Rating"
            >
              <MenuItem value={0}>All Ratings</MenuItem>
              <MenuItem value={4}>4 stars & above</MenuItem>
              <MenuItem value={3}>3 stars & above</MenuItem>
              <MenuItem value={2}>2 stars & above</MenuItem>
              <MenuItem value={1}>1 star & above</MenuItem>
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      {/* Availability Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Availability</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.availability || false}
                onChange={handleAvailabilityChange}
              />
            }
            label="In Stock"
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );

  return (
    <>
      {/* Mobile Filter Toggle Button */}
      {isMobile && (
        <IconButton
          onClick={toggleSidebar}
          sx={{ position: 'fixed', top: 80, left: 10, zIndex: 1300 }}
        >
          <FilterList />
        </IconButton>
      )}

      {/* Sidebar */}
      {isMobile ? (
        <Drawer anchor="left" open={isOpen} onClose={toggleSidebar}>
          {sidebarContent}
        </Drawer>
      ) : (
        <Box sx={{ width: 300, borderRight: '1px solid #ddd' }}>
          {sidebarContent}
        </Box>
      )}
    </>
  );
};

export default FiltersSidebar;
