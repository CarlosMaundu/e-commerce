// src/pages/ProfilePage.js

import React, {
  useEffect,
  useState,
  useContext,
  Suspense,
  useMemo,
} from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';
import Notification from '../notification/notification';
import {
  Typography,
  Box,
  Skeleton,
  IconButton,
  Badge,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiBell, FiExternalLink } from 'react-icons/fi';

import ProfileSection from '../components/profile/ProfileSection';
import Sidebar from '../components/layout/Sidebar';

// Lazy-loaded sections
const PaymentOptionsSection = React.lazy(
  () => import('../components/profile/PaymentOptionsSection')
);
const OrdersSection = React.lazy(
  () => import('../components/profile/OrdersSection')
);
const ReportsSection = React.lazy(
  () => import('../components/profile/ReportsSection')
);

// Removed unused local declarations
const AdminDashboardSection = React.lazy(
  () => import('../components/profile/AdminDashboardSection')
);
const CustomerDashboardSection = React.lazy(
  () => import('../components/profile/CustomerDashboardSection')
);

const defaultAvatarUrl = 'https://i.imgur.com/kIaFC3J.png';

const ProfilePage = () => {
  const { user, accessToken, loading, updateUser } = useContext(AuthContext);

  // Memoized URLSearchParams to fix ESLint warnings
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  // Default to 'dashboard' or 'profile'—your choice:
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);

  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // -----------
  // FORM STATE
  // -----------
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // -----------
  // CHECK AUTH
  // -----------
  useEffect(() => {
    if (!loading && !user) {
      setNotification({
        open: true,
        message: 'You are not authenticated. Please login.',
        severity: 'error',
      });
    }
  }, [user, loading]);

  // -----------
  // POPULATE FORM
  // -----------
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

  // -----------
  // UPDATE SECTION
  // -----------
  useEffect(() => {
    const section = searchParams.get('section') || 'profile';
    setActiveSection(section);
  }, [searchParams]);

  // -----------
  // VALIDATE
  // -----------
  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (formData.newPassword.trim()) {
      if (formData.newPassword !== formData.confirmNewPassword) {
        newErrors.confirmNewPassword = 'Passwords do not match';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // -----------
  // HANDLE CANCEL
  // -----------
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

  // -----------
  // HANDLE CHANGE
  // -----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // -----------
  // HANDLE SUBMIT
  // -----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const fullName =
      `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

    const updateData = {
      id: formData.id,
      name: fullName,
      email: formData.email,
      avatar: formData.avatar,
      address: formData.address,
      password:
        formData.newPassword.trim() !== '' ? formData.newPassword.trim() : '',
    };

    try {
      const updatedUser = await updateUserProfile(updateData, accessToken);
      updateUser(updatedUser);
      setNotification({
        open: true,
        message: 'Profile updated successfully.',
        severity: 'success',
      });

      if (formData.newPassword.trim() !== '') {
        setFormData((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        }));
      }
      setShowPasswordFields(false);
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

  // -----------
  // NOTIF CLOSE
  // -----------
  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // -----------
  // GET HEADING
  // -----------
  const getHeadingTitle = () => {
    switch (activeSection) {
      case 'dashboard':
        // If user is admin => "Admin Dashboard", else => "My Dashboard"
        return user && user.role === 'admin' ? 'Admin Dashboard' : 'Dashboard';
      case 'profile':
        return 'Profile';
      case 'orders':
        return 'My Orders';
      case 'payment-options':
        return 'Payment Options';
      case 'products':
        return 'Products';
      case 'customers':
        return 'Customers';
      case 'messages':
        return 'Messages';
      case 'reports':
        return 'Reports';
      case 'help-center':
        return 'Help Center';
      default:
        return 'Profile';
    }
  };

  // -----------
  // RENDER SECTIONS
  // -----------
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
        // 1. If user is admin and section = dashboard => AdminDashboard
        // 2. If user is customer and section = dashboard => CustomerDashboard
        // 3. else other sections
        if (activeSection === 'dashboard') {
          return user?.role === 'admin' ? (
            <AdminDashboardSection />
          ) : (
            <CustomerDashboardSection />
          );
        }

        // SWITCH for other sections
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
                setShowNewPassword={setShowNewPassword}
                setShowConfirmNewPassword={setShowConfirmNewPassword}
                defaultAvatarUrl={defaultAvatarUrl}
              />
            );
          case 'orders':
            return <OrdersSection />;
          case 'payment-options':
            return <PaymentOptionsSection />;
          case 'reports':
            return <ReportsSection />;
          // Add more as needed
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
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          px: isMobile ? 1 : 3,
          pb: 5,
          pt: isMobile ? 2 : 3,
          overflowY: 'auto', // Enable scrolling
          height: '100vh', // Ensure full viewport height
        }}
      >
        {/* Top bar with heading, bell icon, and "Visit Shop" */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 1 : 0,
            mb: 2,
          }}
        >
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            sx={{ fontWeight: 'bold', textAlign: isMobile ? 'center' : 'left' }}
          >
            {getHeadingTitle()}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 1,
            }}
          >
            <IconButton>
              <Badge badgeContent={3} color="secondary">
                <FiBell size={20} />
              </Badge>
            </IconButton>
            <Button
              variant="contained"
              startIcon={<FiExternalLink />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
              }}
              onClick={() => navigate('/')}
            >
              Visit Shop
            </Button>
          </Box>
        </Box>

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
