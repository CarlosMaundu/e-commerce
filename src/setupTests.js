// src/setupTests.js
import '@testing-library/jest-dom';
import 'matchmedia-polyfill';
import 'matchmedia-polyfill/matchMedia.addListener';

// Mock axios globally if necessary
jest.mock('axios');
window.scrollTo = jest.fn();

// Suppress specific warnings if desired
const originalWarn = console.warn;
console.warn = (...args) => {
  if (/React Router Future Flag Warning/.test(args[0])) {
    return;
  }
  originalWarn(...args);
};
