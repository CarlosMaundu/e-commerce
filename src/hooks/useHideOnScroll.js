// src/hooks/useHideOnScroll.js — true while the shopper scrolls down past
// the top of the page; false again as soon as they scroll up. Phones use it
// to slide the header away and give the page the whole screen.
import { useEffect, useState } from 'react';

const useHideOnScroll = (enabled, { offset = 120, slack = 8 } = {}) => {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return undefined;
    }
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < offset) setHidden(false);
        else if (y > last + slack) setHidden(true);
        else if (y < last - slack) setHidden(false);
        if (Math.abs(y - last) > slack) last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled, offset, slack]);

  return hidden;
};

export default useHideOnScroll;
