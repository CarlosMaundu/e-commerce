// src/components/common/ViewProductModal.js
import React, { useState } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/system';
import { FiEdit, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const StyledModal = styled(Modal)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const ModalContent = styled(Box)({
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '500px',
  width: '95%',
  position: 'relative',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
});

const InfoRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: '1px solid #eee',
});

const CloseButton = styled(Button)({
  backgroundColor: '#fff',
  border: '1px solid #ff1744',
  color: '#ff1744',
  height: '32px',
  minWidth: '120px',
  marginRight: '16px',
  '&:hover': {
    backgroundColor: '#ffe6e9',
    border: '1px solid #ff1744',
  },
});

const EditButton = styled(Button)({
  backgroundColor: '#1976d2',
  color: '#fff',
  height: '32px',
  minWidth: '120px',
  '&:hover': {
    backgroundColor: '#1565c0',
  },
});

const ImageContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '300px',
  backgroundColor: '#f8f9fa',
  borderRadius: '16px',
  overflow: 'hidden',
  margin: 0,
  padding: 0,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '16px',
  },
});

const ThumbnailContainer = styled(Box)({
  display: 'flex',
  gap: '10px',
  overflowX: 'auto',
  padding: '16px 0',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
});

const Thumbnail = styled(Box)({
  width: '60px',
  height: '60px',
  borderRadius: '4px',
  cursor: 'pointer',
  border: '2px solid transparent',
  '&:hover': {
    opacity: 0.8,
  },
  '&.active': {
    border: '2px solid #1976d2',
  },
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '4px',
  },
});

const NavigationButton = styled(IconButton)({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});

const ViewProductModal = ({ open, onClose, product, onEdit }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!product) return null;

  const images = product.images || [];
  const handlePrevImage = () =>
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const handleNextImage = () =>
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  return (
    <StyledModal
      open={open}
      onClose={onClose}
      aria-labelledby="view-product-modal"
    >
      <ModalContent>
        <Box display="flex" justifyContent="center" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2" fontWeight="600">
            Product Details
          </Typography>
        </Box>

        <Stack spacing={3} mb={4}>
          <ImageContainer>
            <img
              src={images[currentImageIndex] || ''}
              alt={product.title}
              onError={(e) => {
                e.target.src = '/placeholder.jpg';
              }}
            />
            {images.length > 1 && (
              <>
                <NavigationButton
                  onClick={handlePrevImage}
                  sx={{ left: 10 }}
                  aria-label="Previous image"
                >
                  <FiChevronLeft />
                </NavigationButton>
                <NavigationButton
                  onClick={handleNextImage}
                  sx={{ right: 10 }}
                  aria-label="Next image"
                >
                  <FiChevronRight />
                </NavigationButton>
              </>
            )}
          </ImageContainer>

          {images.length > 1 && (
            <ThumbnailContainer>
              {images.map((image, index) => (
                <Thumbnail
                  key={index}
                  className={currentImageIndex === index ? 'active' : ''}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    onError={(e) => {
                      e.target.src = '/placeholder.jpg';
                    }}
                  />
                </Thumbnail>
              ))}
            </ThumbnailContainer>
          )}
        </Stack>

        <Box sx={{ backgroundColor: '#f8f9fa', borderRadius: '8px', p: 2 }}>
          <InfoRow>
            <Typography color="#000" fontWeight="700">
              Product Name
            </Typography>
            <Typography fontSize="0.9rem" color="#666" fontWeight="500">
              {product.title}
            </Typography>
          </InfoRow>
          <InfoRow>
            <Typography color="#000" fontWeight="700">
              Price
            </Typography>
            <Typography fontSize="0.9rem" color="#666" fontWeight="500">
              ${product.price}
            </Typography>
          </InfoRow>
          <InfoRow>
            <Typography color="#000" fontWeight="700">
              Category
            </Typography>
            <Typography fontSize="0.9rem" color="#666" fontWeight="500">
              {product.category?.name || 'N/A'}
            </Typography>
          </InfoRow>
          <InfoRow sx={{ borderBottom: 'none' }}>
            <Typography color="#000" fontWeight="700">
              Stock Status
            </Typography>
            <Typography fontSize="0.9rem" color="#666" fontWeight="500">
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </Typography>
          </InfoRow>
        </Box>

        <Box mt={3} display="flex" justifyContent="flex-end">
          <CloseButton onClick={onClose} sx={{ textTransform: 'capitalize' }}>
            Close
          </CloseButton>
          <EditButton
            variant="contained"
            startIcon={<FiEdit />}
            onClick={() => onEdit(product)}
            sx={{ textTransform: 'capitalize' }}
          >
            Edit Product
          </EditButton>
        </Box>
      </ModalContent>
    </StyledModal>
  );
};

export default ViewProductModal;
