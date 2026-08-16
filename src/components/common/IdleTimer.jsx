import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

const TIMEOUT_MS = 60 * 60 * 1000;

const IdleTimer = () => {
  const logout = useAuthStore(state => state.logout);
  const timerRef = useRef(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      logout();
    }, TIMEOUT_MS);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    resetTimer();

    for (const evt of events) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of events) {
        window.removeEventListener(evt, resetTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout]);

  return null;
};

export default IdleTimer;
