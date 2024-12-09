// src/pages/ProfilePage.js
import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';
import Notification from '../notification/notification';
import '../styles/profilePage.css';

import { Container, Row, Col } from 'react-bootstrap';
import {
  TextField,
  Button,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  InputAdornment,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { Visibility, VisibilityOff, Menu } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const ProfilePage = () => {
  const { user, accessToken, loading, updateUser } = useContext(AuthContext);

  const [activeSection, setActiveSection] = useState('profile');
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const defaultAvatarUrl = 'https://imgur.com/a/kIaFC3J';

  // Form State
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

  // Validation State
  const [errors, setErrors] = useState({});

  // Password Section Toggle
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Drawer State for Mobile
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear errors on change
    setErrors({ ...errors, [name]: '' });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }

    // Validate password fields if they are shown
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

  const renderNavigation = () => (
    <>
      {navigationLinks.map((section, index) => (
        <div key={index}>
          <Typography variant="subtitle1" className="nav-section-header">
            {section.header}
          </Typography>
          <List component="nav">
            {section.links.map((link, idx) => (
              <ListItem
                button
                key={idx}
                className={`nav-link ${link.active ? 'nav-link-active' : ''}`}
                onClick={() => {
                  setActiveSection(link.section);
                  if (isMobile) setDrawerOpen(false);
                }}
              >
                <ListItemText primary={link.name} />
              </ListItem>
            ))}
          </List>
          {index < navigationLinks.length - 1 && (
            <Divider className="custom-divider" />
          )}
        </div>
      ))}
    </>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Personal Information
            </Typography>
            <div className="avatar-container">
              <img
                src={formData.avatar || defaultAvatarUrl}
                alt="User Avatar"
                className="avatar-preview"
                onError={(e) => {
                  e.target.src = defaultAvatarUrl;
                }}
              />
            </div>
            <form onSubmit={handleSubmit} className="profile-form">
              <Row>
                <Col md={6}>
                  <TextField
                    label="First Name"
                    name="firstName"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={formData.firstName}
                    onChange={handleChange}
                    error={!!errors.firstName}
                    helperText={errors.firstName}
                  />
                </Col>
                <Col md={6}>
                  <TextField
                    label="Last Name"
                    name="lastName"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </Col>
              </Row>
              <TextField
                label="Email"
                name="email"
                variant="outlined"
                fullWidth
                margin="normal"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
              />
              <TextField
                label="Address"
                name="address"
                variant="outlined"
                fullWidth
                margin="normal"
                value={formData.address}
                onChange={handleChange}
              />
              <TextField
                label="Avatar URL"
                name="avatar"
                variant="outlined"
                fullWidth
                margin="normal"
                value={formData.avatar}
                onChange={handleChange}
              />

              <Divider className="custom-divider" />
              <Typography variant="h6" className="section-subheader">
                Security
              </Typography>
              <Button
                variant="contained"
                className="change-password-button"
                onClick={() => setShowPasswordFields(!showPasswordFields)}
              >
                {showPasswordFields
                  ? 'Hide Password Fields'
                  : 'Change Password'}
              </Button>

              {showPasswordFields && (
                <>
                  <TextField
                    label="Current Password (not required by API)"
                    name="currentPassword"
                    type="password"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    placeholder="Enter current password (not enforced)"
                  />
                  <TextField
                    label="New Password"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={formData.newPassword}
                    onChange={handleChange}
                    error={!!errors.confirmNewPassword}
                    helperText={errors.confirmNewPassword || ''}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            edge="end"
                          >
                            {showNewPassword ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Confirm New Password"
                    name="confirmNewPassword"
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={formData.confirmNewPassword}
                    onChange={handleChange}
                    error={!!errors.confirmNewPassword}
                    helperText={errors.confirmNewPassword || ''}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() =>
                              setShowConfirmNewPassword(!showConfirmNewPassword)
                            }
                            edge="end"
                          >
                            {showConfirmNewPassword ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </>
              )}

              <div className="form-actions">
                <Button
                  variant="text"
                  onClick={handleCancel}
                  className="cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  className="save-button"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </>
        );
      case 'address-book':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Address Book
            </Typography>
            <Typography variant="body1">
              Manage your saved addresses here.
            </Typography>
            {/* Future functionality for adding/editing addresses */}
          </>
        );
      case 'payment-options':
        return (
          <>
            <Typography variant="h5" className="section-header">
              My Payment Options
            </Typography>
            <Typography variant="body1">
              Add or manage your payment methods.
            </Typography>
            {/* Future functionality for payment methods */}
          </>
        );
      case 'returns':
        return (
          <>
            <Typography variant="h5" className="section-header">
              My Returns
            </Typography>
            <Typography variant="body1">
              View or initiate product returns.
            </Typography>
            {/* Future functionality for returns */}
          </>
        );
      case 'cancellations':
        return (
          <>
            <Typography variant="h5" className="section-header">
              My Cancellations
            </Typography>
            <Typography variant="body1">
              Check the status of your cancellations.
            </Typography>
            {/* Future functionality for cancellations */}
          </>
        );
      case 'wishlist':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Wishlist
            </Typography>
            <Typography variant="body1">
              View items you've saved for later.
            </Typography>
            {/* Future functionality for wishlist */}
          </>
        );
      case 'admin-users':
        return (
          <>
            <Typography variant="h5" className="section-header">
              User Management (Admin)
            </Typography>
            <Typography variant="body1">
              Manage users of the platform.
            </Typography>
            {/* Future functionality for admin user management */}
          </>
        );
      case 'admin-analytics':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Site Analytics (Admin)
            </Typography>
            <Typography variant="body1">
              View site traffic, sales, and more.
            </Typography>
            {/* Future analytics dashboard */}
          </>
        );
      case 'admin-products':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Product Management (Admin)
            </Typography>
            <Typography variant="body1">
              Add, edit, or remove products.
            </Typography>
            {/* Future product management tools */}
          </>
        );
      case 'admin-categories':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Category Management (Admin)
            </Typography>
            <Typography variant="body1">Manage product categories.</Typography>
            {/* Future category management tools */}
          </>
        );
      case 'admin-orders':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Orders Management (Admin)
            </Typography>
            <Typography variant="body1">
              View and manage all customer orders.
            </Typography>
            {/* Future orders management tools */}
          </>
        );
      default:
        return <Typography variant="body1">Coming soon...</Typography>;
    }
  };

  return (
    <div>
      {isMobile && (
        <Container className="profile-page-container">
          <div className="mobile-header">
            <IconButton
              aria-label="Open navigation menu"
              className="mobile-menu-icon"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu />
            </IconButton>
            <Typography variant="h6" className="mobile-header-title">
              Profile
            </Typography>
          </div>
        </Container>
      )}

      <Container className="profile-page-container">
        <Row>
          {!isMobile && (
            <Col md={3} className="sidebar-navigation">
              {renderNavigation()}
            </Col>
          )}

          <Col md={isMobile ? 12 : 9}>{renderSectionContent()}</Col>
        </Row>
        <Notification
          open={notification.open}
          onClose={handleNotificationClose}
          severity={notification.severity}
          message={notification.message}
        />
      </Container>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="drawer-style"
      >
        <div className="drawer-content">{renderNavigation()}</div>
      </Drawer>
    </div>
  );
};

export default ProfilePage;
