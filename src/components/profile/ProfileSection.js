// src/components/profile/ProfileSection.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  InputAdornment,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import ReactCountryFlag from 'react-country-flag';

import {
  defaultCountries,
  parseCountry,
  FlagImage,
  usePhoneInput,
} from 'react-international-phone';
import { allCountries } from 'country-region-data';
import { useTheme, useMediaQuery } from '@mui/material';

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

function MuiPhone({ value, onChange, label }) {
  const { inputValue, handlePhoneValueChange, inputRef, country, setCountry } =
    usePhoneInput({
      defaultCountry: 'us',
      value,
      countries: defaultCountries,
      onChange: (data) => {
        onChange(data.phone);
      },
    });

  return (
    <TextField
      variant="outlined"
      label={label || 'Phone number'}
      placeholder="Phone number"
      value={inputValue}
      onChange={handlePhoneValueChange}
      type="tel"
      inputRef={inputRef}
      fullWidth
      InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
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
      }}
    />
  );
}

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const selectedCountryData = useMemo(() => {
    return countryRegionData.find(
      (c) => c.countryShortCode === formData.country
    );
  }, [formData.country]);

  const handlePhoneChange = (phone) => {
    handleChange({ target: { name: 'phoneNumber', value: phone || '' } });
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
      <form onSubmit={handleSubmit}>
        <Card sx={{ boxShadow: 1, borderRadius: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
              Personal Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  name="firstName"
                  variant="outlined"
                  fullWidth
                  value={formData.firstName}
                  onChange={handleChange}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  variant="outlined"
                  fullWidth
                  value={formData.lastName}
                  onChange={handleChange}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  name="email"
                  variant="outlined"
                  fullWidth
                  value={formData.email}
                  onChange={handleChange}
                  error={!!errors.email}
                  helperText={errors.email}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <MuiPhone
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Avatar URL"
                  name="avatar"
                  variant="outlined"
                  fullWidth
                  value={formData.avatar}
                  onChange={handleChange}
                  helperText="Enter an image URL for your avatar."
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                />
              </Grid>
            </Grid>

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
                  value={formData.address}
                  onChange={handleChange}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel sx={{ fontSize: '0.75rem' }}>Country</InputLabel>
                  <Select
                    label="Country"
                    name="country"
                    value={formData.country || ''}
                    onChange={handleChange}
                    sx={{ fontSize: '0.75rem' }}
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
              <Grid item xs={12} sm={6}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel sx={{ fontSize: '0.75rem' }}>Location</InputLabel>
                  <Select
                    label="Location"
                    name="location"
                    value={formData.location || ''}
                    onChange={handleChange}
                    disabled={!formData.country}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {!formData.country && (
                      <MenuItem disabled value="" sx={{ fontSize: '0.75rem' }}>
                        Select a country first
                      </MenuItem>
                    )}
                    {formData.country &&
                      (!selectedCountryData?.regions?.length ? (
                        <MenuItem
                          disabled
                          value=""
                          sx={{ fontSize: '0.75rem' }}
                        >
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
                <FormControl variant="outlined" fullWidth>
                  <InputLabel sx={{ fontSize: '0.75rem' }}>Currency</InputLabel>
                  <Select
                    label="Currency"
                    name="currency"
                    value={formData.currency || ''}
                    onChange={handleChange}
                    sx={{ fontSize: '0.75rem' }}
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
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Enter current password (not enforced)"
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          edge="end"
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
                  value={formData.newPassword}
                  onChange={handleChange}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword || ''}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
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
                  value={formData.confirmNewPassword}
                  onChange={handleChange}
                  error={!!errors.confirmNewPassword}
                  helperText={
                    errors.confirmNewPassword ||
                    (passwordMatch === 'mismatch'
                      ? 'Passwords do not match'
                      : '')
                  }
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
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
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
              Notifications
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Order Confirmation"
                  sx={{ mb: 1, '.MuiTypography-root': { fontSize: '0.75rem' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Order Status Changed"
                  sx={{ mb: 1, '.MuiTypography-root': { fontSize: '0.75rem' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch />}
                  label="Order Delivered"
                  sx={{ mb: 1, '.MuiTypography-root': { fontSize: '0.75rem' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Email Notifications"
                  sx={{ mb: 1, '.MuiTypography-root': { fontSize: '0.75rem' } }}
                />
              </Grid>
            </Grid>
          </CardContent>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 2,
              p: 2,
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <Button
              variant="outlined"
              onClick={handleCancel}
              sx={{
                fontWeight: 'bold',
                color: theme.palette.error.main,
                textTransform: 'none',
                borderColor: theme.palette.error.main,
                '&:hover': {
                  borderColor: theme.palette.error.dark,
                  color: theme.palette.error.dark,
                },
                fontSize: '0.75rem',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              sx={{
                backgroundColor: theme.palette.success.main,
                textTransform: 'none',
                '&:hover': { backgroundColor: theme.palette.success.dark },
                fontSize: '0.75rem',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              Save Changes
            </Button>
          </Box>
        </Card>
      </form>
    </Box>
  );
};

export default ProfileSection;
