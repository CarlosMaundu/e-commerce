// src/components/profile/ProfileSection.js
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import {
  TextField,
  Button,
  Typography,
  Divider,
  InputAdornment,
  IconButton,
  Card,
  CardContent,
  Avatar,
  Box,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  UploadFile,
  ExpandMore,
} from '@mui/icons-material';

const ProfileSection = ({
  formData,
  errors,
  showPasswordFields,
  showNewPassword,
  showConfirmNewPassword,
  handleChange,
  handleSubmit,
  handleCancel,
  setShowPasswordFields,
  setShowNewPassword,
  setShowConfirmNewPassword,
  defaultAvatarUrl,
}) => {
  return (
    <Box
      sx={{
        backgroundColor: '#f2f2f2',
        p: { xs: 2, md: 4 },
        borderRadius: 2,
      }}
    >
      {/* Personal Information Card */}
      <Card
        sx={{
          mb: 4,
          boxShadow: 1,
          borderRadius: 2,
        }}
      >
        <CardContent>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              mb: 2,
              textAlign: 'center',
              color: '#333',
            }}
          >
            Personal Information
          </Typography>

          {/* Avatar Section */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 3,
              position: 'relative',
            }}
          >
            <Avatar
              src={formData.avatar || defaultAvatarUrl}
              alt="User Avatar"
              sx={{
                width: 150,
                height: 150,
                border: '2px solid #ddd',
                '&:hover': {
                  boxShadow: 3,
                },
              }}
              imgProps={{
                onError: (e) => {
                  e.currentTarget.src = defaultAvatarUrl;
                },
              }}
            />
            <IconButton
              aria-label="Upload avatar"
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 'calc(50% - 20px)',
                backgroundColor: 'white',
                boxShadow: 2,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
              onClick={() =>
                alert('Avatar upload functionality not yet implemented')
              }
            >
              <UploadFile />
            </IconButton>
          </Box>

          <form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <TextField
                  label="First Name"
                  name="firstName"
                  variant="outlined"
                  fullWidth
                  value={formData.firstName}
                  onChange={handleChange}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                  sx={{ mb: 2 }}
                />
              </Col>
              <Col md={6}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  variant="outlined"
                  fullWidth
                  value={formData.lastName}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                />
              </Col>
            </Row>
            <TextField
              label="Email"
              name="email"
              variant="outlined"
              fullWidth
              value={formData.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Address"
              name="address"
              variant="outlined"
              fullWidth
              value={formData.address}
              onChange={handleChange}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Avatar URL"
              name="avatar"
              variant="outlined"
              fullWidth
              value={formData.avatar}
              onChange={handleChange}
              helperText="Enter a valid image URL for your avatar."
              sx={{ mb: 2 }}
            />

            {/* Actions */}
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}
            >
              <Button
                variant="outlined"
                onClick={handleCancel}
                sx={{
                  fontWeight: 'bold',
                  color: 'red',
                  textTransform: 'none',
                  borderColor: 'red',
                  '&:hover': {
                    borderColor: 'darkred',
                    color: 'darkred',
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                startIcon={<Visibility />}
                sx={{
                  backgroundColor: '#28a745',
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#218838' },
                }}
              >
                Save Changes
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card sx={{ boxShadow: 1, borderRadius: 2 }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              mb: 2,
              color: '#555',
            }}
          >
            Security
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {/* Toggle for password fields */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="body1" sx={{ mr: 1 }}>
              Change Password
            </Typography>
            <Switch
              checked={showPasswordFields}
              onChange={() => setShowPasswordFields(!showPasswordFields)}
              color="primary"
              inputProps={{ 'aria-label': 'Toggle password fields' }}
            />
          </Box>

          {showPasswordFields && (
            <Accordion defaultExpanded>
              <AccordionSummary
                expandIcon={<ExpandMore />}
                aria-controls="password-panel-content"
                id="password-panel-header"
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Update Password
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  label="Current Password (optional)"
                  name="currentPassword"
                  type="password"
                  variant="outlined"
                  fullWidth
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Enter current password (not enforced)"
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="New Password"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  value={formData.newPassword}
                  onChange={handleChange}
                  error={!!errors.confirmNewPassword}
                  helperText={errors.confirmNewPassword || ''}
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                          aria-label="Toggle new password visibility"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
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
                          aria-label="Toggle confirm password visibility"
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
              </AccordionDetails>
            </Accordion>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProfileSection;
