// Explanations describe capability and legitimate uses, never actual behavior.
const entry = (what, uses, recommendation) => ({ what, uses, recommendation });

export const extensionPermissionCatalog = {
  activeTab: entry('Temporary access to a tab after you invoke the extension.', 'Page tools you run on demand.', 'Check what the tool does when you click it.'),
  tabs: entry('May read sensitive tab metadata such as addresses and titles; this is not page content access by itself.', 'Tab organizers or tools that work with current pages.', 'Review whether it needs visibility into your open tabs.'),
  history: entry('May read and modify your browsing history, giving visibility into sites you have visited.', 'History search or history-management tools.', 'Review whether history access matches its purpose.'),
  cookies: entry('May read or change cookies on sites covered by its host permissions. Cookies can contain session information.', 'Cookie managers or browser debugging tools.', 'Review which sites it can access and whether cookie access is necessary.'),
  downloads: entry('Can interact with browser downloads, including querying and managing them.', 'Download managers or batch-export tools.', 'Review whether download access fits the feature you use.'),
  bookmarks: entry('May read, create, change, or remove your bookmarks.', 'Bookmark organizers or import/export tools.', 'Review whether it needs access to your saved sites.'),
  clipboardRead: entry('May read clipboard content, which can include text you copied from elsewhere.', 'Clipboard managers or paste helpers.', 'Review whether reading your clipboard is necessary.'),
  clipboardWrite: entry('May write data to your clipboard.', 'Copy buttons or formatting helpers.', 'Check that copied content matches what you expected.'),
  geolocation: entry('May request your location through the browser, subject to device and browser rules.', 'Maps or nearby-service tools.', 'Review whether a typed location would be enough.'),
  management: entry('Can read installed-item metadata and has access to management actions such as enabling or removing extensions.', 'Extension managers or permission-auditing tools.', 'Review the purpose carefully; this permission is not read-only by itself.'),
  webRequest: entry('May observe browser network request information for permitted hosts; blocking capability depends on browser and manifest rules.', 'Request inspectors or privacy tools.', 'Review the host scope and the purpose of inspecting requests.'),
  webNavigation: entry('May observe browser navigation events and destination information.', 'Navigation helpers or page-transition tools.', 'Review whether navigation visibility is needed.'),
  notifications: entry('Can show browser notifications.', 'Reminders or alerts you requested.', 'Keep only alerts you find useful.'),
  storage: entry('Can save extension data in browser storage, including local or synced settings. This permission alone does not give access to browsing history or page content.', 'Saving preferences, notes, or settings.', 'Check what data it saves and whether it syncs data. This audit does not inspect saved data or retention.'),
  scripting: entry('Can inject scripts or styles into pages when it also has appropriate host access or a temporary tab grant.', 'Page customization or accessibility helpers.', 'Review the websites where it can run code.'),
  debugger: entry('Can attach to browser debugging targets and inspect or control supported browser behavior.', 'Developer or browser-testing tools.', 'Review carefully whether debugging capability is expected.'),
  proxy: entry('Can configure browser proxy settings, affecting how browser connections are routed.', 'Proxy managers or network configuration tools.', 'Review whether connection-routing control matches its purpose.'),
  nativeMessaging: entry('Can communicate with separately installed native applications outside the browser sandbox.', 'Password managers or desktop companion tools.', 'Review the desktop companion and why communication is needed.'),
  contentSettings: entry('Can read and change browser site content settings.', 'Site-setting managers or privacy utilities.', 'Review whether it explains or changes settings as expected.')
};

export function explainExtensionPermission(name) {
  return { name, ...(Object.prototype.hasOwnProperty.call(extensionPermissionCatalog, name) ? extensionPermissionCatalog[name] : entry(
    'Chrome reports this API permission. This prototype has no detailed local explanation for it.',
    'Uses depend on the extension and this permission.',
    'Compare the permission with browser details and the extension’s stated purpose.'
  )) };
}
