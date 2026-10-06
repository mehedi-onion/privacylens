import { permissionUses, dataBoundaries, limitations } from './transparency-data.js';

export function renderTransparency(document) {
  const paragraph = (parent, label, text) => {
    const node = document.createElement('p'); const heading = document.createElement('strong');
    heading.textContent = label; node.append(heading, document.createTextNode(text)); parent.append(node);
  };
  const permissions = document.getElementById('permission-uses'); permissions.replaceChildren();
  for (const entry of permissionUses) {
    const details = document.createElement('details'); const summary = document.createElement('summary');
    summary.textContent = `${entry.title} — ${entry.permission}${entry.optional ? ' (optional)' : ''}`; details.append(summary);
    for (const [label, text] of [['Why', entry.why], ['What PrivacyLens does', entry.uses],
      ['What it does not do', entry.doesNot], ['Chrome capability boundary', entry.boundary]]) paragraph(details, label, text);
    permissions.append(details);
  }
  const rows = document.getElementById('boundary-rows'); rows.replaceChildren();
  for (const entry of dataBoundaries) {
    const row = document.createElement('tr');
    for (const field of ['feature', 'local', 'external', 'persisted']) {
      const cell = document.createElement(field === 'feature' ? 'th' : 'td');
      if (field === 'feature') cell.setAttribute('scope', 'row');
      cell.textContent = entry[field]; row.append(cell);
    }
    rows.append(row);
  }
  const list = document.getElementById('limitation-list'); list.replaceChildren();
  for (const text of limitations) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
}
if (typeof document !== 'undefined') renderTransparency(document);
