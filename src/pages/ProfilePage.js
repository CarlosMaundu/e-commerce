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
} from '@mui/material';

const ProfilePage = () => {
  const { user, accessToken, loading, updateUser } = useContext(AuthContext);

  const [activeSection, setActiveSection] = useState('profile');

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

  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const defaultAvatarUrl = 'https://imgur.com/a/kIaFC3J';

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
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      formData.newPassword ||
      formData.confirmNewPassword ||
      formData.currentPassword
    ) {
      if (formData.newPassword !== formData.confirmNewPassword) {
        setNotification({
          open: true,
          message: 'New passwords do not match.',
          severity: 'error',
        });
        return;
      }
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
        formData.newPassword && formData.newPassword.trim() !== ''
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
    } catch (error) {
      console.error('Failed to update profile:', error);
      setNotification({
        open: true,
        message: 'An error occurred. Please try again later.',
        severity: 'error',
      });
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

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <>
            <Typography variant="h5" className="section-header">
              Personal Information
            </Typography>

            {/* Avatar Preview */}
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

              <Typography variant="h6" className="section-subheader">
                Password Changes
              </Typography>
              <TextField
                label="Current Password (not required by API)"
                name="currentPassword"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                placeholder="Enter current password (not enforced)"
                value={formData.currentPassword}
                onChange={handleChange}
              />
              <TextField
                label="New Password"
                name="newPassword"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={formData.newPassword}
                onChange={handleChange}
              />
              <TextField
                label="Confirm New Password"
                name="confirmNewPassword"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={formData.confirmNewPassword}
                onChange={handleChange}
              />

              <div className="form-actions">
                <Button
                  variant="text"
                  onClick={handleCancel}
                  sx={{ color: '#6c757d', textTransform: 'none' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  sx={{
                    backgroundColor: '#28a745',
                    textTransform: 'none',
                    '&:hover': { backgroundColor: '#218838' },
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </>
        );
      default:
        // Placeholder content for other sections
        return <Typography variant="body1">Coming soon...</Typography>;
    }
  };

  return (
    <Container className="profile-page-container">
      <Row>
        {/* Left Sidebar */}
        <Col md={3} className="sidebar-navigation">
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
                    onClick={() => setActiveSection(link.section)}
                  >
                    <ListItemText primary={link.name} />
                  </ListItem>
                ))}
              </List>
              {index < navigationLinks.length - 1 && <Divider />}
            </div>
          ))}
        </Col>

        {/* Right Content */}
        <Col md={9}>{renderContent()}</Col>
      </Row>
      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </Container>
  );
};

export default ProfilePage;
