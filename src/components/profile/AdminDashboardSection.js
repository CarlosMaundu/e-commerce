// src/components/profile/AdminDashboardSection.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
} from '@mui/material';
import { Line, Pie } from 'react-chartjs-2';
import 'chart.js/auto'; // For chart.js v4

// Import all the dummy data from admindashboard.js
import {
  mockMetrics,
  lineChartData,
  topProducts,
  pieChartData,
  recentOrders,
} from '../../data/admindashboard';

const AdminDashboardSection = () => {
  const [timeRange, setTimeRange] = useState('Year'); // 'Year' or 'Month'

  // Example effect for time range changes
  useEffect(() => {
    // Once backend is created, refetch or filter lineChartData based on timeRange
  }, [timeRange]);

  return (
    <Box sx={{ px: 0, py: 0 }}>
      {/* 1. Key Metrics Overview (Top Cards) */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {mockMetrics.map((metric, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Card
              sx={{
                backgroundColor: metric.bgColor,
                boxShadow: 1,
                borderRadius: 3, // Consistent border radius
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {metric.title}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {metric.value}
                </Typography>
                {/* Small sparkline chart */}
                <Box sx={{ height: 40 }}>
                  <Line
                    data={{
                      labels: ['A', 'B', 'C', 'D'],
                      datasets: [
                        {
                          data: [10, 15, 12, 18],
                          borderColor: metric.chartColor,
                          fill: false,
                          pointRadius: 0,
                          tension: 0.2,
                        },
                      ],
                    }}
                    options={{
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { display: false },
                        y: { display: false },
                      },
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 2. Middle Row: Revenue Chart and Top Products */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Revenue Chart */}
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              boxShadow: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3, // Consistent border radius
            }}
          >
            <CardContent sx={{ flex: 1 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}
              >
                <Typography variant="subtitle1" fontWeight="bold">
                  Revenue Chart
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setTimeRange(timeRange === 'Year' ? 'Month' : 'Year')
                  }
                >
                  {timeRange}
                </Button>
              </Box>
              <Box sx={{ flex: 1, minHeight: 300 }}>
                <Line
                  data={lineChartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' } },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {/* Top Products */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              boxShadow: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3, // Consistent border radius
            }}
          >
            <CardContent sx={{ flex: 1 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="subtitle1" fontWeight="bold">
                  Top Products
                </Typography>
                <Button size="small" variant="text">
                  See All
                </Button>
              </Box>
              {topProducts && topProducts.length > 0 ? (
                topProducts.map((product, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 1,
                      borderBottom:
                        idx < topProducts.length - 1
                          ? '1px solid #eee'
                          : 'none',
                    }}
                  >
                    <Typography variant="body2">{product.name}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {product.price}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2">
                  No top products available.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 3. Bottom Row: Pie Chart + Recent Orders Table */}
      <Grid container spacing={2}>
        {/* Product Status Pie Chart */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              boxShadow: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3, // Consistent border radius
            }}
          >
            <CardContent sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Product Status
              </Typography>
              <Box sx={{ flex: 1, minHeight: 220 }}>
                <Pie
                  data={pieChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Orders */}
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              boxShadow: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3, // Consistent border radius
            }}
          >
            <CardContent sx={{ flex: 1 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="subtitle1" fontWeight="bold">
                  Recent Orders
                </Typography>
                <Button size="small" variant="text">
                  See All
                </Button>
              </Box>
              <Box sx={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{ textAlign: 'left', backgroundColor: '#f5f5f5' }}
                    >
                      <th style={{ padding: '8px' }}>#Order No.</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>
                        Date
                      </th>
                      <th style={{ padding: '8px' }}>Customer Name</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>
                        Price
                      </th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders && recentOrders.length > 0 ? (
                      recentOrders.map((order, idx) => (
                        <tr
                          key={idx}
                          style={{ borderBottom: '1px solid #ddd' }}
                        >
                          <td style={{ padding: '8px' }}>{order.orderNo}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {order.date}
                          </td>
                          <td style={{ padding: '8px' }}>{order.customer}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            {order.price}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor:
                                  order.status === 'Delivered'
                                    ? '#4caf50'
                                    : order.status === 'Pending'
                                      ? '#ffeb3b'
                                      : '#f44336',
                                color:
                                  order.status === 'Pending' ? '#000' : '#fff',
                              }}
                            >
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          style={{ padding: '8px', textAlign: 'center' }}
                        >
                          No recent orders available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboardSection;
