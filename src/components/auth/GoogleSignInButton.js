// src/components/auth/GoogleSignInButton.js
//
// Google Identity Services "Sign in with Google" button. Google returns an ID
// token (credential) which our backend verifies; no Firebase involved.
// Requires REACT_APP_GOOGLE_CLIENT_ID; renders nothing when it isn't set.
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { GOOGLE_CLIENT_ID } from '../../api/config';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google sign-in could not load.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

const GoogleSignInButton = ({
  onCredential,
  onError,
  text = 'signin_with',
}) => {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ onCredential, onError });
  callbacks.current = { onCredential, onError };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) =>
            callbacks.current.onCredential(credential),
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: Math.min(container.current.offsetWidth || 400, 400),
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setFailed(true);
          callbacks.current.onError?.(error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!GOOGLE_CLIENT_ID || failed) return null;

  return (
    <Box
      ref={container}
      data-testid="google-signin"
      sx={{ width: '100%', display: 'flex', justifyContent: 'center', my: 1 }}
    />
  );
};

GoogleSignInButton.propTypes = {
  onCredential: PropTypes.func.isRequired,
  onError: PropTypes.func,
  text: PropTypes.oneOf(['signin_with', 'signup_with', 'continue_with']),
};

export default GoogleSignInButton;
