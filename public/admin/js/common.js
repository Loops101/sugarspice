// Shared admin helpers: labels, pills, dialogs, side sheet, form fields.
import { h, $, icon, mount, trapFocus, kes } from '/js/ui.js';
import { media } from '/js/card.js';

export const STATUS_LABEL = {
  awaiting_payment: 'Awaiting payment', new: 'New', processing: 'Preparing', out_for_delivery: 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_TONE = { awaiting_payment: 'warn', new: '', processing: '', out_for_delivery: '', completed: 'ok', cancelled: 'bad' };
export const statusPill = (s) => h('span', { class: 'pill ' + (STATUS_TONE[s] || ''), text: STATUS_LABEL[s] || s });

const PAY_LABEL = { paid: 'Paid', unpaid: 'Unpaid', refund_due: 'Refund due', refunded: 'Refunded' };
const PAY_TONE = { paid: 'ok', unpaid: 'mute', refund_due: 'bad', refunded: 'mute' };
export const payPill = (s) => h('span', { class: 'pill ' + (PAY_TONE[s] || ''), text: PAY_LABEL[s] || s });
export const methodLabel = (m) => (m === 'mpesa' ? 'M-Pesa' : 'Pay on delivery');

export const thumb = (p) => h('div', { class: 'thumb-s' }, media(p, { width: 92 }));
export const waLink = (phone, text) => `https://wa.me/${phone}${text ? '?text=' + encodeURIComponent(text) : ''}`;
export const prettyPhone = (p) => (/^254\d{9}$/.test(p) ? `0${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p);

export const field = (label, name, attrs = {}, hint) => h('div', { class: 'field' },
  h('label', { for: 'x-' + name, text: label }), h('input', { class: 'input', id: 'x-' + name, name, ...attrs }), hint ? h('span', { style: 'color:var(--faint);font-size:.86rem', text: hint }) : null);
export const errorBox = () => h('div', { class: 'form-error', role: 'alert', hidden: true });
export const showError = (box, err) => { box.textContent = err.message || String(err); box.hidden = false; box.scrollIntoView({ block: 'nearest' }); };

/** Accessible confirm dialog. Resolves true / false. */
export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const box = h('div', { class: 'box glass', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'cd-t', 'aria-describedby': 'cd-m' },
      h('h2', { id: 'cd-t', text: title }), h('p', { id: 'cd-m', text: message }),
      h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px' },
        h('button', { class: 'btn btn-glass', type: 'button', id: 'cd-no', text: 'Cancel' }),
        h('button', { class: 'btn ' + (danger ? 'btn-glass' : 'btn-gold'), type: 'button', id: 'cd-yes', style: danger ? 'border-color:var(--bad);color:var(--bad)' : '', text: confirmText })));
    const modal = h('div', { class: 'modal' }, box);
    document.body.append(modal);
    let release;
    const done = (v) => { release(); modal.remove(); resolve(v); };
    release = trapFocus(modal, () => done(false));
    $('#cd-no', box).addEventListener('click', () => done(false));
    $('#cd-yes', box).addEventListener('click', () => done(true));
    $('#cd-no', box).focus();
  });
}

/** Right-hand sheet used for order details and product editing. */
export function openSheet({ title, render, footer }) {
  const body = h('div', { class: 'body' });
  const foot = h('div', { class: 'foot' });
  const titleEl = h('h2', { id: 'sheet-t', text: title });
  const panel = h('div', { class: 'panel-a', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-t' },
    h('div', { class: 'head' }, titleEl, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', id: 'sheet-x' }, icon('close'))), body, foot);
  const sheet = h('div', { class: 'sheet-a' }, h('div', { class: 'scrim' }), panel);
  document.body.append(sheet);
  document.body.style.overflow = 'hidden';
  let release;
  const api = {
    body, foot, setTitle: (t) => { titleEl.textContent = t; },
    close() { release && release(); sheet.remove(); document.body.style.overflow = ''; },
    setFooter(...kids) { mount(foot, ...kids); foot.hidden = !kids.filter(Boolean).length; },
  };
  release = trapFocus(sheet, () => api.close());
  $('#sheet-x', sheet).addEventListener('click', api.close);
  $('.scrim', sheet).addEventListener('click', api.close);
  render(api);
  return api;
}

export { kes };

export const checkbox = (label, name, checked, hint) => h('label', { class: 'choice', style: 'margin:0;padding:12px 16px' },
  h('input', { type: 'checkbox', name, checked: !!checked }), h('span', { class: 'grow' }, h('strong', { text: label }), hint ? h('small', { text: hint }) : null));
