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
import {
  getCurrency,
  hasRememberedCurrency,
  setCurrency,
} from '../utils/format';

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
  finance: {
    currency: 'KES',
    taxLabel: 'VAT',
    taxRate: 16,
    pricesIncludeTax: true,
    freeShippingOver: 0,
  },
  returns: { windowDays: 14, refundDelivery: false, restockingFeePercent: 0 },
  hero: {
    main: {
      eyebrow: 'Weekend drop · 20% off',
      title: 'Finds that feel like you.',
      text: 'Fresh tech, everyday essentials and standout style — all in one place, picked for real life.',
      ctaLabel: 'Shop today’s edit',
      link: '/products?on_sale=1',
      image: '',
    },
    side: {
      eyebrow: 'Sound, upgraded',
      title: 'Your new favourite headphones',
      link: '/products?search=headphones',
      image: '',
    },
    member: {
      eyebrow: 'Member perks',
      title: 'More perks. Zero fuss.',
      text: 'Early access, member pricing and free express delivery.',
      link: '/register',
    },
  },
};

const StoreContext = createContext({
  ...DEFAULT_STORE,
  logoUrl: '',
  loaded: false,
  reload: () => {},
});

const headTag = (selector, create) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
};
const setLink = (rel, href) => {
  headTag(`link[rel='${rel}']`, () =>
    Object.assign(document.createElement('link'), { rel })
  ).href = href;
};
const setMeta = (name, content) => {
  headTag(`meta[name='${name}']`, () =>
    Object.assign(document.createElement('meta'), { name })
  ).content = content;
};

/** Changes whenever the logo does, so browsers fetch the new icons. */
const iconKey = (src) => {
  let h = 0;
  for (const ch of src || 'default') h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};

export const StoreProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_STORE);
  const [loaded, setLoaded] = useState(false);
  // Remounts the app when the shop's currency turns out to differ from the
  // one remembered, so every price re-renders in the right currency.
  const [currencyKey, setCurrencyKey] = useState(getCurrency());
  const [remembered] = useState(hasRememberedCurrency);

  const reload = useCallback(
    () =>
      storeApi
        .get()
        .then((s) => {
          if (s.finance?.currency && s.finance.currency !== getCurrency()) {
            setCurrency(s.finance.currency);
          }
          setCurrencyKey(getCurrency());
          setSettings({
            ...DEFAULT_STORE,
            ...s,
            hero: s.hero || DEFAULT_STORE.hero,
          });
        })
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
    // Tab icon, home-screen name and icon, and the installed app's manifest
    // (made by the API from the same settings) all follow Store settings.
    const v = iconKey(settings.logo || settings.favicon);
    setLink('icon', settings.favicon || `/api/rest/app-icon/64.png?v=${v}`);
    setLink('apple-touch-icon', `/api/rest/app-icon/180.png?v=${v}`);
    setLink('manifest', `/api/rest/manifest.webmanifest?v=${v}`);
    setMeta('apple-mobile-web-app-title', settings.name);
    setMeta(
      'description',
      settings.tagline || `Shop online at ${settings.name}.`
    );
  }, [settings]);

  const value = useMemo(
    () => ({
      ...settings,
      logoUrl: settings.logo,
      loaded,
      reload,
    }),
    [settings, loaded, reload]
  );
  return (
    <StoreContext.Provider value={value}>
      {loaded || remembered ? (
        <React.Fragment key={currencyKey}>{children}</React.Fragment>
      ) : null}
    </StoreContext.Provider>
  );
};

StoreProvider.propTypes = { children: PropTypes.node.isRequired };

export const useStore = () => useContext(StoreContext);
