// src/pages/ProfilePage.js
import React, { useEffect, useState, useContext, Suspense } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';
import Notification from '../notification/notification';
import { Typography, Box, Skeleton } from '@mui/material';
import { useTheme, useMediaQuery } from '@mui/material'; // Corrected import
import { useLocation } from 'react-router-dom';

import ProfileSection from '../components/profile/ProfileSection';
import Sidebar from '../components/layout/Sidebar'; // Ensure this path is correct

const AddressBookSection = React.lazy(
  () => import('../components/profile/AddressBookSection')
);
const PaymentOptionsSection = React.lazy(
  () => import('../components/profile/PaymentOptionsSection')
);
const OrdersSection = React.lazy(
  () => import('../components/profile/OrdersSection')
);
const WishlistSection = React.lazy(
  () => import('../components/profile/WishlistSection')
);

const defaultAvatarUrl = 'https://i.imgur.com/kIaFC3J.png';

const ProfilePage = () => {
  const { user, accessToken, loading, updateUser } = useContext(AuthContext);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSection = searchParams.get('section') || 'profile';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const [formData, setFormData] = useState({
    id: user?.id || '',
    firstName: '',
    lastName: '',
    email: user?.email || '',
    address: user?.address || '',
    avatar: user?.avatar || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (!loading && !user) {
      setNotification({
        open: true,
        message: 'You are not authenticated. Please login.',
        severity: 'error',
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      const nameParts = user.name?.split(' ') || [];
      const firstName = nameParts[0] || user.name || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      setFormData({
        id: user.id,
        firstName,
        lastName,
        email: user.email || '',
        address: user.address || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section') || 'profile';
    setActiveSection(section);
  }, [location]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (showPasswordFields && formData.newPassword.trim()) {
      if (formData.newPassword !== formData.confirmNewPassword) {
        newErrors.confirmNewPassword = 'Passwords do not match';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCancel = () => {
    if (user) {
      const nameParts = user.name?.split(' ') || [];
      const firstName = nameParts[0] || user.name || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      setFormData({
        id: user.id,
        firstName,
        lastName,
        email: user.email || '',
        address: user.address || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setErrors({});
      setShowPasswordFields(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    const fullName =
      `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

    const updateData = {
      id: formData.id,
      name: fullName,
      email: formData.email,
      avatar: formData.avatar,
      address: formData.address,
      password:
        showPasswordFields && formData.newPassword.trim() !== ''
          ? formData.newPassword
          : '',
    };

    try {
      const updatedUser = await updateUserProfile(updateData, accessToken);
      updateUser(updatedUser);
      setNotification({
        open: true,
        message: 'Profile updated successfully.',
        severity: 'success',
      });
      if (showPasswordFields) {
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        });
        setShowPasswordFields(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      if (error.response && error.response.status === 401) {
        setNotification({
          open: true,
          message: 'Profile cannot be modified, contact admin.',
          severity: 'error',
        });
      } else {
        setNotification({
          open: true,
          message: 'An error occurred. Please try again later.',
          severity: 'error',
        });
      }
    }
  };

  const handleNotificationClose = () => {
    setNotification({ ...notification, open: false });
  };

  const isAdmin = user && user.role === 'admin';

  // Define navigation links here to pass to Sidebar
  const navigationLinks = [
    {
      header: 'Manage My Account',
      links: [
        {
          name: 'My Profile',
          section: 'profile',
          active: activeSection === 'profile',
        },
        {
          name: 'Address Book',
          section: 'address-book',
          active: activeSection === 'address-book',
        },
        {
          name: 'My Payment Options',
          section: 'payment-options',
          active: activeSection === 'payment-options',
        },
      ],
    },
    {
      header: 'My Orders',
      links: [
        {
          name: 'My Returns',
          section: 'returns',
          active: activeSection === 'returns',
        },
        {
          name: 'My Cancellations',
          section: 'cancellations',
          active: activeSection === 'cancellations',
        },
        {
          name: 'My Orders',
          section: 'orders',
          active: activeSection === 'orders',
        },
      ],
    },
    {
      header: 'My Wishlist',
      links: [
        {
          name: 'Wishlist',
          section: 'wishlist',
          active: activeSection === 'wishlist',
        },
      ],
    },
  ];

  if (isAdmin) {
    navigationLinks.push({
      header: 'Admin Tools',
      links: [
        {
          name: 'User Management',
          section: 'admin-users',
          active: activeSection === 'admin-users',
        },
        {
          name: 'Site Analytics',
          section: 'admin-analytics',
          active: activeSection === 'admin-analytics',
        },
        {
          name: 'Product Management',
          section: 'admin-products',
          active: activeSection === 'admin-products',
        },
        {
          name: 'Category Management',
          section: 'admin-categories',
          active: activeSection === 'admin-categories',
        },
        {
          name: 'Orders Management',
          section: 'admin-orders',
          active: activeSection === 'admin-orders',
        },
      ],
    });
  }

  const renderSectionContent = () => (
    <Suspense
      fallback={
        <Box sx={{ mt: 4 }}>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </Box>
      }
    >
      {(() => {
        switch (activeSection) {
          case 'profile':
            return (
              <ProfileSection
                formData={formData}
                errors={errors}
                showPasswordFields={showPasswordFields}
                showNewPassword={showNewPassword}
                showConfirmNewPassword={showConfirmNewPassword}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
                handleCancel={handleCancel}
                setShowPasswordFields={setShowPasswordFields}
                setShowNewPassword={setShowNewPassword}
                setShowConfirmNewPassword={setShowConfirmNewPassword}
                defaultAvatarUrl={defaultAvatarUrl}
              />
            );
          case 'address-book':
            return <AddressBookSection />;
          case 'payment-options':
            return <PaymentOptionsSection />;
          case 'orders':
            return <OrdersSection />;
          case 'wishlist':
            return <WishlistSection />;
          case 'returns':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  My Returns
                </Typography>
                <Typography variant="body1">
                  View or initiate product returns.
                </Typography>
              </>
            );
          case 'cancellations':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  My Cancellations
                </Typography>
                <Typography variant="body1">
                  Check the status of your cancellations.
                </Typography>
              </>
            );
          case 'admin-users':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  User Management (Admin)
                </Typography>
                <Typography variant="body1">
                  Manage users of the platform.
                </Typography>
              </>
            );
          case 'admin-analytics':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Site Analytics (Admin)
                </Typography>
                <Typography variant="body1">
                  View site traffic, sales, and more.
                </Typography>
              </>
            );
          case 'admin-products':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Product Management (Admin)
                </Typography>
                <Typography variant="body1">
                  Add, edit, or remove products.
                </Typography>
              </>
            );
          case 'admin-categories':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Category Management (Admin)
                </Typography>
                <Typography variant="body1">
                  Manage product categories.
                </Typography>
              </>
            );
          case 'admin-orders':
            return (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Orders Management (Admin)
                </Typography>
                <Typography variant="body1">
                  View and manage all customer orders.
                </Typography>
              </>
            );
          default:
            return <Typography variant="body1">Coming soon...</Typography>;
        }
      })()}
    </Suspense>
  );

  return (
    <Box
      sx={{
        backgroundColor: '#f2f2f2',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        navigationLinks={navigationLinks}
        isMobile={isMobile}
      />

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          px: 3,
          pb: 5,
        }}
      >
        {renderSectionContent()}
        <Notification
          open={notification.open}
          onClose={handleNotificationClose}
          severity={notification.severity}
          message={notification.message}
        />
      </Box>
    </Box>
  );
};

export default ProfilePage;
