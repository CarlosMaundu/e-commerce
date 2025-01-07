// src/components/layout/ProductsFilter.js

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Slider,
  OutlinedInput,
  Menu,
  MenuItem as MUIMenuItem,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../redux/categoriesSlice';

const ProductsFilter = ({
  filters, // { categoryId, price_min, price_max, ... }
  setFilters,
  clientFilters, // { rating, availability }
  setClientFilters,
  sortOption,
  setSortOption,
  onResetFilters,
}) => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state) => state.categories);
  const theme = useTheme();

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Dropdown anchor states
  const [anchorElPrice, setAnchorElPrice] = useState(null);
  const [anchorElStock, setAnchorElStock] = useState(null);
  const [anchorElCategory, setAnchorElCategory] = useState(null);
  const [anchorElRating, setAnchorElRating] = useState(null);
  const [anchorElSort, setAnchorElSort] = useState(null);

  // Temporary states for Price slider
  const [tempPriceRange, setTempPriceRange] = useState([0, 1000]);
  const [tempMin, setTempMin] = useState(0);
  const [tempMax, setTempMax] = useState(1000);

  // Handlers for Category dropdown
  const openCategoryMenu = (e) => {
    setAnchorElCategory(e.currentTarget);
  };
  const closeCategoryMenu = () => {
    setAnchorElCategory(null);
  };
  const selectCategory = (id) => {
    setFilters((prev) => ({ ...prev, categoryId: id }));
    closeCategoryMenu();
  };

  // Handlers for Price dropdown (existing)
  const openPriceMenu = (e) => {
    setAnchorElPrice(e.currentTarget);
    setTempPriceRange([filters.price_min, filters.price_max]);
    setTempMin(filters.price_min);
    setTempMax(filters.price_max);
  };
  const closePriceMenu = () => {
    setAnchorElPrice(null);
  };
  const handleSliderChange = (_, newValue) => {
    setTempPriceRange(newValue);
    setTempMin(newValue[0]);
    setTempMax(newValue[1]);
  };
  const handleMinChange = (e) => {
    const val = Number(e.target.value) || 0;
    setTempMin(val);
    setTempPriceRange([val, tempPriceRange[1]]);
  };
  const handleMaxChange = (e) => {
    const val = Number(e.target.value) || 0;
    setTempMax(val);
    setTempPriceRange([tempPriceRange[0], val]);
  };
  const resetPrice = () => {
    setTempPriceRange([0, 1000]);
    setTempMin(0);
    setTempMax(1000);
  };
  const applyPrice = () => {
    setFilters((prev) => ({
      ...prev,
      price_min: tempPriceRange[0],
      price_max: tempPriceRange[1],
    }));
    closePriceMenu();
  };

  // Handlers for Stock dropdown
  const openStockMenu = (e) => {
    setAnchorElStock(e.currentTarget);
  };
  const closeStockMenu = () => {
    setAnchorElStock(null);
  };
  const selectStock = (val) => {
    setClientFilters((prev) => ({ ...prev, availability: val }));
    closeStockMenu();
  };

  // Handlers for Rating dropdown
  const openRatingMenu = (e) => {
    setAnchorElRating(e.currentTarget);
  };
  const closeRatingMenu = () => {
    setAnchorElRating(null);
  };
  const selectRating = (value) => {
    setClientFilters((prev) => ({
      ...prev,
      rating: value === '' ? 0 : Number(value),
    }));
    closeRatingMenu();
  };

  // Handlers for Sort dropdown
  const openSortMenu = (e) => {
    setAnchorElSort(e.currentTarget);
  };
  const closeSortMenu = () => {
    setAnchorElSort(null);
  };
  const selectSort = (value) => {
    setSortOption(value === '' ? 'popularity' : value);
    closeSortMenu();
  };

  // Dropdown button common style
  const dropdownButtonSx = {
    px: 2,
    py: 0.6,
    borderRadius: 1,
    color: '#fff',
    fontSize: 'small',
    textTransform: 'none',
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
    '& .MuiSvgIcon-root': {
      fill: '#fff',
    },
  };

  // Placeholder texts
  const categoryText =
    filters.categoryId === ''
      ? 'Select Category'
      : categories.find((cat) => String(cat.id) === filters.categoryId)?.name ||
        'Select Category';

  const priceText =
    filters.price_min === 0 && filters.price_max === 1000
      ? 'Select Price'
      : `Price: $${filters.price_min} - $${filters.price_max}`;

  const stockText =
    clientFilters.availability === ''
      ? 'Select Stock'
      : clientFilters.availability === 'inStock'
        ? 'In Stock'
        : 'Out of Stock';

  const ratingText =
    clientFilters.rating === 0
      ? 'Select Rating'
      : `${clientFilters.rating}★ & up`;

  const sortText = sortOption === 'popularity' ? 'Select Sort...' : sortOption;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
      }}
    >
      {/* Category Dropdown */}
      <Button
        variant="outlined"
        onClick={openCategoryMenu}
        endIcon={<ArrowDropDownIcon />}
        size="small"
        sx={dropdownButtonSx}
      >
        {categoryText}
      </Button>
      <Menu
        anchorEl={anchorElCategory}
        open={Boolean(anchorElCategory)}
        onClose={closeCategoryMenu}
      >
        <MUIMenuItem onClick={() => selectCategory('')}>
          <em>All</em>
        </MUIMenuItem>
        {categories.map((cat) => (
          <MUIMenuItem
            key={cat.id}
            onClick={() => selectCategory(String(cat.id))}
          >
            {cat.name}
          </MUIMenuItem>
        ))}
      </Menu>

      {/* Price Dropdown */}
      <Button
        variant="outlined"
        onClick={openPriceMenu}
        endIcon={<ArrowDropDownIcon />}
        size="small"
        sx={dropdownButtonSx}
      >
        {priceText}
      </Button>
      <Menu
        anchorEl={anchorElPrice}
        open={Boolean(anchorElPrice)}
        onClose={closePriceMenu}
      >
        <Box sx={{ px: 2, py: 2, width: 250 }}>
          <Typography variant="body2" gutterBottom>
            Price Range
          </Typography>
          <Slider
            value={tempPriceRange}
            onChange={handleSliderChange}
            min={0}
            max={1000}
            valueLabelDisplay="auto"
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <OutlinedInput
              size="small"
              type="number"
              value={tempMin}
              onChange={handleMinChange}
              sx={{ width: 80 }}
            />
            <OutlinedInput
              size="small"
              type="number"
              value={tempMax}
              onChange={handleMaxChange}
              sx={{ width: 80 }}
            />
          </Box>
          <Box
            sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}
          >
            <Button
              variant="text"
              color="secondary"
              onClick={resetPrice}
              size="small"
            >
              Reset
            </Button>
            <Button variant="contained" onClick={applyPrice} size="small">
              Done
            </Button>
          </Box>
        </Box>
      </Menu>

      {/* Stock Dropdown */}
      <Button
        variant="outlined"
        onClick={openStockMenu}
        endIcon={<ArrowDropDownIcon />}
        size="small"
        sx={dropdownButtonSx}
      >
        {stockText}
      </Button>
      <Menu
        anchorEl={anchorElStock}
        open={Boolean(anchorElStock)}
        onClose={closeStockMenu}
      >
        <MUIMenuItem onClick={() => selectStock('')}>All</MUIMenuItem>
        <MUIMenuItem onClick={() => selectStock('inStock')}>
          In Stock
        </MUIMenuItem>
        <MUIMenuItem onClick={() => selectStock('outOfStock')}>
          Out of Stock
        </MUIMenuItem>
      </Menu>

      {/* Rating Dropdown */}
      <Button
        variant="outlined"
        onClick={openRatingMenu}
        endIcon={<ArrowDropDownIcon />}
        size="small"
        sx={dropdownButtonSx}
      >
        {ratingText}
      </Button>
      <Menu
        anchorEl={anchorElRating}
        open={Boolean(anchorElRating)}
        onClose={closeRatingMenu}
      >
        <MUIMenuItem onClick={() => selectRating('')}>
          <em>Select Rating</em>
        </MUIMenuItem>
        <MUIMenuItem onClick={() => selectRating(4)}>4★ & up</MUIMenuItem>
        <MUIMenuItem onClick={() => selectRating(3)}>3★ & up</MUIMenuItem>
        <MUIMenuItem onClick={() => selectRating(2)}>2★ & up</MUIMenuItem>
        <MUIMenuItem onClick={() => selectRating(1)}>1★ & up</MUIMenuItem>
      </Menu>

      {/* Sort Dropdown */}
      <Button
        variant="outlined"
        onClick={openSortMenu}
        endIcon={<ArrowDropDownIcon />}
        size="small"
        sx={dropdownButtonSx}
      >
        {sortText}
      </Button>
      <Menu
        anchorEl={anchorElSort}
        open={Boolean(anchorElSort)}
        onClose={closeSortMenu}
      >
        <MUIMenuItem onClick={() => selectSort('')}>
          <em>Select Sort...</em>
        </MUIMenuItem>
        <MUIMenuItem onClick={() => selectSort('priceLowToHigh')}>
          Price: Low to High
        </MUIMenuItem>
        <MUIMenuItem onClick={() => selectSort('priceHighToLow')}>
          Price: High to Low
        </MUIMenuItem>
        <MUIMenuItem onClick={() => selectSort('newest')}>
          Newest Arrivals
        </MUIMenuItem>
      </Menu>

      {/* Reset */}
      <Button
        variant="contained"
        color="secondary"
        size="small"
        sx={{
          textTransform: 'none',
          borderRadius: 1,
          height: 36,
        }}
        onClick={onResetFilters}
      >
        Reset
      </Button>
    </Box>
  );
};

export default ProductsFilter;
