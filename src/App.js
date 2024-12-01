/* src/App.js */
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';
import Footer from './components/Footer';

const App = () => {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header cartCount={2} wishlistCount={5} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
        <Footer /> {/* Add Footer */}
      </Router>
    </AuthProvider>
  );
};

export default App;
