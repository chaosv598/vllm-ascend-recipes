import { useEffect, useState } from 'react';

export default function LanguageToggle() {
  const [lang, setLang] = useState<'en' | 'zh'>('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang') as 'en' | 'zh' | null;
    if (saved) {
      setLang(saved);
      document.documentElement.lang = saved;
    } else {
      document.documentElement.lang = 'en';
    }
  }, []);

  const toggle = () => {
    const next = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    localStorage.setItem('lang', next);
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent('langchange', { detail: next }));
  };

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      aria-label="Toggle language"
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  );
}
