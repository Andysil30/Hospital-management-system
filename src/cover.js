// Insurance / SHA cover check.
// DEMONSTRATION ONLY: a real check needs an agreement and an integration with the Social
// Health Authority or the insurer. Here a member number of 8 or more letters/digits counts as "verified".
const PROVIDERS = ['SHA (Social Health Authority)', 'Private insurance', 'Employer scheme', 'Other'];

function checkCover(provider, number) {
  const p = String(provider || '').trim();
  const n = String(number || '').replace(/[\s-]/g, '');
  if (!p || p === 'None') return { provider: null, number: null, status: 'none' };
  if (!/^[A-Za-z0-9]{1,30}$/.test(n)) return { provider: p, number: n || null, status: 'not_found' };
  return { provider: p, number: n, status: n.length >= 8 ? 'verified' : 'not_found' };
}

module.exports = { PROVIDERS, checkCover };
