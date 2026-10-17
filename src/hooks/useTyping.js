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
    // Into a field: hide the menu at once. Out of one: wait before showing
    // it again. Tapping a button (e.g. Send) moves focus to it between the
    // finger going down and up; showing the menu straight away would put it
    // under the finger and swallow the tap.
    let timer = 0;
    const check = () => {
      clearTimeout(timer);
      if (isTextField(document.activeElement)) setTyping(true);
      else timer = setTimeout(() => setTyping(false), 400);
    };
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);
  return typing;
};

export default useTyping;
