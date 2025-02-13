// src/components/profile/users/UsersSection.js
import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  FiUsers as UsersIcon,
  FiUserPlus as UserPlusIcon,
  FiShield as RolesIcon,
} from 'react-icons/fi';

import AllUsersTab from './AllUsersTab';
import ManageUserTab from './ManageUserTab';
import ManageRolesTab from './ManageRolesTab';

const UsersSection = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeTab, setActiveTab] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
    setCurrentUser(null);
  };

  const navigateToManageUser = (user = null) => {
    setCurrentUser(user);
    setActiveTab(1);
  };

  return (
    <Box sx={{ width: '100%', px: 0, py: 0 }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant={isMobile ? 'scrollable' : 'fullWidth'}
        scrollButtons={isMobile ? 'auto' : false}
        aria-label="Users Management Tabs"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tab
          icon={<UsersIcon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              All Users
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 120,
            height: 48,
            fontWeight: activeTab === 0 ? 'bold' : 'normal',
            color: activeTab === 0 ? 'primary.main' : 'text.secondary',
          }}
        />
        <Tab
          icon={<UserPlusIcon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              Manage User
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 150,
            height: 48,
            fontWeight: activeTab === 1 ? 'bold' : 'normal',
            color: activeTab === 1 ? 'primary.main' : 'text.secondary',
          }}
        />
        <Tab
          icon={<RolesIcon size={20} />}
          label={
            <Typography variant="h6" color="text.primary">
              Manage Roles
            </Typography>
          }
          sx={{
            textTransform: 'none',
            minWidth: isMobile ? 'auto' : 150,
            height: 48,
            fontWeight: activeTab === 2 ? 'bold' : 'normal',
            color: activeTab === 2 ? 'primary.main' : 'text.secondary',
          }}
        />
      </Tabs>

      {activeTab === 0 && (
        <AllUsersTab navigateToManageUser={navigateToManageUser} />
      )}
      {activeTab === 1 && (
        <ManageUserTab
          currentUser={currentUser}
          navigateToManageUser={navigateToManageUser}
        />
      )}
      {activeTab === 2 && <ManageRolesTab />}
    </Box>
  );
};

export default UsersSection;
