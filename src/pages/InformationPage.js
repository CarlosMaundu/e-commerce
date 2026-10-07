// src/pages/InformationPage.js
import React from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Container, Paper, Typography } from '@mui/material';
import { getInformationPage } from '../content/information';
import NotFoundPage from './NotFoundPage';

const InformationPage = () => {
  const { slug } = useParams();
  const page = getInformationPage(slug);

  if (!page) return <NotFoundPage />;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 1 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {page.title}
        </Typography>
        {page.body ? (
          page.body.split('\n\n').map((paragraph) => (
            <Typography key={paragraph.slice(0, 40)} paragraph>
              {paragraph}
            </Typography>
          ))
        ) : (
          <Box>
            <Typography color="text.secondary" paragraph>
              This page is coming soon. If you have a question in the meantime,
              please contact our support team.
            </Typography>
            <Button component={RouterLink} to="/products" variant="contained">
              Continue shopping
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default InformationPage;
