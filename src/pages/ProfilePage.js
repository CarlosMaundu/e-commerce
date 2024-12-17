// src/pages/ProfilePage.js
import React, { useEffect, useState, useContext, Suspense } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';
import Notification from '../notification/notification';

import {
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Drawer,
  useMediaQuery,
  Box,
  Tooltip,
} from '@mui/material';
import {
  Menu,
  AccountCircle,
  Home,
  CreditCard,
  AssignmentReturn,
  Cancel,
  ShoppingCart,
  FavoriteBorder,
  Group,
  Analytics,
  Inventory2,
  Category,
  LocalShipping,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';

import ProfileSection from '../components/profile/ProfileSection';

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

const defaultAvatarUrl = 'https://imgur.com/a/kIaFC3J';

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // for collapsible sidebar
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

  // Icons mapping to reflect e-commerce context
  const sectionIcons = {
    'My Profile': <AccountCircle fontSize="small" />,
    'Address Book': <Home fontSize="small" />,
    'My Payment Options': <CreditCard fontSize="small" />,
    'My Returns': <AssignmentReturn fontSize="small" />,
    'My Cancellations': <Cancel fontSize="small" />,
    'My Orders': <ShoppingCart fontSize="small" />,
    Wishlist: <FavoriteBorder fontSize="small" />,
    'User Management': <Group fontSize="small" />,
    'Site Analytics': <Analytics fontSize="small" />,
    'Product Management': <Inventory2 fontSize="small" />,
    'Category Management': <Category fontSize="small" />,
    'Orders Management': <LocalShipping fontSize="small" />,
  };

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

  const handleNavItemClick = (link) => {
    const url = new URL(window.location);
    url.searchParams.set('section', link.section);
    window.history.pushState({}, '', url);
    setActiveSection(link.section);
    if (isMobile) setDrawerOpen(false);
  };

  const renderLinkItem = (link) => {
    const IconComp = sectionIcons[link.name] || (
      <AccountCircle fontSize="small" />
    );
    return (
      <ListItem
        button
        key={link.section}
        onClick={() => handleNavItemClick(link)}
        sx={{
          color: link.active ? '#0D4ED8' : '#000',
          fontSize: '0.875rem',
          py: 1.5,
          px: 2,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
          },
        }}
      >
        {sidebarCollapsed ? (
          <Tooltip title={link.name} placement="right">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mr: !sidebarCollapsed ? 1.5 : 0,
              }}
            >
              {IconComp}
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1.5 }}>
            {IconComp}
          </Box>
        )}
        {!sidebarCollapsed && (
          <ListItemText
            primary={link.name}
            primaryTypographyProps={{ fontSize: '0.875rem' }}
          />
        )}
      </ListItem>
    );
  };

  const renderNavigation = () => (
    <Box
      sx={{
        width: sidebarCollapsed ? '70px' : '250px',
        transition: 'width 0.3s',
        overflow: 'auto',
        pt: 2,
      }}
    >
      {/* Collapse/Expand button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
          px: 2,
          mb: 3,
        }}
      >
        <IconButton
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label="Toggle sidebar"
        >
          <Menu />
        </IconButton>
      </Box>

      {navigationLinks.map((section, index) => (
        <Box key={index} sx={{ mb: 4 }}>
          {!sidebarCollapsed && (
            <Typography
              variant="subtitle2"
              sx={{
                color: '#1D4ED8',
                fontWeight: 'bold',
                px: 2,
                fontSize: '0.875rem',
              }}
            >
              {section.header}
            </Typography>
          )}
          <List component="nav" sx={{ mt: 1, p: 0 }}>
            {section.links.map((link) => renderLinkItem(link))}
          </List>
          {index < navigationLinks.length - 1 && (
            <Divider sx={{ mt: 3, mb: 2 }} />
          )}
        </Box>
      ))}
    </Box>
  );

  const renderSectionContent = () => (
    <Suspense fallback={<div>Loading...</div>}>
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
        pt: '80px',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {isMobile && (
        <Box sx={{ p: 2, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen(true)}
              sx={{ color: '#333' }}
            >
              <Menu />
            </IconButton>
            <Typography
              variant="h6"
              sx={{ fontWeight: 'bold', color: '#000', ml: 2 }}
            >
              Profile
            </Typography>
          </Box>
        </Box>
      )}

      {/* Drawer for mobile screens */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: sidebarCollapsed ? '70px' : '250px',
            boxShadow: 2,
            fontFamily: 'sans-serif',
            overflow: 'auto',
            transition: 'width 0.3s',
          },
        }}
      >
        {renderNavigation()}
      </Drawer>

      {/* Sidebar for non-mobile (now just part of flex layout, no floating or fixed) */}
      {!isMobile && (
        <Box
          sx={{
            backgroundColor: '#fff',
            boxShadow: 2,
            fontFamily: 'sans-serif',
            overflow: 'auto',
          }}
        >
          {renderNavigation()}
        </Box>
      )}

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
