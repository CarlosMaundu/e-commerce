// src/components/profile/users/ManageRolesTab.js
import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import { FiTrash2 as DeleteIcon } from 'react-icons/fi';

const ManageRolesTab = () => {
  const [roles, setRoles] = useState([
    { id: 1, name: 'Admin', permissions: 'Full Access' },
    { id: 2, name: 'Editor', permissions: 'Edit Content' },
  ]);
  const [newRole, setNewRole] = useState({ name: '', permissions: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewRole((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRole = (e) => {
    e.preventDefault();
    setRoles((prev) => [...prev, { ...newRole, id: prev.length + 1 }]);
    setNewRole({ name: '', permissions: '' });
  };

  const handleDeleteRole = (id) => {
    setRoles((prev) => prev.filter((role) => role.id !== id));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Manage Roles
      </Typography>
      <Box
        component="form"
        onSubmit={handleAddRole}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}
      >
        <TextField
          label="Role Name"
          name="name"
          value={newRole.name}
          onChange={handleChange}
          required
        />
        <TextField
          label="Permissions"
          name="permissions"
          value={newRole.permissions}
          onChange={handleChange}
          required
        />
        <Button type="submit" variant="contained" sx={{ mt: 2 }}>
          Add Role
        </Button>
      </Box>
      <List>
        {roles.map((role) => (
          <ListItem key={role.id} sx={{ borderBottom: '1px solid #ddd' }}>
            <ListItemText
              primary={role.name}
              secondary={`Permissions: ${role.permissions}`}
            />
            <IconButton edge="end" onClick={() => handleDeleteRole(role.id)}>
              <DeleteIcon />
            </IconButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ManageRolesTab;
