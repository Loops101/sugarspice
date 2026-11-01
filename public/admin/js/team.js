import { h, mount, fmtDay, fmtDateTime, toast, showFormError } from '/js/ui.js';
import { api } from '/js/api.js';
import { field, errorBox, showError, confirmDialog, openSheet, prettyPhone } from './common.js';

function addMember(done) {
  openSheet({
    title: 'Add employee',
    render(sheet) {
      const err = errorBox();
      const form = h('form', { id: 'tform', novalidate: true },
        h('p', { style: 'margin-top:0', text: 'Employees can handle orders, stock and products. They cannot see sales figures, coupons, settings or the team.' }), err,
        field('Full name', 'name', { maxlength: 80, autocomplete: 'off' }), field('Email (used to sign in)', 'email', { type: 'email', autocomplete: 'off' }),
        field('Phone', 'phone', { inputmode: 'tel', autocomplete: 'off' }, 'Optional'),
        field('Starting password', 'password', { type: 'text', autocomplete: 'off' }, 'At least 8 characters. Share it with them and ask them to change it under My account.'));
      sheet.body.append(form);
      const save = h('button', { class: 'btn btn-gold', type: 'submit', form: 'tform', text: 'Create account' });
      sheet.setFooter(h('button', { class: 'btn btn-glass', type: 'button', text: 'Cancel', onclick: sheet.close }), save);
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); err.hidden = true; save.disabled = true;
        const f = form.elements;
        try { await api('/admin/team', { method: 'POST', body: { name: f.name.value, email: f.email.value, phone: f.phone.value, password: f.password.value } }); toast('Employee added'); sheet.close(); done(); }
        catch (ex) { if (!showFormError(form, ex)) showError(err, ex); } finally { save.disabled = false; }
      });
    },
  });
}

function resetPassword(m, done) {
  openSheet({
    title: 'New password',
    render(sheet) {
      const err = errorBox();
      const form = h('form', { id: 'rform', novalidate: true }, h('p', { style: 'margin-top:0', text: `Set a new password for ${m.name}. They will be signed out on every device.` }), err,
        field('New password', 'password', { type: 'text', autocomplete: 'off' }, 'At least 8 characters'));
      sheet.body.append(form);
      const save = h('button', { class: 'btn btn-gold', type: 'submit', form: 'rform', text: 'Set password' });
      sheet.setFooter(h('button', { class: 'btn btn-glass', type: 'button', text: 'Cancel', onclick: sheet.close }), save);
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); err.hidden = true;
        try { await api('/admin/team/' + m.id, { method: 'PATCH', body: { password: form.elements.password.value } }); toast('Password changed'); sheet.close(); done(); }
        catch (ex) { if (!showFormError(form, ex)) showError(err, ex); }
      });
    },
  });
}

export async function render(root, ctx) {
  const list = h('div');
  mount(root, h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Team' }), h('p', { text: 'Give employees their own sign-in so you can see who did what.' })),
    h('button', { class: 'btn btn-gold', type: 'button', text: 'Add employee', onclick: () => addMember(load) })),
    h('div', { class: 'card-a', style: 'margin-bottom:16px' }, h('h2', { text: 'What each role can do' }),
      h('div', { class: 'grid-a g2', style: 'margin:0' },
        h('div', null, h('b', { text: 'Owner' }), h('p', { style: 'margin:6px 0 0;font-size:.95rem', text: 'Everything: sales analytics, orders, products, customers, coupons, delivery and payment settings, refunds, deleting products and managing the team.' })),
        h('div', null, h('b', { text: 'Employee' }), h('p', { style: 'margin:6px 0 0;font-size:.95rem', text: 'Orders (update status, mark paid, add notes), products and stock, and customer contact details. No sales figures, coupons, settings or team. Cannot cancel paid orders or record refunds.' })))),
    list);

  async function load() {
    const { team } = await api('/admin/team');
    mount(list, h('div', { class: 'card-a' }, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl stack' },
      h('thead', null, h('tr', null, ['Name', 'Role', 'Last sign-in', 'Status', ''].map((t) => h('th', { text: t })))),
      h('tbody', null, team.map((m) => {
        const me = m.id === ctx.user.id;
        const owner = m.role === 'admin';
        return h('tr', null,
          h('td', { 'data-label': 'Name' }, h('span', null, m.name + (me ? ' (you)' : ''), h('span', { class: 'sub', text: m.email }))),
          h('td', { 'data-label': 'Role' }, h('span', { class: 'pill ' + (owner ? '' : 'mute'), text: owner ? 'Owner' : 'Employee' })),
          h('td', { 'data-label': 'Last sign-in', text: m.lastLogin ? fmtDateTime(m.lastLogin) : 'Never' }),
          h('td', { 'data-label': 'Status' }, h('span', { class: 'pill ' + (m.disabled ? 'bad' : 'ok'), text: m.disabled ? 'Locked' : 'Active' })),
          h('td', { class: 'nolabel', style: 'text-align:right' }, owner ? null : h('div', { class: 'row-actions' },
            h('button', { class: 'btn btn-glass', type: 'button', text: 'New password', onclick: () => resetPassword(m, load) }),
            h('button', { class: 'btn btn-glass', type: 'button', text: m.disabled ? 'Unlock' : 'Lock', onclick: async () => {
              if (!m.disabled && !(await confirmDialog({ title: `Lock ${m.name}?`, message: 'They are signed out immediately and cannot sign in until you unlock them.', confirmText: 'Lock' }))) return;
              try { await api('/admin/team/' + m.id, { method: 'PATCH', body: { disabled: !m.disabled } }); load(); } catch (ex) { toast(ex.message, 'err'); }
            } }),
            h('button', { class: 'btn btn-glass', type: 'button', text: 'Remove', onclick: async () => {
              if (!(await confirmDialog({ title: `Remove ${m.name}?`, message: 'Their account is deleted. Past orders keep their name in the history.', confirmText: 'Remove', danger: true }))) return;
              try { await api('/admin/team/' + m.id, { method: 'DELETE' }); toast('Removed'); load(); } catch (ex) { toast(ex.message, 'err'); }
            } }))));
      }))))));
  }
  await load();
}
