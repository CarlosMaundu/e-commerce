// src/pages/FinishSignIn.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../firebase';
import { CircularProgress, Box, Typography } from '@mui/material';

const FinishSignIn = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign in...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        if (isSignInWithEmailLink(auth, window.location.href)) {
          let email = window.localStorage.getItem('emailForSignIn');
          if (!email) {
            email = window.prompt('Please provide your email for confirmation');
          }
          await signInWithEmailLink(auth, email, window.location.href);
          window.localStorage.removeItem('emailForSignIn');
          setStatus('Sign-in completed! Redirecting...');
          setTimeout(() => navigate('/', { replace: true }), 1500);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    completeSignIn();
  }, [navigate]);

  if (error) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography variant="h6" color="error">
          Error: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
      <CircularProgress />
      <Typography variant="h6" mt={2}>
        {status}
      </Typography>
    </Box>
  );
};

export default FinishSignIn;
