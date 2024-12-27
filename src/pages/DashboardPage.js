// src/pages/DashboardPage.js
import React from 'react';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';
import { Line } from 'react-chartjs-2';

const DashboardPage = () => {
  const chartData = {
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
        data: [30, 40, 45, 50, 49, 60, 70, 91, 125, 140, 150, 170],
        borderColor: '#4CAF50',
        tension: 0.4,
      },
      {
        label: 'Last Year',
        data: [20, 35, 40, 48, 47, 55, 68, 85, 120, 135, 145, 160],
        borderColor: '#FF9800',
        tension: 0.4,
      },
    ],
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Today Revenue</Typography>
              <Typography variant="h4">$8,521</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Today Order</Typography>
              <Typography variant="h4">1,436</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Total Products</Typography>
              <Typography variant="h4">25,321</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Today Visitors</Typography>
              <Typography variant="h4">15,752</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6">Revenue</Typography>
              <Line data={chartData} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
