function paragraph(document, text, className) {
  const element = document.createElement('p');
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function section(document, parent, title, entries) {
  const heading = document.createElement('h2');
  heading.textContent = title;
  parent.append(heading);
  const list = document.createElement('ul');
  for (const text of entries) {
    const item = document.createElement('li');
    item.textContent = text;
    list.append(item);
  }
  parent.append(list);
}

export function clearAuditView(document) {
  document.getElementById('extension-list').replaceChildren();
  for (const id of ['inventory-summary', 'inventory-note']) document.getElementById(id).textContent = '';
  document.getElementById('extension-search').value = '';
  document.getElementById('extension-filter').value = 'all';
}

export function setAuditBusy(document, busy) {
  document.getElementById('audit').setAttribute('aria-busy', String(busy));
  for (const id of ['read-again', 'extension-search', 'extension-filter']) document.getElementById(id).disabled = busy;
}

export function renderAudit(document, inventory, shown) {
  const list = document.getElementById('extension-list');
  list.replaceChildren();
  if (!inventory.available) {
    document.getElementById('inventory-summary').textContent = 'Extension audit unavailable.';
    document.getElementById('inventory-note').textContent = 'The browser could not return installed-extension information. Check the management permission and reopen this page.';
    return;
  }
  const needsReview = inventory.items.filter(item => item.status !== 'Normal').length;
  document.getElementById('inventory-summary').textContent = `${inventory.items.length} extensions shown · ${needsReview} with review signals · ${shown.length} match the filter`;
  document.getElementById('inventory-note').textContent = `PrivacyLens itself, apps, and themes are omitted. Review counts include disabled extensions and describe listed capabilities, not activity.${inventory.skipped ? ` ${inventory.skipped} malformed or duplicate records could not be included.` : ''}`;
  if (!shown.length) {
    list.append(paragraph(document, inventory.items.length ? 'No extensions match this search or filter.' : 'No other extension items were returned for this audit.', 'empty'));
  }
  for (const item of shown) {
    const details = document.createElement('details');
    details.className = 'extension-row';
    const summary = document.createElement('summary');
    for (const [text, className] of [[item.name, 'extension-name'], [item.stateLabel, 'state'], [item.status, 'status']]) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      if (className === 'status') span.dataset.status = item.status;
      summary.append(span);
    }
    const capabilities = document.createElement('span');
    capabilities.className = 'capabilities';
    capabilities.textContent = item.capabilitySummary.length ? item.capabilitySummary.join(' · ')
      : 'Expand to review the browser-reported permissions and their explanations.';
    summary.append(capabilities);
    details.append(summary);
    if (item.description) details.append(paragraph(document, item.description, 'metadata'));
    details.append(paragraph(document, `Type: ${item.type === 'login_screen_extension' ? 'Login-screen extension' : 'Extension'}${item.version ? ` · Version: ${item.version}` : ''}${item.installType ? ` · Install type: ${item.installType}` : ''}`, 'metadata'));
    details.append(paragraph(document, item.stateExplanation));
    section(document, details, 'What was noticed', item.reasons.length ? item.reasons : ['No review rule matched these limited capability checks. Normal is not a guarantee of safety.']);
    details.append(paragraph(document, 'Why this matters: These are listed capabilities, not proof of behavior. Review whether they match the features you use.'));
    details.append(paragraph(document, `Consider: ${item.recommendation}`));
    const permissionsHeading = document.createElement('h2');
    permissionsHeading.textContent = 'API permissions reported by Chrome';
    details.append(permissionsHeading);
    const permissionList = document.createElement('ul');
    for (const permission of item.permissionDetails) {
      const row = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = permission.name;
      row.append(name, paragraph(document, permission.what), paragraph(document, `Common uses: ${permission.uses}`), paragraph(document, `Consider: ${permission.recommendation}`));
      permissionList.append(row);
    }
    details.append(permissionList);
    if (!item.permissionDetails.length) details.append(paragraph(document, 'No API permissions listed in the returned data.'));
    section(document, details, 'Host access reported by Chrome', item.hostDetails.length
      ? item.hostDetails.map(host => `${host.pattern} — ${host.explanation} ${host.recommendation}`)
      : ['No host patterns listed in the returned data. This is not a complete original manifest or a guarantee of no page access.']);
    section(document, details, 'Chrome-generated permission warnings', item.warningsAvailable
      ? item.warnings.length ? item.warnings : ['Chrome returned no permission warnings. This is not a safety guarantee.']
      : ['Chrome permission warnings could not be read. Other reported metadata is still shown.']);
    list.append(details);
  }
}
