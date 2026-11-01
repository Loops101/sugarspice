import { $, showFormError } from '../ui.js';
import { initLayout } from '../layout.js';
import { api } from '../api.js';

await initLayout();
const form = $('#track-form');
const banner = $('.form-error', form);
const fromUrl = new URLSearchParams(location.search).get('n');
if (fromUrl) form.elements.number.value = fromUrl.slice(0, 20);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  banner.hidden = true;
  const btn = form.querySelector('button'); btn.disabled = true;
  try {
    const { order } = await api('/orders/lookup', { method: 'POST', body: { number: form.elements.number.value, phone: form.elements.phone.value } });
    location.href = `/order.html?n=${encodeURIComponent(order.number)}&t=${encodeURIComponent(order.token)}`;
  } catch (err) {
    btn.disabled = false;
    if (!showFormError(form, err)) { banner.textContent = err.message; banner.hidden = false; }
  }
});
