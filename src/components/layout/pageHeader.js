// src/components/layout/pageHeader.js — pages that want an app-style bar on
// phones (Back · title · actions) say so here; the header draws it instead
// of the greeting, search and bell.
//
//   usePageHeader({ title: 'My Cart', actions: <IconButton …/> })
//
// The title can change as the page scrolls (e.g. the product's name once its
// heading has gone off screen). Desktop ignores all of this.
//
// Two contexts on purpose: pages only get the (never-changing) setter, so the
// header updating doesn't re-render the page that set it.
import React, { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const SetContext = createContext(() => {});
const ConfigContext = createContext(null);

export const PageHeaderProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  return (
    <SetContext.Provider value={setConfig}>
      <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
    </SetContext.Provider>
  );
};
PageHeaderProvider.propTypes = { children: PropTypes.node };

/** For the header: the current page's bar, or null for the default one. */
export const usePageHeaderConfig = () => useContext(ConfigContext);

/**
 * For pages: show { title, actions } in the phone header while mounted.
 * enabled: false leaves the header to a child that sets its own.
 */
export const usePageHeader = ({ title, actions = null, enabled = true }) => {
  const setConfig = useContext(SetContext);
  useEffect(() => {
    if (enabled) setConfig({ title, actions });
  }, [setConfig, title, actions, enabled]);
  useEffect(
    () => () => {
      if (enabled) setConfig(null);
    },
    [setConfig, enabled]
  );
};
