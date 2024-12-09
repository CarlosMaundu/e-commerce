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
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

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
    <>
      <Typography variant="h5" className="section-header">
        Personal Information
      </Typography>
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
              error={!!errors.firstName}
              helperText={errors.firstName}
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
          error={!!errors.email}
          helperText={errors.email}
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

        <Divider className="custom-divider" />
        <Typography variant="h6" className="section-subheader">
          Security
        </Typography>
        <Button
          variant="contained"
          className="change-password-button"
          onClick={() => setShowPasswordFields(!showPasswordFields)}
        >
          {showPasswordFields ? 'Hide Password Fields' : 'Change Password'}
        </Button>

        {showPasswordFields && (
          <>
            <TextField
              label="Current Password (not required by API)"
              name="currentPassword"
              type="password"
              variant="outlined"
              fullWidth
              margin="normal"
              value={formData.currentPassword}
              onChange={handleChange}
              placeholder="Enter current password (not enforced)"
            />
            <TextField
              label="New Password"
              name="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              variant="outlined"
              fullWidth
              margin="normal"
              value={formData.newPassword}
              onChange={handleChange}
              error={!!errors.confirmNewPassword}
              helperText={errors.confirmNewPassword || ''}
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
            <TextField
              label="Confirm New Password"
              name="confirmNewPassword"
              type={showConfirmNewPassword ? 'text' : 'password'}
              variant="outlined"
              fullWidth
              margin="normal"
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
          </>
        )}

        <div className="form-actions">
          <Button
            variant="text"
            onClick={handleCancel}
            className="cancel-button"
          >
            Cancel
          </Button>
          <Button variant="contained" type="submit" className="save-button">
            Save Changes
          </Button>
        </div>
      </form>
    </>
  );
};

export default ProfileSection;
