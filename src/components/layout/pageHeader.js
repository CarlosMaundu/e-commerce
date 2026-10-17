// src/components/layout/pageHeader.js — pages that want an app-style bar on
// phones (Back · title · actions) say so here; the header draws it instead
// of the greeting, search and bell.
//
//   usePageHeader({ title: 'My Cart', actions: <IconButton …/> })
//
// The title can change as the page scrolls (e.g. the product's name once its
// heading has gone off screen). Desktop ignores all of this.
//
// A page can also put one tool next to the phone search field (e.g. the
// product list's Filters button) with usePageTool(<IconButton …/>).
//
// Two contexts on purpose: pages only get the (never-changing) setter, so the
// header updating doesn't re-render the page that set it.
import React, { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const SetContext = createContext(() => {});
const ConfigContext = createContext(null);
const SetToolContext = createContext(() => {});
const ToolContext = createContext(null);

export const PageHeaderProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [tool, setTool] = useState(null);
  return (
    <SetContext.Provider value={setConfig}>
      <SetToolContext.Provider value={setTool}>
        <ConfigContext.Provider value={config}>
          <ToolContext.Provider value={tool}>{children}</ToolContext.Provider>
        </ConfigContext.Provider>
      </SetToolContext.Provider>
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

/** For the header: the tool the current page put beside the search field. */
export const usePageToolNode = () => useContext(ToolContext);

/** For pages: show a tool beside the phone search field while mounted. */
export const usePageTool = (node) => {
  const setTool = useContext(SetToolContext);
  useEffect(() => {
    setTool(node);
  }, [setTool, node]);
  useEffect(() => () => setTool(null), [setTool]);
};
