// src/components/account/AddressForm.js — used by the address book and checkout.
import React from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import * as countryData from 'country-region-data';

// The ES build (webpack) has named exports; the UMD build (Jest) exports
// the full country list as an array.
const countryList = countryData.countryShortCodes
  ? countryData.countryShortCodes.map((code, i) => ({
      code,
      name: countryData.countryNames[i],
    }))
  : []
      .concat(...Object.values(countryData))
      .filter((c) => c && c.countryShortCode)
      .map((c) => ({ code: c.countryShortCode, name: c.countryName }));

export const COUNTRIES = countryList;
export const countryName = (code) =>
  COUNTRIES.find((c) => c.code === code)?.name || code;

export const EMPTY_ADDRESS = {
  firstName: '',
  lastName: '',
  company: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postcode: '',
  country: 'KE',
  phone: '',
  isDefault: false,
};

const schema = Yup.object({
  firstName: Yup.string().trim().required('Please enter a first name.'),
  lastName: Yup.string().trim().required('Please enter a last name.'),
  line1: Yup.string()
    .trim()
    .min(3, 'Please enter a street address.')
    .required('Please enter a street address.'),
  city: Yup.string().trim().required('Please enter a city.'),
  country: Yup.string().length(2).required('Please choose a country.'),
  phone: Yup.string().trim().max(40),
});

const AddressForm = ({
  initialValues,
  submitLabel = 'Save address',
  onSubmit,
  onCancel,
  showDefault = true,
  recipient,
}) => {
  // Signed-in shoppers: their name (and phone) fill in by themselves; the
  // name fields only show when delivering to someone else.
  const [otherRecipient, setOtherRecipient] = React.useState(false);
  const hideName =
    Boolean(recipient?.firstName && recipient?.lastName) && !otherRecipient;
  const formik = useFormik({
    initialValues: {
      ...EMPTY_ADDRESS,
      ...(recipient
        ? {
            firstName: recipient.firstName || '',
            lastName: recipient.lastName || '',
            phone: recipient.phone || '',
          }
        : {}),
      ...initialValues,
    },
    validationSchema: schema,
    enableReinitialize: true,
    onSubmit: async (values, helpers) => {
      await onSubmit(values, helpers);
      helpers.setSubmitting(false);
    },
  });
  const field = (name, label, props = {}) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      name={name}
      value={formik.values[name]}
      onChange={formik.handleChange}
      onBlur={formik.handleBlur}
      error={formik.touched[name] && Boolean(formik.errors[name])}
      helperText={formik.touched[name] && formik.errors[name]}
      {...props}
    />
  );
  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Grid container spacing={2}>
        {hideName ? (
          <Grid item xs={12}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
              sx={{
                bgcolor: 'background.neutral',
                borderRadius: '8px',
                px: 2,
                py: 1.25,
              }}
            >
              <span>
                Delivering to{' '}
                <strong>
                  {`${recipient.firstName} ${recipient.lastName || ''}`.trim()}
                </strong>
              </span>
              <Button
                size="small"
                onClick={() => {
                  setOtherRecipient(true);
                  formik.setFieldValue('firstName', '');
                  formik.setFieldValue('lastName', '');
                }}
              >
                Someone else?
              </Button>
            </Stack>
          </Grid>
        ) : (
          <>
            <Grid item xs={12} sm={6}>
              {field('firstName', 'First name', {
                required: true,
                autoComplete: 'given-name',
              })}
            </Grid>
            <Grid item xs={12} sm={6}>
              {field('lastName', 'Last name', {
                required: true,
                autoComplete: 'family-name',
              })}
            </Grid>
          </>
        )}
        <Grid item xs={12}>
          {field('line1', 'Street address', {
            required: true,
            autoComplete: 'address-line1',
          })}
        </Grid>
        <Grid item xs={12}>
          {field('line2', 'Apartment, suite, building (optional)', {
            autoComplete: 'address-line2',
          })}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('city', 'City or town', {
            required: true,
            autoComplete: 'address-level2',
          })}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('region', 'County, state or region', {
            autoComplete: 'address-level1',
          })}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('postcode', 'Postcode', { autoComplete: 'postal-code' })}
        </Grid>
        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={COUNTRIES}
            getOptionLabel={(o) => o.name}
            value={
              COUNTRIES.find((c) => c.code === formik.values.country) || null
            }
            onChange={(_, v) => formik.setFieldValue('country', v?.code || '')}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Country"
                required
                error={formik.touched.country && Boolean(formik.errors.country)}
                helperText={formik.touched.country && formik.errors.country}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('phone', 'Phone (for delivery updates)', {
            type: 'tel',
            autoComplete: 'tel',
          })}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('company', 'Company (optional)', {
            autoComplete: 'organization',
          })}
        </Grid>
        {showDefault && (
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  name="isDefault"
                  checked={formik.values.isDefault}
                  onChange={formik.handleChange}
                />
              }
              label="Use as my default address"
            />
          </Grid>
        )}
      </Grid>
      <Stack
        direction="row"
        spacing={1.5}
        justifyContent="flex-end"
        sx={{ mt: 3 }}
      >
        {onCancel && (
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={formik.isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={formik.isSubmitting}
        >
          {formik.isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </Stack>
    </form>
  );
};

AddressForm.propTypes = {
  initialValues: PropTypes.object,
  submitLabel: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  showDefault: PropTypes.bool,
  recipient: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    phone: PropTypes.string,
  }),
};

export default AddressForm;
