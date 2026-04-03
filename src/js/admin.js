// Initial Data payload simulation (Normally localized via wp_localize_script)
let adminConfigData = {
  items: [
    { id: "small_box", name: "Small Box", desc: "(45 x 30 x 30cm)", price: 4.5 },
    { id: "medium_box", name: "Medium box", desc: "(45 x 40 x 40cm)", price: 6.0 },
    { id: "large_box", name: "Large box", desc: "(70 x 45 x 45cm)", price: 8.5 },
    { id: "suitcase", name: "Suitcase", desc: "(must be in a box or have a hard shell)", price: 7.0 },
    { id: "medium_bag", name: "Medium bag", desc: "Holdall or duffel bag", price: 6.0 },
    { id: "guitar", name: "Guitar", desc: "Acoustic or electric", price: 9.0 },
    { id: "plastic_box", name: "Medium plastic box", desc: "Heavy-duty crate", price: 7.5 },
  ]
};

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
  }[tag]));
}

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('itemsTableBody');
  const addItemBtn = document.getElementById('addItemBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const toast = document.getElementById('toast');

  // Render Table
  function renderTable() {
    tableBody.innerHTML = '';
    adminConfigData.items.forEach((item, index) => {
      const idSafe = escapeHTML(item.id);
      const nameSafe = escapeHTML(item.name);
      const descSafe = escapeHTML(item.desc);
      const priceSafe = escapeHTML(String(item.price));

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="inline-input" value="${idSafe}" data-index="${index}" data-field="id" /></td>
        <td><input type="text" class="inline-input" value="${nameSafe}" data-index="${index}" data-field="name" /></td>
        <td><input type="text" class="inline-input" value="${descSafe}" data-index="${index}" data-field="desc" /></td>
        <td><input type="number" class="inline-input" value="${priceSafe}" step="0.01" data-index="${index}" data-field="price" /></td>
        <td>
          <button class="btn btn-danger-ghost delete-row-btn" data-index="${index}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // Attach listeners
    document.querySelectorAll('.inline-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.getAttribute('data-index');
        const field = e.target.getAttribute('data-field');
        let val = e.target.value;
        if (field === 'price') val = parseFloat(val) || 0;
        adminConfigData.items[id][field] = val;
      });
    });

    document.querySelectorAll('.delete-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.getAttribute('data-index'));
        adminConfigData.items.splice(id, 1);
        renderTable();
      });
    });
  }

  addItemBtn.addEventListener('click', () => {
    adminConfigData.items.push({ id: `item_${Date.now()}`, name: "New Item", desc: "", price: 0 });
    renderTable();
  });

  saveSettingsBtn.addEventListener('click', () => {
    saveSettingsBtn.innerHTML = `Saving...`;
    saveSettingsBtn.style.opacity = '0.7';

    // Simulated API call payload
    const payload = {
      globalDiscount: document.getElementById('globalDiscount').value,
      baseFeeBoxes: document.getElementById('baseFeeBoxes').value,
      baseFeeFurniture: document.getElementById('baseFeeFurniture').value,
      allowedPostcodes: document.getElementById('allowedPostcodes').value.split('\n').map(p => p.trim()).filter(Boolean),
      items: adminConfigData.items
    };

    console.log("Saving to WP REST API:", payload);

    setTimeout(() => {
      saveSettingsBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save Changes
      `;
      saveSettingsBtn.style.opacity = '1';
      
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }, 800);
  });

  // Init
  renderTable();
});
