// src/components/profile/users/ManageUserTab.js

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  IconButton,
  useTheme,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAllUsers,
  createUserThunk,
  updateUserThunk,
} from '../../../redux/usersSlice';
import { uploadFileThunk } from '../../../redux/fileSlice';
import {
  createUserWithEmailAndPassword,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../../../firebase';
import Notification from '../../../notification/notification';
import { FiTrash2, FiEdit } from 'react-icons/fi';
import placeholderImage from '../../../images/placeholder.jpg'; // Adjust path if needed
import { friendlyError } from '../../../utils/friendlyError';

const ManageUserTab = ({
  currentUser, // If null, we are creating a new user
  navigateToManageUser,
  navigateToManageRolesTab,
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const roles = useSelector((state) => state.roles?.list || []);
  const fileInputRef = useRef(null);

  // If editing an existing user, we fill fields from currentUser. Otherwise, blank for creation
  const [user, setUser] = useState(
    currentUser
      ? {
          id: currentUser.id,
          firstName: currentUser.firstName || '',
          lastName: currentUser.lastName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          role: currentUser.role || '',
          avatar: currentUser.avatar || '',
          password: '', // Only used if changing
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          role: '',
          avatar: '',
          password: '',
        }
  );

  // Notification for success/error messages
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(false);
  const [uploadedFileDetails, setUploadedFileDetails] = useState(null);

  // For toggling edit mode if we’re updating an existing user
  // If currentUser is null (i.e. new user creation), we default to editing mode
  // If currentUser is not null, we start in "view" mode
  const [isEditing, setIsEditing] = useState(!currentUser);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchAllUsers());
  }, [dispatch]);

  // If currentUser changes, re-populate user state
  useEffect(() => {
    if (currentUser) {
      setUser((prev) => ({
        ...prev,
        id: currentUser.id,
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        role: currentUser.role || '',
        avatar: currentUser.avatar || '',
        password: '',
      }));
      setIsEditing(false); // We go to "view" mode initially
    } else {
      // brand new user creation
      setIsEditing(true);
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  // Avatar Upload
  const handleFileSelect = async (e) => {
    if (!isEditing) return;
    if (uploadError) return;
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadError(false);

    try {
      const result = await dispatch(
        uploadFileThunk({
          file,
          onProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          },
        })
      ).unwrap();

      setUser((prev) => ({ ...prev, avatar: result.location }));
      setUploadedFileDetails({
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        status: 'File Successfully Uploaded',
      });
      setNotification({
        open: true,
        message: 'Avatar uploaded successfully!',
        severity: 'success',
      });
    } catch (err) {
      setUploadError(true);
      setUploadedFileDetails({
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        status: 'File Failed to Upload',
      });
      setNotification({
        open: true,
        message: 'Failed to upload avatar.',
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUploadedFile = () => {
    if (!isEditing) return;
    setUploadedFileDetails(null);
    setUser((prev) => ({ ...prev, avatar: '' }));
    setUploadError(false);
  };

  const handleUploadClick = () => {
    if (!isEditing) return;
    fileInputRef.current.click();
  };

  // Toggling from "view" to "edit"
  const handleEditClick = () => {
    setIsEditing(true);
  };

  // Cancel → revert changes and if we are editing an existing user, go back to "view" mode
  // If it’s a brand-new user, call navigateToManageUser() to close
  const handleCancel = () => {
    if (currentUser) {
      // revert fields
      setUser({
        id: currentUser.id,
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        role: currentUser.role || '',
        avatar: currentUser.avatar || '',
        password: '',
      });
      setIsEditing(false);
    } else {
      // brand-new user → close
      navigateToManageUser(null);
    }
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (!currentUser) {
        // Creating a brand-new user
        // 1) Create in Firebase
        const result = await createUserWithEmailAndPassword(
          auth,
          user.email,
          user.password
        );
        const fbUser = result.user;

        // 2) Update Firebase displayName
        await updateProfile(fbUser, {
          displayName: `${user.firstName} ${user.lastName}`,
        });

        // 3) Create in external API
        await dispatch(
          createUserThunk({
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone,
            role: user.role,
            avatar: user.avatar,
          })
        ).unwrap();

        setNotification({
          open: true,
          message: 'User created successfully!',
          severity: 'success',
        });
        // Done: close the panel
        navigateToManageUser(null);
      } else {
        // Editing an existing user
        const updateData = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
        };

        // If the admin typed a new password, update in Firebase
        if (user.password.trim()) {
          try {
            await updatePassword(auth.currentUser, user.password.trim());
          } catch (err) {
            // If we want, we can handle reauth for "credential too old"
            setNotification({
              open: true,
              message: friendlyError(err),
              severity: 'error',
            });
            setIsSaving(false);
            return;
          }
        }

        // Then update external API
        await dispatch(
          updateUserThunk({ id: currentUser.id, data: updateData })
        ).unwrap();

        setNotification({
          open: true,
          message: 'User updated successfully!',
          severity: 'success',
        });
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error saving user:', err);
      setNotification({
        open: true,
        message: friendlyError(err) || 'Failed to save user.',
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Card sx={{ p: 2, boxShadow: 1, borderRadius: 2 }}>
        <CardActions
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1,
          }}
        >
          <Typography variant="h5" sx={{ ml: 1 }}>
            {currentUser ? 'Manage User' : 'Add User'}
          </Typography>

          {/* Show Edit button if we have a currentUser and we're not editing */}
          {currentUser && !isEditing && (
            <Button
              variant="contained"
              startIcon={<FiEdit />}
              onClick={handleEditClick}
              sx={{ textTransform: 'none' }}
            >
              Edit
            </Button>
          )}
        </CardActions>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    User Information
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="First Name"
                        name="firstName"
                        value={user.firstName}
                        onChange={handleChange}
                        required
                        variant="outlined"
                        fullWidth
                        size="small"
                        InputProps={{
                          readOnly: !isEditing,
                          style: {
                            pointerEvents: !isEditing ? 'none' : 'auto',
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Last Name"
                        name="lastName"
                        value={user.lastName}
                        onChange={handleChange}
                        required
                        variant="outlined"
                        fullWidth
                        size="small"
                        InputProps={{
                          readOnly: !isEditing,
                          style: {
                            pointerEvents: !isEditing ? 'none' : 'auto',
                          },
                        }}
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={user.email}
                    onChange={handleChange}
                    required
                    variant="outlined"
                    fullWidth
                    size="small"
                    disabled={!!currentUser} // can't change email if editing existing user
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Phone"
                    name="phone"
                    value={user.phone}
                    onChange={handleChange}
                    required
                    variant="outlined"
                    fullWidth
                    size="small"
                    sx={{ mb: 2 }}
                    InputProps={{
                      readOnly: !isEditing,
                      style: { pointerEvents: !isEditing ? 'none' : 'auto' },
                    }}
                  />
                  {/* Only show Password field if new user OR we want to let admin set new password */}
                  {(!currentUser || isEditing) && (
                    <TextField
                      label="Password"
                      name="password"
                      type="password"
                      value={user.password}
                      onChange={handleChange}
                      // new user -> required, else optional for existing user
                      required={!currentUser}
                      variant="outlined"
                      fullWidth
                      size="small"
                      sx={{ mb: 2 }}
                      InputProps={{
                        readOnly: !isEditing && !!currentUser,
                        style: {
                          pointerEvents:
                            !isEditing && currentUser ? 'none' : 'auto',
                        },
                      }}
                      helperText={
                        currentUser
                          ? 'Leave blank to keep current password'
                          : ''
                      }
                    />
                  )}
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Role Assignment
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small" disabled={!isEditing}>
                        <InputLabel>Role</InputLabel>
                        <Select
                          name="role"
                          value={user.role || ''}
                          onChange={handleChange}
                          label="Role"
                        >
                          <MenuItem value="">
                            <em>Select Role</em>
                          </MenuItem>
                          {roles.map((role) => (
                            <MenuItem key={role.id} value={role.id}>
                              {role.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={navigateToManageRolesTab}
                        sx={{
                          textTransform: 'capitalize',
                          whiteSpace: 'nowrap',
                        }}
                        disabled={!isEditing}
                      >
                        Add Role
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Avatar
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      height: 220,
                      border: '1px solid #ccc',
                      borderRadius: 2,
                      overflow: 'hidden',
                      mb: 2,
                      cursor: isEditing ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      opacity: isEditing ? 1 : 0.7,
                    }}
                    onClick={isEditing ? handleUploadClick : undefined}
                  >
                    {uploading ? (
                      <Box sx={{ width: '100%', height: '80px' }}>
                        <Typography variant="body2" color="text.secondary">
                          Uploading...
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={uploadProgress}
                          sx={{ mt: 1, width: '100%' }}
                        />
                      </Box>
                    ) : user.avatar ? (
                      <img
                        src={user.avatar}
                        alt="Avatar"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.target.src = placeholderImage;
                        }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No avatar
                      </Typography>
                    )}
                  </Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  {uploadedFileDetails && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 1,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'primary.main',
                            fontWeight: 'bold',
                          }}
                        >
                          {uploadedFileDetails.fileName}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'grey.600', fontSize: '0.75rem' }}
                        >
                          {uploadedFileDetails.fileSize}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: uploadedFileDetails.status.includes(
                              'Successfully'
                            )
                              ? 'success.main'
                              : 'error.main',
                          }}
                        >
                          {uploadedFileDetails.status}
                        </Typography>
                      </Box>
                      <IconButton
                        color="error"
                        onClick={handleDeleteUploadedFile}
                        size="small"
                        disabled={!isEditing}
                      >
                        <FiTrash2 size={16} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Footer Buttons */}
            {(!currentUser || isEditing) && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'flex-end',
                  mt: 3,
                  gap: 2,
                }}
              >
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  sx={{
                    textTransform: 'capitalize',
                    color: 'error.main',
                    borderColor: 'error.main',
                    fontSize: '0.875rem',
                    width: { xs: '100%', sm: 'auto' },
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  sx={{
                    textTransform: 'capitalize',
                    fontSize: '0.875rem',
                    width: { xs: '100%', sm: 'auto' },
                  }}
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving...'
                    : currentUser
                      ? 'Update User'
                      : 'Add User'}
                </Button>
              </Box>
            )}
          </form>
        </CardContent>
      </Card>

      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </Box>
  );
};

export default ManageUserTab;
