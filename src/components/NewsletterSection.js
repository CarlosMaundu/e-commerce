// src/components/NewsletterSection.js

import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import '../styles/homePage.css';
import { addNewsletterSubscriber } from '../services/newsletterService.js';

const NewsletterSection = () => {
  const [submitted, setSubmitted] = useState(false);

  const initialValues = {
    email: '',
  };

  const validationSchema = Yup.object({
    email: Yup.string().email('Invalid email address').required('Required'),
  });

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      await addNewsletterSubscriber(values.email);
      setSubmitted(true);
      resetForm();
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      // Handle error appropriately
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="newsletter-section">
      <h2>Subscribe to our newsletter</h2>
      <p>
        Subscribe to our newsletter to get updates on our latest collections.
      </p>
      {submitted ? (
        <p>Thank you for subscribing!</p>
      ) : (
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="newsletter-form">
              <Field type="email" name="email" placeholder="Enter your email" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="cta-button"
              >
                Subscribe
              </button>
              <ErrorMessage
                name="email"
                component="div"
                className="error-message"
              />
            </Form>
          )}
        </Formik>
      )}
    </section>
  );
};

export default NewsletterSection;
