// src/context/StoreContext.js — the shop's name, logo, favicon and contact
// details from the back office (GET /rest/store). Also keeps the browser
// tab's title and icon in step with them.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { store as storeApi } from '../api';
import defaultLogo from '../images/logo.png';

export const DEFAULT_STORE = {
  name: 'Carlos Shop',
  tagline: 'Everyday things, chosen with care.',
  logo: '',
  favicon: '',
  email: '',
  phone: '',
  address: '',
  footerText: '',
  announcement: '',
  social: { facebook: '', instagram: '', x: '', tiktok: '' },
};

const StoreContext = createContext({
  ...DEFAULT_STORE,
  logoUrl: defaultLogo,
  loaded: false,
  reload: () => {},
});

const setFavicon = (href) => {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
};

export const StoreProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_STORE);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(
    () =>
      storeApi
        .get()
        .then((s) => setSettings({ ...DEFAULT_STORE, ...s }))
        .catch(() => {})
        .finally(() => setLoaded(true)),
    []
  );

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    document.title = settings.tagline
      ? `${settings.name} — ${settings.tagline}`
      : settings.name;
    if (settings.favicon) setFavicon(settings.favicon);
  }, [settings]);

  const value = useMemo(
    () => ({
      ...settings,
      logoUrl: settings.logo || defaultLogo,
      loaded,
      reload,
    }),
    [settings, loaded, reload]
  );
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
};

StoreProvider.propTypes = { children: PropTypes.node.isRequired };

export const useStore = () => useContext(StoreContext);
