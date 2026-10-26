/* Legal help settings.
   api: paste your Cloudflare Worker address here (for example "https://comegrab-legal.YOURNAME.workers.dev").
        While it is empty, the page works in search-only mode: it shows the matching sections of the laws.
   freeLimit: number of free questions per visitor per day (the Worker enforces the real limit; keep these the same).
   whatsapp / email: where the "Talk to a person" buttons send the visitor. */
window.LEGAL_CONFIG = {
  api: '',
  freeLimit: 5,
  whatsapp: '919582237599',
  email: 'epraagn@gmail.com'
};
