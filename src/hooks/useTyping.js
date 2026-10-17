// src/hooks/useTyping.js — true while a text field has focus on a touch
// screen, i.e. while the on-screen keyboard is likely open. The bottom menu
// steps aside then, so it never covers the field or its Send/Save button.
import { useEffect, useState } from 'react';

const TEXT_INPUTS =
  /^(text|search|email|tel|url|password|number|date|time|datetime-local)$/i;

const isTextField = (el) => {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUTS.test(el.type || 'text');
};

const touch = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

const useTyping = () => {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!touch()) return undefined;
    const update = () => setTyping(isTextField(document.activeElement));
    // focusout fires before the next field gets focus: wait a tick.
    const later = () => setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', later);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', later);
    };
  }, []);
  return typing;
};

export default useTyping;
