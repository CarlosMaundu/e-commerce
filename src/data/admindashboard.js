// src/data/admindashboard.js

/**
 * All dummy data for the Admin Dashboard layout.
 * This file acts like a "mock API," so AdminDashboardSection
 * can remain clean and simply import these variables.
 */

// Top-level metrics (cards)
export const mockMetrics = [
  {
    title: 'Today Revenue',
    value: '$8,521',
    bgColor: '#ccffd8',
    chartColor: '#2E7D32',
  },
  {
    title: 'Today Orders',
    value: '212',
    bgColor: '#fff7cc',
    chartColor: '#FFD600',
  },
  {
    title: 'Products',
    value: '1543',
    bgColor: '#ffd8d8',
    chartColor: '#D32F2F',
  },
  {
    title: 'Visitors',
    value: '9,103',
    bgColor: '#f5d8ff',
    chartColor: '#7B1FA2',
  },
];

// Revenue line chart data
export const lineChartData = {
  labels: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  datasets: [
    {
      label: 'This Year',
      data: [120, 200, 300, 250, 500, 800, 700, 900, 650, 1200, 1300, 1600],
      borderColor: '#4caf50', // green
      fill: false,
      tension: 0.2,
    },
    {
      label: 'Last Year',
      data: [100, 150, 250, 200, 400, 700, 500, 800, 600, 1000, 1100, 1400],
      borderColor: '#ffeb3b', // yellow
      fill: false,
      tension: 0.2,
    },
  ],
};

// Top products listing
export const topProducts = [
  { name: 'Wireless Mouse', price: '$25.00' },
  { name: 'Gaming Keyboard', price: '$45.00' },
  { name: 'Bluetooth Headset', price: '$35.00' },
];

// Product status pie chart
export const pieChartData = {
  labels: ['Delivered', 'Pending', 'Canceled'],
  datasets: [
    {
      data: [60, 25, 15], // or percentages
      backgroundColor: ['#4caf50', '#ffeb3b', '#f44336'], // green, yellow, red
      hoverOffset: 4,
    },
  ],
};

// Recent orders
export const recentOrders = [
  {
    orderNo: '#425482',
    date: '05/09/2023',
    customer: 'Wade Warren',
    price: '$523',
    status: 'Delivered',
  },
  {
    orderNo: '#425483',
    date: '06/09/2023',
    customer: 'Savannah Nguyen',
    price: '$199',
    status: 'Pending',
  },
  {
    orderNo: '#425484',
    date: '07/09/2023',
    customer: 'Guy Hawkins',
    price: '$350',
    status: 'Canceled',
  },
  // Fourth row
  {
    orderNo: '#425485',
    date: '08/09/2023',
    customer: 'Courtney Henry',
    price: '$728',
    status: 'Delivered',
  },
];
