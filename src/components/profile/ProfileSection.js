// src/components/profile/ProfileSection.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Button,
  Divider,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import ReactCountryFlag from 'react-country-flag';
// We add FiEdit for the Edit button, FiTrash2 remains for deleting the uploaded file
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { useDispatch } from 'react-redux';

import {
  defaultCountries,
  parseCountry,
  FlagImage,
  usePhoneInput,
} from 'react-international-phone';
import { allCountries } from 'country-region-data';

// Toggles
import RoundedToggleSwitch from '../common/RoundedToggleSwitch';
// Thunk for file uploads
import { uploadFileThunk } from '../../redux/fileSlice';

//Data Preparation
const countryRegionData = allCountries
  ? allCountries.map((item) => {
      const countryName = item[0];
      const countryShortCode = item[1];
      const rawRegions = item[4] || [];
      const regions = rawRegions.map(([regionName, regionShortCode]) => ({
        name: regionName,
        shortCode: regionShortCode,
      }));
      return {
        countryName,
        countryShortCode,
        regions,
      };
    })
  : [];

const currencyOptions = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'KES', label: 'Kenyan Shilling (KSh)' },
];

// Phone Input Component
function MuiPhone({ value, onChange, label, disabled }) {
  const { inputValue, handlePhoneValueChange, inputRef, country, setCountry } =
    usePhoneInput({
      defaultCountry: 'us',
      value,
      countries: defaultCountries,
      onChange: (data) => {
        onChange(data.phone);
      },
      disabled,
    });

  return (
    <TextField
      variant="outlined"
      label={label || 'Phone Number'}
      placeholder="Enter phone number"
      value={inputValue}
      onChange={handlePhoneValueChange}
      type="tel"
      inputRef={inputRef}
      fullWidth
      size="small"
      disabled={disabled}
      InputProps={{
        startAdornment: (
          <InputAdornment
            position="start"
            sx={{ mr: 0, ml: 0, display: 'flex', alignItems: 'center' }}
          >
            <FormControl variant="standard" sx={{ minWidth: 40, mr: 0.5 }}>
              <Select
                value={country.iso2}
                onChange={(e) => setCountry(e.target.value)}
                disableUnderline
                disabled={disabled}
                sx={{
                  fontSize: '0.75rem',
                  '& .MuiSelect-select': { padding: '4px 8px' },
                  '& .MuiSelect-icon': { ml: 0 },
                }}
                renderValue={(iso2) => {
                  if (!iso2) return null;
                  const parsed = parseCountry(
                    defaultCountries.find((c) => parseCountry(c).iso2 === iso2)
                  );
                  if (!parsed) return null;
                  return (
                    <FlagImage
                      iso2={parsed.iso2}
                      style={{
                        width: 20,
                        height: 14,
                        borderRadius: '4px',
                      }}
                    />
                  );
                }}
              >
                {defaultCountries.map((c) => {
                  const parsed = parseCountry(c);
                  return (
                    <MenuItem
                      key={parsed.iso2}
                      value={parsed.iso2}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ReactCountryFlag
                          countryCode={parsed.iso2}
                          svg
                          style={{
                            width: '1.2em',
                            height: '1.2em',
                            borderRadius: '5px',
                          }}
                        />
                        <Typography sx={{ ml: 1 }}>{parsed.name}</Typography>
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </InputAdornment>
        ),
        // No special pointerEvents needed here because we disable it
      }}
    />
  );
}

//Styling for Upload UI
const uploadBlockStyle = {
  fontFamily: 'Roboto, Arial, sans-serif',
  fontSize: '0.8rem',
  color: '#6c757d',
  backgroundColor: '#fff',
  textAlign: 'left',
  borderRadius: '4px',
  width: '100%',
  minHeight: '80px',
  py: 0.5,
  px: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px dashed #ccc',
};

// Main Profile Section
const ProfileSection = ({
  formData,
  errors,
  handleChange,
  handleSubmit,
  handleCancel,
  showNewPassword,
  showConfirmNewPassword,
  setShowNewPassword,
  setShowConfirmNewPassword,
  defaultAvatarUrl,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  // Toggles for current password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Checking new vs confirm password match
  const [passwordMatch, setPasswordMatch] = useState(null);

  // Notification toggles
  const [notifOrderConfirmation, setNotifOrderConfirmation] = useState(true);
  const [notifOrderStatus, setNotifOrderStatus] = useState(true);
  const [notifOrderDelivered, setNotifOrderDelivered] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);

  // Upload states for avatar
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(false);
  const [uploadedFileDetails, setUploadedFileDetails] = useState(null);

  // Edit mode vs. view mode
  const [isEditing, setIsEditing] = useState(false);
  // Show "Saving..." on the Save Changes button during submission
  const [isSaving, setIsSaving] = useState(false);

  //Check password match logic
  useEffect(() => {
    if (formData.newPassword || formData.confirmNewPassword) {
      if (formData.newPassword === formData.confirmNewPassword) {
        setPasswordMatch('match');
      } else {
        setPasswordMatch('mismatch');
      }
    } else {
      setPasswordMatch(null);
    }
  }, [formData.newPassword, formData.confirmNewPassword]);

  // For countries → location chaining (region data)
  const selectedCountryData = useMemo(() => {
    return countryRegionData.find(
      (c) => c.countryShortCode === formData.country
    );
  }, [formData.country]);

  // Upload Handler for Avatar
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

      handleChange({ target: { name: 'avatar', value: result.location } });
      setUploadedFileDetails({
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        status: 'File Successfully Uploaded',
      });
    } catch (error) {
      setUploadError(true);
      setUploadedFileDetails({
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        status: 'File Failed to Upload',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUploadedFile = () => {
    if (!isEditing) return;
    setUploadedFileDetails(null);
    handleChange({ target: { name: 'avatar', value: '' } });
    setUploadError(false);
  };

  // Wrapping handleSubmit to show/hide "Saving..." on Save button
  const handleWrappedSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await handleSubmit(e);
    setIsSaving(false);

    // After successful submission
    setIsEditing(false);
  };

  // Cancel -> revert changes & exit edit mode
  const onCancelClick = () => {
    handleCancel();
    setIsEditing(false);
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
      <form onSubmit={handleWrappedSubmit}>
        <Card sx={{ boxShadow: 1, borderRadius: 3 }}>
          <CardActions
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2,
              pt: 2,
            }}
          >
            <Typography variant="h6" color="text.primary">
              Personal Details
            </Typography>

            {/* Edit button if not editing & not saving */}
            {!isEditing && !isSaving && (
              <Button
                variant="contained"
                onClick={() => setIsEditing(true)}
                startIcon={<FiEdit />}
                sx={{ textTransform: 'none' }}
              >
                Edit
              </Button>
            )}
          </CardActions>

          <CardContent sx={{ pt: 0, pb: 2 }}>
            <Grid container spacing={2}>
              {/* FIRST & LAST NAME */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  name="firstName"
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                  // read-only if not editing, remove hover effect
                  InputProps={{
                    readOnly: !isEditing,
                    style: { pointerEvents: !isEditing ? 'none' : 'auto' },
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={handleChange}
                  InputProps={{
                    readOnly: !isEditing,
                    style: { pointerEvents: !isEditing ? 'none' : 'auto' },
                  }}
                />
              </Grid>

              {/* EMAIL & PHONE */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  name="email"
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Enter email"
                  value={formData.email}
                  // always read-only
                  InputProps={{
                    readOnly: true,
                    style: { pointerEvents: 'none' },
                  }}
                  onChange={handleChange}
                  error={!!errors.email}
                  helperText={errors.email}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <MuiPhone
                  value={formData.phoneNumber}
                  onChange={(phone) =>
                    handleChange({
                      target: { name: 'phoneNumber', value: phone },
                    })
                  }
                  label="Phone Number"
                  disabled={!isEditing}
                />
              </Grid>

              {/* AVATAR - SPLIT TWO COLUMNS for Upload and Status */}
              <Grid item xs={12} sm={6}>
                <Typography
                  variant="body2"
                  sx={{ mb: 1, fontWeight: 'bold', fontSize: '0.875rem' }}
                >
                  Avatar (Upload)
                </Typography>
                <Box
                  sx={{
                    ...uploadBlockStyle,
                    cursor: isEditing ? 'pointer' : 'not-allowed',
                    opacity: isEditing ? 1 : 0.65,
                  }}
                  onClick={() => {
                    if (!isEditing) return;
                    document.getElementById('avatarUploadFile').click();
                  }}
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
                  ) : (
                    <>
                      <Typography variant="body1" sx={{ mb: 0.5 }}>
                        Upload file
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        Drag &amp; Drop or{' '}
                        <span
                          style={{
                            color: isEditing ? '#1976d2' : '#999',
                            cursor: isEditing ? 'pointer' : 'default',
                          }}
                        >
                          Choose file
                        </span>{' '}
                        to upload
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        PNG, JPG, SVG, WEBP, and GIF are allowed.
                      </Typography>
                    </>
                  )}
                </Box>
                <input
                  type="file"
                  id="avatarUploadFile"
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </Grid>

              {/* Upload Status / Details */}
              <Grid item xs={12} sm={6} sx={{ mt: 3.5 }}>
                <Box
                  sx={{
                    ...uploadBlockStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '85px',
                    borderColor: '#ccc',
                    cursor: 'default',
                  }}
                >
                  {!uploadedFileDetails ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '0.8rem' }}
                    >
                      No file uploaded yet.
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.primary.main,
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
                        onClick={() => handleDeleteUploadedFile()}
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

            {/* Address & Location */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
              Address &amp; Location
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Address"
                  name="address"
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Enter address"
                  value={formData.address}
                  onChange={handleChange}
                  InputProps={{
                    readOnly: !isEditing,
                    style: { pointerEvents: !isEditing ? 'none' : 'auto' },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
                  disabled={!isEditing}
                >
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    name="country"
                    value={formData.country || ''}
                    onChange={handleChange}
                  >
                    {countryRegionData.map((country) => (
                      <MenuItem
                        key={country.countryShortCode}
                        value={country.countryShortCode}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ReactCountryFlag
                            countryCode={country.countryShortCode}
                            svg
                            style={{
                              width: '1.2em',
                              height: '1.2em',
                              borderRadius: '5px',
                            }}
                          />
                          <Typography sx={{ ml: 1 }}>
                            {country.countryName}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Location based on selected Country */}
              <Grid item xs={12} sm={6}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
                  disabled={!isEditing || !formData.country}
                >
                  <InputLabel>Location</InputLabel>
                  <Select
                    label="Location"
                    name="location"
                    value={formData.location || ''}
                    onChange={handleChange}
                  >
                    {!formData.country && (
                      <MenuItem disabled value="">
                        Select a country first
                      </MenuItem>
                    )}
                    {formData.country &&
                      (!selectedCountryData?.regions?.length ? (
                        <MenuItem disabled value="">
                          No regions available
                        </MenuItem>
                      ) : (
                        selectedCountryData?.regions?.map((region) => (
                          <MenuItem
                            key={region.shortCode}
                            value={region.name}
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {region.name}
                          </MenuItem>
                        ))
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
                  disabled={!isEditing}
                >
                  <InputLabel>Currency</InputLabel>
                  <Select
                    label="Currency"
                    name="currency"
                    value={formData.currency || ''}
                    onChange={handleChange}
                  >
                    {currencyOptions.map((cur) => (
                      <MenuItem
                        key={cur.value}
                        value={cur.value}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {cur.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Security */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
              Security
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Current Password (optional)"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Enter current password (not enforced)"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  disabled={!isEditing}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          edge="end"
                          disabled={!isEditing}
                        >
                          {showCurrentPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} />

              <Grid item xs={12} sm={6}>
                <TextField
                  label="New Password"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  disabled={!isEditing}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword || ''}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                          disabled={!isEditing}
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    style: { pointerEvents: !isEditing ? 'none' : 'auto' },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Confirm New Password"
                  name="confirmNewPassword"
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  size="small"
                  placeholder="Re-enter new password"
                  value={formData.confirmNewPassword}
                  onChange={handleChange}
                  disabled={!isEditing}
                  error={!!errors.confirmNewPassword}
                  helperText={errors.confirmNewPassword || ''}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {passwordMatch === 'match' &&
                          formData.newPassword &&
                          formData.confirmNewPassword && (
                            <CheckCircle sx={{ color: 'green', mr: 1 }} />
                          )}
                        {passwordMatch === 'mismatch' &&
                          formData.newPassword &&
                          formData.confirmNewPassword && (
                            <Cancel sx={{ color: 'red', mr: 1 }} />
                          )}
                        <IconButton
                          onClick={() =>
                            setShowConfirmNewPassword(!showConfirmNewPassword)
                          }
                          edge="end"
                          disabled={!isEditing}
                        >
                          {showConfirmNewPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                    style: { pointerEvents: !isEditing ? 'none' : 'auto' },
                  }}
                />
              </Grid>
            </Grid>

            {/* Notifications */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
              Notifications
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RoundedToggleSwitch
                  label="Order Confirmation"
                  labelPlacement="start"
                  checked={notifOrderConfirmation}
                  onChange={(e) => setNotifOrderConfirmation(e.target.checked)}
                  sx={{ mb: 1 }}
                  disabled={!isEditing}
                />
              </Grid>
              <Grid item xs={12}>
                <RoundedToggleSwitch
                  label="Order Status Changed"
                  labelPlacement="start"
                  checked={notifOrderStatus}
                  onChange={(e) => setNotifOrderStatus(e.target.checked)}
                  sx={{ mb: 1 }}
                  disabled={!isEditing}
                />
              </Grid>
              <Grid item xs={12}>
                <RoundedToggleSwitch
                  label="Order Delivered"
                  labelPlacement="start"
                  checked={notifOrderDelivered}
                  onChange={(e) => setNotifOrderDelivered(e.target.checked)}
                  sx={{ mb: 1 }}
                  disabled={!isEditing}
                />
              </Grid>
              <Grid item xs={12}>
                <RoundedToggleSwitch
                  label="Email Notifications"
                  labelPlacement="start"
                  checked={notifEmail}
                  onChange={(e) => setNotifEmail(e.target.checked)}
                  sx={{ mb: 1 }}
                  disabled={!isEditing}
                />
              </Grid>
            </Grid>
          </CardContent>

          {/* Footer Buttons, only if editing */}
          {isEditing && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'flex-end',
                gap: 2,
                p: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={onCancelClick}
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
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          )}
        </Card>
      </form>
    </Box>
  );
};

export default ProfileSection;
