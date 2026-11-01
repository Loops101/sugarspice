import { h, mount, kes, icon, toast, debounce } from '/js/ui.js';
import { api } from '/js/api.js';
import { thumb, openSheet, confirmDialog, field, errorBox, showError, checkbox } from './common.js';
import { showFormError } from '/js/ui.js';

const ARTS = [['', 'Automatic'], ['necklace', 'Necklace'], ['earrings', 'Earrings'], ['bracelet', 'Bracelet'], ['ring', 'Ring'], ['set', 'Set'], ['chain', 'Chain']];

async function editProduct(p, categories, done) {
  const isNew = !p;
  const data = p ? { ...p, images: [...(p.images || [])] } : { name: '', category: categories[0], price: '', oldPrice: '', stock: 1, images: [], description: '', featured: false, bestseller: false, active: true, art: '' };
  openSheet({
    title: isNew ? 'Add product' : 'Edit product',
    render(sheet) {
      const err = errorBox();
      const photos = h('div', { class: 'photo-grid' });
      const drawPhotos = () => mount(photos,
        data.images.map((src, i) => h('div', { class: 'photo' }, h('img', { src, alt: `Photo ${i + 1}` }), h('button', { type: 'button', 'aria-label': `Remove photo ${i + 1}`, onclick: () => { data.images.splice(i, 1); drawPhotos(); } }, icon('close')))),
        data.images.length < 6 ? h('label', { class: 'upload-btn' }, icon('image', 22), h('span', { text: 'Add photo' }),
          h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr-only', onchange: async (e) => {
            for (const f of [...e.target.files].slice(0, 6 - data.images.length)) {
              try { const r = await api('/admin/upload', { method: 'POST', raw: f, headers: { 'Content-Type': 'application/octet-stream' } }); data.images.push(r.url); } catch (ex) { toast(ex.message, 'err'); }
            }
            drawPhotos();
          } })) : null);
      drawPhotos();
      const catSel = h('select', { class: 'input', id: 'x-category', name: 'category' }, categories.map((c) => h('option', { value: c, selected: c === data.category, text: c })));
      const artSel = h('select', { class: 'input', id: 'x-art', name: 'art' }, ARTS.map(([v, l]) => h('option', { value: v, selected: v === (data.art || ''), text: l })));
      const form = h('form', { id: 'pform', novalidate: true },
        h('div', { class: 'field' }, h('span', { class: 'label', text: 'Photos' }), photos, h('span', { style: 'color:var(--faint);font-size:.86rem', text: 'JPG, PNG or WebP up to 5 MB. The first photo is the cover. Without photos a drawn illustration is shown.' })),
        err,
        field('Name', 'name', { value: data.name, maxlength: 100, required: true }),
        h('div', { class: 'field' }, h('label', { for: 'x-category', text: 'Category' }), catSel),
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
          field('Price (KSh)', 'price', { value: data.price, inputmode: 'numeric' }), field('Old price (KSh)', 'oldPrice', { value: data.oldPrice || '', inputmode: 'numeric' }, 'Optional, shows a sale')),
        field('Stock', 'stock', { value: data.stock, inputmode: 'numeric' }),
        h('div', { class: 'field' }, h('label', { for: 'x-description', text: 'Description' }), h('textarea', { class: 'input', id: 'x-description', name: 'description', maxlength: 1500, text: data.description || '' })),
        !isNew ? null : h('div', { class: 'field' }, h('label', { for: 'x-art', text: 'Illustration when there is no photo' }), artSel),
        h('div', { class: 'switch-row' }, checkbox('Show in shop', 'active', data.active), checkbox('Featured on home', 'featured', data.featured), checkbox('Bestseller', 'bestseller', data.bestseller)));
      sheet.body.append(form);
      const save = h('button', { class: 'btn btn-gold', type: 'submit', form: 'pform', text: isNew ? 'Add product' : 'Save changes' });
      sheet.setFooter(h('button', { class: 'btn btn-glass', type: 'button', text: 'Cancel', onclick: sheet.close }), save);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.hidden = true;
        const f = form.elements;
        const body = { name: f.name.value, category: f.category.value, price: f.price.value, oldPrice: f.oldPrice.value, stock: f.stock.value, description: f.description.value,
          images: data.images, active: f.active.checked, featured: f.featured.checked, bestseller: f.bestseller.checked, art: f.art ? f.art.value : undefined };
        save.disabled = true;
        try {
          await api(isNew ? '/admin/products' : '/admin/products/' + p.id, { method: isNew ? 'POST' : 'PUT', body });
          toast(isNew ? 'Product added' : 'Saved'); sheet.close(); done();
        } catch (ex) { if (!showFormError(form, ex)) showError(err, ex); } finally { save.disabled = false; }
      });
    },
  });
}

