// src/pages/account/AccountSettingsPages.js — profile, security, addresses.
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiEdit2, FiMapPin, FiPlus, FiTrash2, FiUpload } from 'react-icons/fi';
import { initialsOf } from '../../components/common/BrandMark';
import { formatDate } from '../../utils/format';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AuthContext } from '../../context/AuthContext';
import { account, addresses as addressApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';
import { AccountPage } from '../../layouts/StorefrontLayout';
import { EmptyState, SectionCard } from '../../components/ui';
import AddressForm, { countryName } from '../../components/account/AddressForm';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

// ---------- Profile ----------

export const ProfilePage = () => {
  const { user, updateUser } = useContext(AuthContext);
  const notify = useNotify();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      firstName: user.firstName || user.name.split(' ')[0] || '',
      lastName: user.lastName ?? user.name.split(' ').slice(1).join(' '),
      phone: user.phone || '',
    },
    validationSchema: Yup.object({
      firstName: Yup.string().trim().required('Please enter your first name.'),
      phone: Yup.string()
        .trim()
        .matches(/^[+0-9 ()-]*$/, 'Use digits, spaces and + only.')
        .max(30),
    }),
    onSubmit: async (values) => {
      try {
        const updated = await account.updateProfile({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          phone: values.phone.trim(),
        });
        updateUser(updated);
        setEditing(false);
        notify.success(MESSAGES.profile.updated);
      } catch (error) {
        notify.error(error, MESSAGES.profile.updateFailed);
      }
    },
  });

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      updateUser(await account.uploadAvatar(file));
      notify.success('Profile photo updated.');
    } catch (error) {
      notify.error(error, 'We couldn’t upload that photo.');
    } finally {
      setUploading(false);
    }
  };
  const removePhoto = async () => {
    try {
      updateUser(await account.updateProfile({ avatar: '' }));
    } catch (error) {
      notify.error(error);
    }
  };

  const field = (name, label, props = {}) => (
    <TextField
      fullWidth
      label={label}
      name={name}
      value={formik.values[name]}
      onChange={formik.handleChange}
      onBlur={formik.handleBlur}
      disabled={!editing}
      error={formik.touched[name] && Boolean(formik.errors[name])}
      helperText={
        (formik.touched[name] && formik.errors[name]) || props.helperText
      }
      {...props}
    />
  );

  return (
    <AccountPage
      title="Profile"
      subtitle="How you appear on orders, invoices and emails."
      action={
        !editing && (
          <Button
            variant="contained"
            startIcon={<FiEdit2 />}
            onClick={() => setEditing(true)}
          >
            Edit profile
          </Button>
        )
      }
    >
      <Stack spacing={3}>
        <SectionCard>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            alignItems={{ sm: 'center' }}
          >
            <Avatar
              src={user.avatar || undefined}
              alt=""
              sx={{
                width: 96,
                height: 96,
                fontSize: 32,
                fontWeight: 700,
                bgcolor: 'highlight.main',
                color: 'text.primary',
              }}
            >
              {initialsOf(user.name)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5">{user.name}</Typography>
              <Typography color="text.secondary">{user.email}</Typography>
              {user.creationAt && (
                <Typography variant="caption">
                  Member since {formatDate(user.creationAt)}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<FiUpload />}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading
                  ? 'Uploading…'
                  : user.avatar
                    ? 'Change photo'
                    : 'Add photo'}
              </Button>
              {user.avatar && (
                <Button color="error" onClick={removePhoto}>
                  Remove
                </Button>
              )}
            </Stack>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              aria-label="Profile photo"
              onChange={(e) => {
                uploadPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </Stack>
        </SectionCard>

        <SectionCard
          title="Personal details"
          subtitle="Your name and phone appear on deliveries and invoices."
        >
          <form onSubmit={formik.handleSubmit} noValidate>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                {field('firstName', 'First name', { required: true })}
              </Grid>
              <Grid item xs={12} sm={6}>
                {field('lastName', 'Last name')}
              </Grid>
              <Grid item xs={12} sm={6}>
                {field('phone', 'Phone number', {
                  placeholder: '+254 7…',
                  helperText: 'Used for delivery updates.',
                })}
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email address"
                  value={user.email}
                  disabled
                  helperText="Your sign-in email. Contact support to change it."
                />
              </Grid>
            </Grid>
            {editing && (
              <Stack
                direction="row"
                justifyContent="flex-end"
                spacing={1.5}
                sx={{ mt: 3 }}
              >
                <Button
                  variant="outlined"
                  onClick={() => {
                    formik.resetForm();
                    setEditing(false);
                  }}
                  disabled={formik.isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={formik.isSubmitting}
                >
                  {formik.isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
              </Stack>
            )}
          </form>
        </SectionCard>
      </Stack>
    </AccountPage>
  );
};

// ---------- Login & security ----------

const passwordRules = Yup.string()
  .min(8, 'Use at least 8 characters.')
  .matches(/[a-z]/, 'Add a lowercase letter.')
  .matches(/[A-Z]/, 'Add an uppercase letter.')
  .matches(/[0-9!@#$%^&*]/, 'Add a number or symbol.')
  .required('Please enter a new password.');

export const SecurityPage = () => {
  const { user, changePassword, resetPassword } = useContext(AuthContext);
  const notify = useNotify();
  const [sending, setSending] = useState(false);
  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    validationSchema: Yup.object({
      currentPassword: Yup.string().required(
        MESSAGES.profile.currentPasswordRequired
      ),
      newPassword: passwordRules,
      confirmNewPassword: Yup.string()
        .oneOf([Yup.ref('newPassword')], MESSAGES.auth.passwordsDoNotMatch)
        .required('Please confirm the new password.'),
    }),
    onSubmit: async (values, helpers) => {
      try {
        await changePassword(values.currentPassword, values.newPassword);
        notify.success(
          `${MESSAGES.profile.passwordChanged} Other devices have been signed out.`
        );
        helpers.resetForm();
      } catch (error) {
        if (error.status === 400 && /current password/i.test(error.message)) {
          helpers.setFieldError(
            'currentPassword',
            'Your current password is incorrect.'
          );
        }
        notify.error(error, MESSAGES.profile.passwordChangeFailed);
      }
    },
  });
  const field = (name, label, autoComplete) => (
    <TextField
      fullWidth
      type="password"
      label={label}
      name={name}
      autoComplete={autoComplete}
      value={formik.values[name]}
      onChange={formik.handleChange}
      onBlur={formik.handleBlur}
      error={formik.touched[name] && Boolean(formik.errors[name])}
      helperText={formik.touched[name] && formik.errors[name]}
    />
  );

  const sendSetupLink = async () => {
    setSending(true);
    try {
      await resetPassword(user.email);
      notify.info(MESSAGES.auth.resetLinkSent(user.email));
    } catch (error) {
      notify.error(error, MESSAGES.auth.linkFailed);
    } finally {
      setSending(false);
    }
  };

  return (
    <AccountPage title="Login & security" subtitle="Manage how you sign in.">
      <Stack spacing={3}>
        <SectionCard
          title="Password"
          subtitle="Changing your password signs you out on your other devices."
        >
          {user.hasPassword ? (
            <form onSubmit={formik.handleSubmit} noValidate>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  {field(
                    'currentPassword',
                    'Current password',
                    'current-password'
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {field('newPassword', 'New password', 'new-password')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {field(
                    'confirmNewPassword',
                    'Confirm new password',
                    'new-password'
                  )}
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={formik.isSubmitting}
                >
                  {formik.isSubmitting ? 'Saving…' : 'Change password'}
                </Button>
              </Stack>
            </form>
          ) : (
            <Stack spacing={2} alignItems="flex-start">
              <Typography color="text.secondary">
                You sign in with Google, so you don’t have a password yet. We
                can email you a link to set one.
              </Typography>
              <Button
                variant="outlined"
                onClick={sendSetupLink}
                disabled={sending}
              >
                Email me a link to set a password
              </Button>
            </Stack>
          )}
        </SectionCard>
        <SectionCard title="Sign-in email" tinted>
          <Typography>{user.email}</Typography>
        </SectionCard>
      </Stack>
    </AccountPage>
  );
};

// ---------- Address book ----------

export const AddressesPage = () => {
  const notify = useNotify();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // address or {} for new
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await addressApi.list());
    } catch (error) {
      notify.error(
        error,
        'We couldn’t load your addresses. Please refresh to try again.'
      );
      setList([]);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (values) => {
    try {
      if (editing?.id) await addressApi.update(editing.id, values);
      else await addressApi.create(values);
      notify.success(editing?.id ? 'Address updated.' : 'Address saved.');
      setEditing(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t save the address. Please try again.');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await addressApi.remove(deleting.id);
      notify.success('Address deleted.');
      setDeleting(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t delete the address. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountPage
      title="Addresses"
      subtitle="Saved addresses make checkout faster."
      action={
        <Button
          variant="contained"
          startIcon={<FiPlus />}
          onClick={() => setEditing({})}
        >
          Add address
        </Button>
      }
    >
      {!list ? (
        <Grid container spacing={2}>
          {[0, 1].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rounded" height={170} />
            </Grid>
          ))}
        </Grid>
      ) : !list.length ? (
        <SectionCard>
          <EmptyState
            icon={<FiMapPin />}
            title="No saved addresses"
            action={
              <Button variant="contained" onClick={() => setEditing({})}>
                Add your first address
              </Button>
            }
          >
            Add an address now, or save one during checkout.
          </EmptyState>
        </SectionCard>
      ) : (
        <Grid container spacing={2}>
          {list.map((a) => (
            <Grid item xs={12} md={6} key={a.id}>
              <Box
                sx={{
                  bgcolor: 'background.neutral',
                  borderRadius: 1,
                  p: 3,
                  height: '100%',
                }}
                data-testid={`address-${a.id}`}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">
                        {a.firstName} {a.lastName}
                      </Typography>
                      {a.isDefault && (
                        <Chip size="small" color="primary" label="Default" />
                      )}
                    </Stack>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}
                      <br />
                      {[a.city, a.region, a.postcode]
                        .filter(Boolean)
                        .join(', ')}
                      <br />
                      {countryName(a.country)}
                    </Typography>
                    {a.phone && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {a.phone}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row">
                    <Tooltip title="Edit">
                      <IconButton
                        aria-label={`Edit address ${a.line1}`}
                        onClick={() => setEditing(a)}
                      >
                        <FiEdit2 />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        aria-label={`Delete address ${a.line1}`}
                        onClick={() => setDeleting(a)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing?.id ? 'Edit address' : 'Add address'}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {editing && (
            <AddressForm
              initialValues={editing}
              onSubmit={save}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(deleting)}
        title="Delete this address?"
        content={
          deleting
            ? `${deleting.line1}, ${deleting.city} will be removed from your address book.`
            : ''
        }
        confirmText="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </AccountPage>
  );
};
