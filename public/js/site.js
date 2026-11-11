// Public pages: highlight the current page in the menu.
$$('.site-links a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === location.pathname));
