// src/components/layout/CuratedPicksSection.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  Typography,
  Button,
  Skeleton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Import images directly
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

const curatedCategories = [
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

const CuratedPicksSection = () => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const displayedCategories = expanded
    ? curatedCategories
    : curatedCategories.slice(0, 8);

  // Navigate to category page
  const handleCategoryClick = (id) => {
    navigate(`/products?category=${id}`);
  };

  return (
    <Box
      sx={{
        maxWidth: '1230px', // Full width container
        mx: 'auto',
        px: 2,
        textAlign: 'center',
        mt: 4,
      }}
    >
      {/* Title */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 'light',
          color: '#333',
          mb: 4,
        }}
      >
        Curated Picks
      </Typography>

      {/* Grid Container */}
      <Grid container spacing={3} justifyContent="center">
        {displayedCategories.map((cat) => (
          <Grid item xs={6} sm={4} md={3} key={cat.id}>
            {loading ? (
              <Skeleton
                variant="rectangular"
                width="100%"
                height={200}
                sx={{ borderRadius: '8px' }}
              />
            ) : (
              <Card
                onClick={() => handleCategoryClick(cat.id)}
                sx={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  height: '100px',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
                  },
                }}
              >
                <CardActionArea sx={{ height: '100%' }}>
                  <CardMedia
                    component="img"
                    image={cat.image}
                    alt={cat.title}
                    sx={{
                      height: '100%',
                      width: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  {/* Text Overlay */}
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
                      background: 'rgba(0, 0, 0, 0.3)',
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
            )}
          </Grid>
        ))}
      </Grid>

      {/* More/Less Button */}
      <Button
        variant="contained"
        onClick={() => setExpanded(!expanded)}
        sx={{
          mt: 4,
          textTransform: 'none',
          backgroundColor: '#007bff',
          '&:hover': { backgroundColor: '#0056b3' },
        }}
      >
        {expanded ? 'Less' : 'More'}
      </Button>
    </Box>
  );
};

export default CuratedPicksSection;
