// src/components/layout/Sidebar.js

import React, { useState, useContext } from 'react';
import logo from '../../images/logo.png';
import {
  Box,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Skeleton,
  Avatar,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  FiMenu,
  FiUser,
  FiHome,
  FiShoppingCart,
  FiBox,
  FiUsers,
  FiMessageSquare,
  FiHelpCircle,
  FiLogOut,
  FiChevronLeft,
  FiExternalLink,
  FiCreditCard,
  FiBarChart2,
  FiFileText,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const defaultAvatarUrl = 'https://i.imgur.com/kIaFC3J.png';

const Sidebar = ({ activeSection, setActiveSection }) => {
  const { user, loading, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine if the user is an admin
  const isAdmin = user && user.role === 'admin';

  // Define full menu items, marking some as admin-only
  const fullMenuItems = [
    { label: 'Dashboard', icon: <FiHome size={20} />, section: 'dashboard' },
    { label: 'Profile', icon: <FiUser size={20} />, section: 'profile' },
    { label: 'Orders', icon: <FiShoppingCart size={20} />, section: 'orders' },
    {
      label: 'Payments',
      icon: <FiCreditCard size={20} />,
      section: 'payment-options',
    },
    {
      label: 'Messages',
      icon: <FiMessageSquare size={20} />,
      section: 'messages',
    },
    // Admin-only items
    {
      label: 'Products',
      icon: <FiBox size={20} />,
      section: 'products',
      adminOnly: true,
    },
    {
      label: 'Customers',
      icon: <FiUsers size={20} />,
      section: 'customers',
      adminOnly: true,
    },
    {
      label: 'Invoices',
      icon: <FiFileText size={20} />,
      section: 'invoices',
      adminOnly: true,
    },
    {
      label: 'Reports',
      icon: <FiBarChart2 size={20} />,
      section: 'reports',
      adminOnly: true,
    },
    {
      label: 'Help Center',
      icon: <FiHelpCircle size={20} />,
      section: 'help-center',
    },
  ];

  // Filter out admin-only items if the user is not an admin
  const menuItems = fullMenuItems.filter((item) => !item.adminOnly || isAdmin);

  const logoutItem = {
    label: 'Logout',
    icon: <FiLogOut size={20} />,
    section: 'logout',
  };

  // Function to handle navigation item clicks
  const handleNavItemClick = (item) => {
    const url = new URL(window.location);
    url.searchParams.set('section', item.section);
    window.history.pushState({}, '', url);
    setActiveSection(item.section);
    if (isMobile) setDrawerOpen(false);
  };

  // Function to handle Logout
  const logoutClick = () => {
    logout();
    navigate('/login');
  };

  // Render individual link items
  const renderLinkItem = (item) => {
    const isLogout = item.section === 'logout';
    const onClick = isLogout ? logoutClick : () => handleNavItemClick(item);

    return (
      <ListItem
        button
        key={item.section}
        onClick={onClick}
        sx={{
          color:
            activeSection === item.section
              ? theme.palette.primary.main
              : theme.palette.text.primary,
          fontSize: '0.875rem',
          py: 1.5,
          px: 2,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
            color: theme.palette.primary.dark,
          },
        }}
      >
        {sidebarCollapsed ? (
          <Tooltip title={item.label} placement="right">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {item.icon}
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1.5 }}>
            {item.icon}
          </Box>
        )}
        {!sidebarCollapsed && (
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              variant: 'body2',
              color: 'text.primary',
            }}
          />
        )}
      </ListItem>
    );
  };

  // Render the navigation drawer content
  const renderNavigation = () => (
    <Box
      sx={{
        width: sidebarCollapsed ? '70px' : '260px',
        transition: 'width 0.3s',
        overflowY: 'auto',
        height: '100%',
        backgroundColor: theme.palette.background.default,
        borderRight: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Header (logo + toggle) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {!sidebarCollapsed && (
          <Box display="flex" alignItems="center">
            <img
              src={logo}
              alt="Logo"
              style={{ width: '40px', marginRight: '10px' }}
            />
            <Typography variant="h6" component="div" color="text.primary">
              Carlos' Shop
            </Typography>
          </Box>
        )}
        <IconButton
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label="toggle sidebar"
          sx={{ ml: sidebarCollapsed ? 0 : 1 }}
        >
          {sidebarCollapsed ? <FiMenu /> : <FiChevronLeft />}
        </IconButton>
      </Box>

      {/* Profile Section */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        }}
      >
        {loading ? (
          <>
            <Skeleton variant="circular" width={60} height={60} />
            {!sidebarCollapsed && (
              <Skeleton variant="text" width={120} sx={{ ml: 2 }} />
            )}
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: sidebarCollapsed ? 'column' : 'row',
              alignItems: 'center',
            }}
          >
            <Avatar
              src={user?.avatar || defaultAvatarUrl}
              alt="User Avatar"
              sx={{
                width: sidebarCollapsed ? 40 : 60,
                height: sidebarCollapsed ? 40 : 60,
              }}
              imgProps={{
                onError: (e) => {
                  e.currentTarget.src = defaultAvatarUrl;
                },
              }}
            />
            {!sidebarCollapsed && (
              <Box sx={{ ml: 2 }}>
                <Typography
                  variant="subtitle1"
                  color="text.primary"
                  fontWeight="bold"
                >
                  {user?.name || 'Anonymous'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.role
                    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                    : 'No Role'}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Menu Items */}
      <Box sx={{ flexGrow: 1 }}>
        <List sx={{ mt: 1 }}>
          {menuItems.map((item) => renderLinkItem(item))}
        </List>
      </Box>

      {/* Logout + "Visit Shop" */}
      <Box sx={{ pb: 2 }}>
        <List>{renderLinkItem(logoutItem)}</List>
        {!sidebarCollapsed && (
          <Box sx={{ px: 2, mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<FiExternalLink />}
              onClick={() => navigate('/')}
              sx={{
                width: '100%',
                textTransform: 'none',
                borderRadius: 2,
                color: theme.palette.common.white,
                backgroundColor: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              Visit Shop
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {/* Temporary Drawer for Mobile */}
      {isMobile && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: sidebarCollapsed ? '70px' : '260px',
              boxShadow: 2,
              transition: 'width 0.3s',
            },
          }}
        >
          {renderNavigation()}
        </Drawer>
      )}

      {/* Persistent Sidebar for Larger Screens */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: sidebarCollapsed ? '70px' : '260px',
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: sidebarCollapsed ? '70px' : '260px',
              boxSizing: 'border-box',
              transition: 'width 0.3s',
            },
          }}
        >
          {renderNavigation()}
        </Drawer>
      )}

      {/* Hamburger Menu Icon for Mobile */}
      {isMobile &&
        !drawerOpen && ( // Render only when Drawer is closed
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{
              position: 'fixed',
              top: theme.spacing(2),
              left: theme.spacing(2),
              zIndex: theme.zIndex.drawer,
              color: theme.palette.text.primary,
            }}
          >
            <FiMenu />
          </IconButton>
        )}
    </>
  );
};

export default Sidebar;
