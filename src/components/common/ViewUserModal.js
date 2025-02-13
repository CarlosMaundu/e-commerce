// src/components/common/ViewUserModal.js
import React from 'react';
import { Modal, Box, Typography, Avatar, Button, Stack } from '@mui/material';
import { styled } from '@mui/system';
import { FiEdit } from 'react-icons/fi';
import { useTheme } from '@mui/material/styles'; // Import useTheme
import placeholderImage from '../../images/placeholder.jpg';

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

// Define InfoBox within the same file
const InfoBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.shape.infoBoxRadius,
  padding: theme.spacing(2), // 16px
}));

const ViewUserModal = ({ open, onClose, user, navigateToManageUser }) => {
  const theme = useTheme(); // Access theme if needed

  if (!user) {
    return null;
  }

  const handleEdit = () => {
    onClose();
    navigateToManageUser(user); // Use the passed function to navigate
  };

  return (
    <StyledModal
      open={open}
      onClose={onClose}
      aria-labelledby="user-details-modal"
    >
      <ModalContent>
        <Box display="flex" justifyContent="center" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2" fontWeight="600">
            User Profile
          </Typography>
        </Box>

        <Stack spacing={3} alignItems="center" mb={4}>
          <Avatar
            src={user.avatar || placeholderImage}
            alt={user.name || `${user.firstName} ${user.lastName}`}
            sx={{ width: 120, height: 120, mb: 2 }}
            onError={(e) => {
              e.target.src = placeholderImage;
            }}
          />
          <Typography variant="h6" textAlign="center">
            {user.name || `${user.firstName} ${user.lastName}`}
          </Typography>
        </Stack>

        {/* Use the styled InfoBox */}
        <InfoBox>
          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Email
            </Typography>
            <Typography color={theme.palette.text.secondary}>
              {user.email}
            </Typography>
          </InfoRow>

          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Phone
            </Typography>
            <Typography color={theme.palette.text.secondary}>
              {user.phoneNumber}
            </Typography>
          </InfoRow>

          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Country
            </Typography>
            <Typography color={theme.palette.text.secondary}>
              {user.country}
            </Typography>
          </InfoRow>

          <InfoRow>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Location
            </Typography>
            <Typography color={theme.palette.text.secondary}>
              {user.location}
            </Typography>
          </InfoRow>

          <InfoRow sx={{ borderBottom: 'none' }}>
            <Typography color={theme.palette.text.primary} fontWeight="700">
              Role
            </Typography>
            <Typography color={theme.palette.text.secondary}>
              {user.role}
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
            onClick={handleEdit}
            sx={{ textTransform: 'capitalize' }}
          >
            Edit User
          </EditButton>
        </Box>
      </ModalContent>
    </StyledModal>
  );
};

export default ViewUserModal;
