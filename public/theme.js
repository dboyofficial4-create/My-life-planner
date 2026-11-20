// Apply the saved light/dark theme before first paint (a file, not inline, so the CSP can forbid inline scripts).
try { var t = localStorage.getItem('wp-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
