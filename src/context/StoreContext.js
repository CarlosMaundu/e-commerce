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
      link: '/signup',
    },
  },
};

const StoreContext = createContext({
  ...DEFAULT_STORE,
  logoUrl: '',
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
    if (settings.favicon) setFavicon(settings.favicon);
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
