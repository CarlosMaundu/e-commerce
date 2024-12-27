// src/components/layout/Sidebar.js
import React, { useState, useContext } from 'react';
import {
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Drawer,
  Box,
  Tooltip,
  Skeleton,
  Avatar,
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
  UploadFile,
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext'; // Corrected path

const defaultAvatarUrl = 'https://i.imgur.com/kIaFC3J.png';

const Sidebar = ({
  activeSection,
  setActiveSection,
  navigationLinks,
  isMobile,
}) => {
  const { user, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Section: Avatar and Email */}
      <Box>
        {/* Avatar and Email Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 3,
            px: 2,
          }}
        >
          {loading ? (
            <>
              <Skeleton variant="circular" width={80} height={80} />
              <Skeleton variant="text" width={120} sx={{ mt: 1 }} />
            </>
          ) : (
            <>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Avatar
                  src={user?.avatar || defaultAvatarUrl}
                  alt="User Avatar"
                  sx={{
                    width: sidebarCollapsed ? 50 : 80,
                    height: sidebarCollapsed ? 50 : 80,
                    transition: 'width 0.3s, height 0.3s',
                  }}
                  imgProps={{
                    onError: (e) => {
                      e.currentTarget.src = defaultAvatarUrl;
                    },
                  }}
                />
                {!sidebarCollapsed && (
                  <Tooltip title="Upload Avatar">
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: 'white',
                        boxShadow: 1,
                        '&:hover': { backgroundColor: '#f0f0f0' },
                      }}
                      onClick={() =>
                        alert('Avatar upload functionality not yet implemented')
                      }
                      aria-label="Upload avatar"
                    >
                      <UploadFile fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {!sidebarCollapsed && (
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {user?.email || 'No Email'}
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* Navigation Links */}
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
            {/* Corrected Conditional Rendering for Divider */}
            {index < navigationLinks.length - 1 && (
              <Divider sx={{ mt: 3, mb: 2 }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Bottom Section: Sidebar Toggle */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
          px: 2,
          mb: 2,
        }}
      >
        <Tooltip
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <IconButton
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            <Menu />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <>
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

      {/* Sidebar for non-mobile */}
      {!isMobile && (
        <Box
          sx={{
            backgroundColor: '#fff',
            boxShadow: 2,
            fontFamily: 'sans-serif',
            overflow: 'auto',
            minWidth: sidebarCollapsed ? '70px' : '250px',
            transition: 'width 0.3s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {renderNavigation()}
        </Box>
      )}
    </>
  );
};

export default Sidebar;
