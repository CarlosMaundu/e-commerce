// src/notification/NotificationProvider.js
//
// App-wide toast notifications. Wrap the app once, then in any component:
//
//   const notify = useNotify();
//   notify.success(MESSAGES.product.created);
//   notify.error(err, MESSAGES.product.saveFailed); // err is made user-friendly
//
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import Notification from './notification';
import { friendlyError } from '../utils/friendlyError';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [state, setState] = useState({
    open: false,
    severity: 'info',
    message: '',
    key: 0,
  });

  const show = useCallback((severity, message) => {
    setState((prev) => ({ open: true, severity, message, key: prev.key + 1 }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const notify = useMemo(
    () => ({
      success: (message) => show('success', message),
      info: (message) => show('info', message),
      warning: (message) => show('warning', message),
      // Accepts an Error (or anything thrown) or a ready-made string.
      error: (errorOrMessage, fallback) =>
        show('error', friendlyError(errorOrMessage, fallback)),
      close,
    }),
    [show, close]
  );

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Notification
        key={state.key}
        open={state.open}
        severity={state.severity}
        message={state.message}
        onClose={close}
      />
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useNotify = () => {
  const notify = useContext(NotificationContext);
  if (!notify) {
    throw new Error('useNotify must be used inside <NotificationProvider>.');
  }
  return notify;
};
