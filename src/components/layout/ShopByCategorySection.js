// src/components/layout/ShopByCategorySection.js
import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  Typography,
  Button,
  useTheme,
} from '@mui/material';

import img1 from '../../images/curated-pick1.png';
import img2 from '../../images/curated-pick2.png';
import img3 from '../../images/curated-pick3.png';
import img4 from '../../images/curated-pick4.png';
import img5 from '../../images/curated-pick5.png';
import img6 from '../../images/curated-pick6.png';
import img7 from '../../images/curated-pick7.png';
import img8 from '../../images/curated-pick8.png';
import img9 from '../../images/curated-pick9.png';
import img10 from '../../images/curated-pick10.png';
import img11 from '../../images/curated-pick11.png';
import img12 from '../../images/curated-pick12.png';
import img13 from '../../images/curated-pick13.png';
import img14 from '../../images/curated-pick14.png';

const localCategories = [
  { id: 1, title: 'Women', image: img1 },
  { id: 2, title: 'Men', image: img2 },
  { id: 3, title: 'Beauty', image: img3 },
  { id: 4, title: 'Food & drinks', image: img4 },
  { id: 5, title: 'Baby & toddler', image: img5 },
  { id: 6, title: 'Home', image: img6 },
  { id: 7, title: 'Fitness & nutrition', image: img7 },
  { id: 8, title: 'Furniture', image: img8 },
  { id: 9, title: 'Accessories', image: img9 },
  { id: 10, title: 'Toys & games', image: img10 },
  { id: 11, title: 'Electronics', image: img11 },
  { id: 12, title: 'Arts & crafts', image: img12 },
  { id: 13, title: 'Luggage & bags', image: img13 },
  { id: 14, title: 'Sporting goods', image: img14 },
];

const ShopByCategorySection = ({ onCategorySelect }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  const displayedCategories = expanded
    ? localCategories
    : localCategories.slice(0, 10);

  const handleCategoryClick = (catId) => {
    onCategorySelect(catId);
  };

  return (
    <Box sx={{ width: '100%', mt: 4, px: 0, mx: 'auto' }}>
      <Typography
        variant="h4"
        sx={{
          textAlign: 'left',
          color: theme.palette.text.primary,
          fontWeight: 'bold',
          mb: 3,
        }}
      >
        Shop by Category
      </Typography>

      <Grid
        container
        spacing={2}
        sx={{ flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {displayedCategories.map((cat) => (
          <Grid
            item
            key={cat.id}
            sx={{
              flex: '0 0 20%',
              maxWidth: '20%',
              '@media (max-width: 1200px)': {
                flex: '0 0 33.333%',
                maxWidth: '33.333%',
              },
              '@media (max-width: 900px)': {
                flex: '0 0 50%',
                maxWidth: '50%',
              },
              '@media (max-width: 600px)': {
                flex: '0 0 100%',
                maxWidth: '100%',
              },
            }}
          >
            <Card
              onClick={() => handleCategoryClick(cat.id)}
              sx={{
                borderRadius: theme.shape.borderRadius,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
                },
              }}
            >
              <CardActionArea sx={{ height: 100 }}>
                <CardMedia
                  component="img"
                  image={cat.image}
                  alt={cat.title}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      textShadow: '0px 1px 3px rgba(0, 0, 0, 0.8)',
                    }}
                  >
                    {cat.title}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setExpanded(!expanded)}
          sx={{
            mt: 3,
            textTransform: 'none',
            borderRadius: 1,
          }}
        >
          {expanded ? 'Less' : 'More'}
        </Button>
      </Box>
    </Box>
  );
};

export default ShopByCategorySection;
