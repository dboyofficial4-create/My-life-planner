export type ThemePref = 'system' | 'light' | 'dark';

export function getTheme(): ThemePref {
  try {
    const t = localStorage.getItem('wp-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(t: ThemePref) {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === 'system') localStorage.removeItem('wp-theme');
    else localStorage.setItem('wp-theme', t);
  } catch {
    /* storage unavailable: preference lasts for this visit only */
  }
}