export async function render(root, ctx) {
  const [{ products }, { settings }] = await Promise.all([api('/admin/products'), api('/admin/settings')]);
  let q = ctx.params.get('q') || '';
  let cat = '';
  const list = h('div');
  const search = h('input', { class: 'input grow', type: 'search', value: q, placeholder: 'Search products', 'aria-label': 'Search products', oninput: debounce(() => { q = search.value.trim().toLowerCase(); draw(); }, 150) });
  const catSel = h('select', { class: 'input', 'aria-label': 'Category', onchange: () => { cat = catSel.value; draw(); } }, h('option', { value: '', text: 'All categories' }), settings.categories.map((c) => h('option', { value: c, text: c })));
  const reload = async () => { const r = await api('/admin/products'); products.splice(0, products.length, ...r.products); draw(); };
  mount(root, h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Products' }), h('p', { text: 'Add pieces, update stock and prices, and hide what you no longer sell.' })),
    h('button', { class: 'btn btn-gold', type: 'button', onclick: () => editProduct(null, settings.categories, reload) }, icon('plus'), ' Add product')),
    h('div', { class: 'toolbar' }, search, catSel), list);

  function draw() {
    const rows = products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => b.createdAt - a.createdAt);
    if (!rows.length) { mount(list, h('div', { class: 'card-a empty-a', text: products.length ? 'No products match.' : 'No products yet. Add your first piece.' })); return; }
    mount(list, h('div', { class: 'card-a' }, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl stack' },
      h('thead', null, h('tr', null, ['Product', 'Price', 'Stock', 'Visible', ''].map((t) => h('th', { text: t })))),
      h('tbody', null, rows.map((p) => {
        const stock = h('input', { class: 'input stock-in', inputmode: 'numeric', value: p.stock, 'aria-label': `Stock for ${p.name}` });
        stock.addEventListener('change', async () => {
          try { const r = await api(`/admin/products/${p.id}/stock`, { method: 'PATCH', body: { stock: stock.value } }); p.stock = r.product.stock; stock.value = p.stock; toast('Stock updated'); } catch (ex) { toast(ex.message, 'err'); stock.value = p.stock; }
        });
        return h('tr', null,
          h('td', { class: 'nolabel' }, h('div', { class: 'cell-prod' }, thumb(p), h('span', null, p.name, h('span', { class: 'sub', text: p.category + (p.images && p.images.length ? '' : ' · No photo yet') })))),
          h('td', { class: 'num', 'data-label': 'Price' }, kes(p.price), p.oldPrice ? h('span', { class: 'sub', style: 'text-decoration:line-through', text: kes(p.oldPrice) }) : null),
          h('td', { 'data-label': 'Stock' }, stock),
          h('td', { 'data-label': 'Visible' }, h('span', { class: 'pill ' + (p.active ? 'ok' : 'mute'), text: p.active ? 'Live' : 'Hidden' })),
          h('td', { class: 'nolabel', style: 'text-align:right;white-space:nowrap' },
            h('button', { class: 'btn btn-glass', type: 'button', style: 'min-height:44px;padding:0 16px', text: 'Edit', onclick: () => editProduct(p, settings.categories, reload) }), ' ',
            ctx.user.role !== 'admin' ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${p.name}`, onclick: async () => {
              if (!(await confirmDialog({ title: `Delete ${p.name}?`, message: 'If it has been ordered before it is hidden instead, so past orders stay intact.', confirmText: 'Delete', danger: true }))) return;
              try { const r = await api('/admin/products/' + p.id, { method: 'DELETE' }); toast(r.archived ? 'Hidden, it has past orders' : 'Deleted'); reload(); } catch (ex) { toast(ex.message, 'err'); }
            } }, icon('trash'))));
      }))))));
  }
  draw();
}
