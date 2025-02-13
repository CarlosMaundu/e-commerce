// src/components/profile/users/AllUserTab.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  IconButton,
  Pagination,
  useTheme,
  useMediaQuery,
  Chip,
  Typography,
  Skeleton,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import { FiEye, FiEdit, FiTrash2 } from 'react-icons/fi';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import ViewUserModal from '../../common/ViewUserModal';
import Notification from '../../../notification/notification';
import { getAllUsers, deleteUser } from '../../../services/userService';
import placeholderImage from '../../../images/placeholder.jpg';

const DEFAULT_AVATAR_URL = 'https://i.imgur.com/kIaFC3J.png';

const AllUsersTab = ({ navigateToManageUser }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Fetch all users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getAllUsers(); // API call to fetch all users
        // Normalize avatars
        const normalizedUsers = data.map((user) => ({
          ...user,
          avatar: user.avatar || DEFAULT_AVATAR_URL,
        }));
        setUsers(normalizedUsers);
      } catch (err) {
        setNotification({
          open: true,
          message: 'Failed to fetch users.',
          severity: 'error',
        });
      }
    };
    loadUsers();
  }, []);

  // Filtered and paginated users
  const processedUsers = useMemo(() => {
    let filteredUsers = [...users];

    // Apply role filter
    if (filters.role) {
      filteredUsers = filteredUsers.filter(
        (user) => user.role === filters.role
      );
    }

    // Apply status filter
    if (filters.status) {
      const isActive = filters.status === 'active';
      filteredUsers = filteredUsers.filter((user) => user.active === isActive);
    }

    // Apply search filter
    if (filters.search) {
      filteredUsers = filteredUsers.filter((user) =>
        user.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    return filteredUsers.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
  }, [users, filters, currentPage, rowsPerPage]);

  const totalUsers = useMemo(() => {
    let count = users.length;

    if (filters.role) {
      count = users.filter((user) => user.role === filters.role).length;
    }

    if (filters.status) {
      const isActive = filters.status === 'active';
      count = users.filter((user) => user.active === isActive).length;
    }

    if (filters.search) {
      count = users.filter((user) =>
        user.name.toLowerCase().includes(filters.search.toLowerCase())
      ).length;
    }

    return count;
  }, [users, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(selectedUsers.map((id) => deleteUser(id)));
      setNotification({
        open: true,
        message: 'User(s) deleted successfully.',
        severity: 'success',
      });
      setUsers((prev) =>
        prev.filter((user) => !selectedUsers.includes(user.id))
      );
      setSelectedUsers([]);
    } catch (err) {
      setNotification({
        open: true,
        message: 'Failed to delete user(s).',
        severity: 'error',
      });
    } finally {
      setIsDeleting(false);
      setConfirmationOpen(false);
    }
  };

  const handleViewUser = (user) => {
    setViewUser(user);
    setViewOpen(true);
  };

  const handlePageChange = (_, value) => {
    setCurrentPage(value);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const isAllSelected =
    processedUsers.length > 0 && selectedUsers.length === processedUsers.length;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = processedUsers.map((user) => user.id);
      setSelectedUsers(allIds);
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (e, id) => {
    if (e.target.checked) {
      setSelectedUsers((prev) => [...prev, id]);
    } else {
      setSelectedUsers((prev) => prev.filter((uid) => uid !== id));
    }
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.default,
        borderRadius: 3,
        px: 0,
        py: 0,
      }}
    >
      <Box sx={{ px: isMobile ? 1 : 0, py: isMobile ? 1 : 2 }}>
        <Box
          sx={{
            mb: 2,
            px: 2,
            py: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  value={filters.role}
                  onChange={handleFilterChange}
                  label="Role"
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="customer">Customer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  label="Status"
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                placeholder="Search by name..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                  }))
                }
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, fontSize: '1rem' }} />
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2} />
            <Grid item xs={12} sm={2} sx={{ textAlign: 'right' }}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<AddIcon />}
                onClick={navigateToManageUser}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  height: '100%',
                }}
              >
                Add User
              </Button>
            </Grid>
          </Grid>
        </Box>
        <Box
          sx={{
            px: 2,
            py: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          {users.length === 0 ? (
            <Box>
              {Array.from({ length: rowsPerPage }).map((_, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Skeleton variant="rectangular" height={50} />
                </Box>
              ))}
            </Box>
          ) : (
            <Box>
              {/* Top Bar: total users + bulk delete if selected */}
              <Box
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.75rem' }}>
                  Total Users: {totalUsers}
                </Typography>

                {selectedUsers.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ fontSize: '0.75rem' }}>
                      {selectedUsers.length} selected
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<FiTrash2 />}
                      onClick={() => setConfirmationOpen(true)}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.75rem',
                      }}
                    >
                      Delete Selected
                    </Button>
                  </Box>
                )}
              </Box>

              <TableContainer component={Paper}>
                <Table aria-label="users table">
                  <TableHead>
                    <TableRow>
                      <TableCell align="left" sx={{ padding: '8px' }}>
                        <Checkbox
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          inputProps={{
                            'aria-label': 'select all users',
                          }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        User
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        Role
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        ID
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        Email
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        Phone
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        Status
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '8px',
                        }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processedUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        hover
                        selected={selectedUsers.includes(user.id)}
                      >
                        <TableCell align="left" sx={{ padding: '8px' }}>
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onChange={(e) => handleSelectUser(e, user.id)}
                            inputProps={{
                              'aria-label': `select user ${user.name}`,
                            }}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="left" sx={{ padding: '8px' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box
                              component="img"
                              src={user.avatar}
                              alt={user.name}
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                e.target.src = placeholderImage;
                              }}
                            />
                            {user.name}
                          </Box>
                        </TableCell>
                        <TableCell
                          align="left"
                          sx={{ padding: '8px', fontSize: '0.75rem' }}
                        >
                          {user.role}
                        </TableCell>
                        <TableCell
                          align="left"
                          sx={{ padding: '8px', fontSize: '0.75rem' }}
                        >
                          {user.id}
                        </TableCell>
                        <TableCell
                          align="left"
                          sx={{ padding: '8px', fontSize: '0.75rem' }}
                        >
                          {user.email}
                        </TableCell>
                        <TableCell
                          align="left"
                          sx={{ padding: '8px', fontSize: '0.75rem' }}
                        >
                          {user.phone || 'N/A'}
                        </TableCell>
                        <TableCell align="left" sx={{ padding: '8px' }}>
                          {user.active ? (
                            <Chip
                              label="Active"
                              variant="outlined"
                              color="success"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Chip
                              label="Inactive"
                              variant="outlined"
                              color="error"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="left" sx={{ padding: '8px' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            {/* View Icon */}
                            <Tooltip title="View">
                              <IconButton
                                onClick={() => handleViewUser(user)}
                                size="small"
                                sx={{ mr: 1 }}
                              >
                                <FiEye
                                  size={16}
                                  color={theme.palette.text.secondary}
                                />
                              </IconButton>
                            </Tooltip>

                            {/* Edit Icon */}
                            <Tooltip title="Edit">
                              <IconButton
                                color="primary"
                                onClick={() => navigateToManageUser(user)}
                                size="small"
                                sx={{ mr: 1 }}
                              >
                                <FiEdit size={16} />
                              </IconButton>
                            </Tooltip>

                            {/* Delete Icon */}
                            <Tooltip title="Delete">
                              <IconButton
                                color="error"
                                onClick={() => {
                                  setSelectedUsers([user.id]);
                                  setConfirmationOpen(true);
                                }}
                                size="small"
                              >
                                <FiTrash2 size={16} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination and Rows per Page controls */}
              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 1,
                }}
              >
                <Pagination
                  count={Math.ceil(totalUsers / rowsPerPage)}
                  page={currentPage}
                  onChange={handlePageChange}
                  variant="outlined"
                  shape="rounded"
                  color="primary"
                  showFirstButton
                  showLastButton
                  size="small"
                  siblingCount={isMobile ? 1 : 2}
                />
                <FormControl
                  variant="outlined"
                  size="small"
                  sx={{ minWidth: 120, mt: isMobile ? 1 : 0 }}
                >
                  <InputLabel>Rows per page</InputLabel>
                  <Select
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    label="Rows per page"
                  >
                    <MenuItem value={5}>5</MenuItem>
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={30}>30</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Deletion"
        content="Are you sure you want to delete the selected user(s)? This action is irreversible."
        onConfirm={handleDelete}
        onCancel={() => setConfirmationOpen(false)}
        loading={isDeleting}
        confirmText="Delete"
        cancelText="Cancel"
      />

      <ViewUserModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        user={viewUser}
        navigateToManageUser={navigateToManageUser} // Pass the function here
      />

      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </Box>
  );
};

export default AllUsersTab;
