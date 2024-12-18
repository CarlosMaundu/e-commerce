// src/components/layout/NewsletterSection.js

import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Box, Typography, Button, TextField } from '@mui/material';
import * as Yup from 'yup';
import { addNewsletterSubscriber } from '../../services/newsletterService.js';
import Notification from '../../notification/notification';

const NewsletterSection = () => {
  const [submitted, setSubmitted] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const initialValues = {
    email: '',
  };

  const validationSchema = Yup.object({
    email: Yup.string().email('Invalid email address').required('Required'),
  });

  const handleNotificationClose = () => {
    setNotification({ ...notification, open: false });
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      await addNewsletterSubscriber(values.email);
      setSubmitted(true);
      resetForm();
      setNotification({
        open: true,
        message: 'You have successfully subscribed to our newsletter!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      setNotification({
        open: true,
        message: 'Subscription failed. Please try again later.',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="section"
      sx={{
        fontFamily: 'sans-serif',
        px: { xs: 2, md: 6 },
        py: { xs: 8, md: 16 },
        background: 'linear-gradient(to top, #e5e7eb, #f9fafb, #f9fafb)',
        textAlign: 'center',
      }}
    >
      <Box sx={{ maxWidth: { md: '768px', xs: '100%' }, mx: 'auto' }}>
        {/* Small heading line */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 'bold',
            color: 'blue.600',
            mb: 2,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="span"
            sx={{ transform: 'rotate(90deg)', display: 'inline-block', mr: 1 }}
          >
            |
          </Box>
          All in one at Carlos Shop
        </Typography>

        {/* Main Heading */}
        <Typography
          variant="h2"
          sx={{
            color: 'grey.800',
            fontSize: { xs: '2rem', md: '2rem' },
            fontWeight: 'extrabold',
            lineHeight: { md: '55px' },
          }}
        >
          Elevate Your Shopping Experience
        </Typography>

        {/* Subtext */}
        <Box mt={2}>
          <Typography
            variant="body1"
            sx={{
              textAlign: 'center',
              color: 'gray.500',
              fontSize: '1rem',
              lineHeight: '1.7',
            }}
          >
            Upgrade to our premium newsletter and unlock a world of
            possibilities. Enjoy exclusive discounts, early product launches,
            and a seamless journey towards your perfect find.
          </Typography>
        </Box>

        {/* Form */}
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form>
              <Box
                sx={{
                  backgroundColor: '#fff',
                  mt: 6,
                  display: 'flex',
                  flexDirection: 'row',
                  px: 1,
                  py: 1.5,
                  borderRadius: '9999px',
                  boxShadow: '0 5px 22px -8px rgba(93,96,127,0.2)',
                  alignItems: 'center',
                  width: { xs: '100%', md: '80%' },
                  mx: 'auto',
                  overflow: 'hidden',
                  flexWrap: 'wrap',
                }}
              >
                <Field
                  as={TextField}
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    flex: 1,
                    outline: 'none',
                    background: 'white',
                    pl: 2,
                    color: 'gray.800',
                    fontSize: '0.875rem',
                    minWidth: 0, // So it can shrink properly on small screens
                  }}
                />
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="contained"
                  sx={{
                    backgroundColor: 'blue.600',
                    '&:hover': { backgroundColor: 'blue.700' },
                    color: 'white',
                    fontSize: '0.875rem',
                    borderRadius: '9999px',
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    m: { xs: '8px 0 0', md: '0 0 0 8px' },
                  }}
                >
                  Subscribe
                </Button>
              </Box>
              <ErrorMessage name="email">
                {(msg) => (
                  <Typography
                    variant="body2"
                    sx={{ color: 'red', fontSize: '1rem', mt: 1 }}
                  >
                    {msg}
                  </Typography>
                )}
              </ErrorMessage>
            </Form>
          )}
        </Formik>

        {submitted && (
          <Typography
            variant="body1"
            sx={{ color: 'green', fontSize: '1rem', mt: 2 }}
          >
            Thank you for subscribing! Check your inbox for our latest updates.
          </Typography>
        )}
      </Box>

      {/* Notification Component */}
      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </Box>
  );
};

export default NewsletterSection;
