import { h, mount, toast, showFormError } from '/js/ui.js';
import { api } from '/js/api.js';
import { field, errorBox, showError } from './common.js';

export async function render(root, ctx) {
  const u = ctx.user;
  const err = errorBox();
  const form = h('form', { novalidate: true, class: 'card-a', style: 'max-width:520px' }, h('h2', { text: 'Change password' }),
    field('Current password', 'current', { type: 'password', autocomplete: 'current-password' }),
    field('New password', 'next', { type: 'password', autocomplete: 'new-password' }, 'At least 8 characters'), err,
    h('button', { class: 'btn btn-gold', type: 'submit', text: 'Update password' }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    try { await api('/account/password', { method: 'POST', body: { current: form.current.value, next: form.next.value } }); toast('Password updated'); form.reset(); } catch (ex) { if (!showFormError(form, ex)) showError(err, ex); }
  });
  mount(root,
    h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'My account' }), h('p', { text: 'Your sign-in details.' }))),
    h('div', { class: 'card-a', style: 'max-width:520px;margin-bottom:16px' }, h('h2', { text: 'Signed in as' }),
      h('div', { class: 'kv' }, h('span', { class: 'k', text: 'Name' }), h('div', { class: 'v', text: u.name })),
      h('div', { class: 'kv' }, h('span', { class: 'k', text: 'Email' }), h('div', { class: 'v', text: u.email })),
      h('div', { class: 'kv', style: 'margin:0' }, h('span', { class: 'k', text: 'Role' }), h('div', { class: 'v' }, h('span', { class: 'pill', text: u.role === 'admin' ? 'Owner' : 'Staff' })))),
    form);
}
