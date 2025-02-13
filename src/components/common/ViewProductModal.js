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
import { useTheme } from '@mui/material/styles'; // Import useTheme

const StyledModal = styled(Modal)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ModalContent = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.modalBorderRadius,
  padding: theme.spacing(3), // 24px
  maxWidth: 500,
  width: '95%',
  position: 'relative',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: theme.shadows[3],
}));

const InfoRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: `${theme.spacing(1.5)} 0`, // 12px 0
  borderBottom: `1px solid ${theme.palette.grey[200]}`,
}));

const CloseButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.common.white,
  border: `1px solid ${theme.palette.error.main}`,
  color: theme.palette.error.main,
  height: 32,
  minWidth: 120,
  marginRight: theme.spacing(2), // 16px
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: theme.palette.error.light,
    border: `1px solid ${theme.palette.error.main}`,
  },
}));

const EditButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  height: 32,
  minWidth: 120,
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const ImageContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: 300,
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.shape.imageContainerRadius,
  overflow: 'hidden',
  margin: 0,
  padding: 0,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: theme.shape.imageContainerRadius,
  },
}));

const ThumbnailContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.25), // 10px
  overflowX: 'auto',
  padding: `${theme.spacing(2)} 0`, // 16px 0
  '&::-webkit-scrollbar': {
    display: 'none',
  },
}));

const Thumbnail = styled(Box)(({ theme }) => ({
  width: 60,
  height: 60,
  borderRadius: theme.shape.thumbnailRadius,
  cursor: 'pointer',
  border: `2px solid ${theme.palette.grey[200]}`,
  '&:hover': {
    opacity: 0.8,
  },
  '&.active': {
    border: `2px solid ${theme.palette.primary.main}`,
  },
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: theme.shape.thumbnailRadius,
  },
}));

const NavigationButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
}));

// Define InfoBox within the same file
const InfoBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.shape.infoBoxRadius,
  padding: theme.spacing(2), // 16px
}));

const ViewProductModal = ({ open, onClose, product, onEdit }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const theme = useTheme(); // Access theme if needed

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
                  sx={{ left: theme.spacing(1.25) }} // 10px
                  aria-label="Previous image"
                >
                  <FiChevronLeft />
                </NavigationButton>
                <NavigationButton
                  onClick={handleNextImage}
                  sx={{ right: theme.spacing(1.25) }} // 10px
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

        {/* Use the styled InfoBox */}
        <InfoBox>
          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Product Name
            </Typography>
            <Typography
              fontSize="0.9rem"
              color={theme.palette.text.secondary}
              fontWeight="500"
            >
              {product.title}
            </Typography>
          </InfoRow>
          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Price
            </Typography>
            <Typography
              fontSize="0.9rem"
              color={theme.palette.text.secondary}
              fontWeight="500"
            >
              ${product.price}
            </Typography>
          </InfoRow>
          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Category
            </Typography>
            <Typography
              fontSize="0.9rem"
              color={theme.palette.text.secondary}
              fontWeight="500"
            >
              {product.category?.name || 'N/A'}
            </Typography>
          </InfoRow>
          <InfoRow sx={{ borderBottom: 'none' }}>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Stock Status
            </Typography>
            <Typography
              fontSize="0.9rem"
              color={theme.palette.text.secondary}
              fontWeight="500"
            >
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </Typography>
          </InfoRow>
        </InfoBox>

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
