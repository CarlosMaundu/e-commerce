// src/components/ProductGrid.js

import React from 'react';
import ProductCard from './ProductCard';
import '../styles/productGrid.css';

const ProductGrid = ({ products }) => {
  return (
    <div className="product-grid">
      {products.length > 0 ? (
        products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))
      ) : (
        <p>No products found.</p>
      )}
    </div>
  );
};

export default ProductGrid;
