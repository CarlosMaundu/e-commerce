// src/components/profile/ProductsSection.js

import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  FiLayers as TableRowsIcon,
  FiShoppingCart as EditIcon,
  FiFolder as CategoryIcon,
  FiTruck as Inventory2Icon,
} from 'react-icons/fi';

import AllProductsTab from './AllProductsTab';
import ManageProductTab from './ManageProductTab';
import ManageCategoryTab from './ManageCategoryTab';
import InventoryTab from './InventoryTab';

const ProductsSection = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeTab, setActiveTab] = useState(0);
  const [currentProduct, setCurrentProduct] = useState(null);

  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
    setCurrentProduct(null);
  };

  const navigateToManageProduct = (product = null) => {
    setCurrentProduct(product);
    setActiveTab(1);
  };

  return (
    <Box sx={{ width: '100%', px: 0, py: 0 }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant={isMobile ? 'scrollable' : 'fullWidth'}
        // Changed from scrollButtons="off" to a valid value:
        scrollButtons={isMobile ? 'auto' : false}
        aria-label="Products Management Tabs"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tab
          icon={<TableRowsIcon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              All Products
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 120,
            height: 48,
            fontWeight: activeTab === 0 ? 'bold' : 'normal',
            color: activeTab === 0 ? 'primary.main' : 'text.secondary',
          }}
        />
        <Tab
          icon={<EditIcon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              Manage Product
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 150,
            height: 48,
            fontWeight: activeTab === 1 ? 'bold' : 'normal',
            color: activeTab === 1 ? 'primary.main' : 'text.secondary',
          }}
        />
        <Tab
          icon={<CategoryIcon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              Manage Category
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 150,
            height: 48,
            fontWeight: activeTab === 2 ? 'bold' : 'normal',
            color: activeTab === 2 ? 'primary.main' : 'text.secondary',
          }}
        />
        <Tab
          icon={<Inventory2Icon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              Inventory
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 100,
            height: 48,
            fontWeight: activeTab === 3 ? 'bold' : 'normal',
            color: activeTab === 3 ? 'primary.main' : 'text.secondary',
          }}
        />
      </Tabs>

      {/* Removed the surrounding Box with padding to allow each tab to manage its own padding */}
      {activeTab === 0 && (
        <AllProductsTab navigateToManageProduct={navigateToManageProduct} />
      )}
      {activeTab === 1 && (
        <ManageProductTab
          currentProduct={currentProduct}
          navigateToManageProduct={navigateToManageProduct}
          navigateToManageCategoryTab={() => setActiveTab(2)}
        />
      )}
      {activeTab === 2 && <ManageCategoryTab />}
      {activeTab === 3 && <InventoryTab />}
    </Box>
  );
};

export default ProductsSection;
