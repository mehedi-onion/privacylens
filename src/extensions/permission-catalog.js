// Explanations describe capability and legitimate uses, never actual behavior.
const entry = (what, uses, recommendation) => ({ what, uses, recommendation });

export const extensionPermissionCatalog = {
  activeTab: entry('Gets temporary access to a tab after you click or otherwise run the extension.', 'Page tools you run when needed.', 'Check what the tool does when you click it.'),
  tabs: entry('May read tab addresses and titles. On its own, this does not allow reading page contents.', 'Tab organizers or tools that work with current pages.', 'Check whether it needs to see your open tabs.'),
  history: entry('May read and modify your browsing history, giving visibility into sites you have visited.', 'History search or history-management tools.', 'Review whether history access matches its purpose.'),
  cookies: entry('May read or change cookies on sites covered by its host permissions. Cookies can contain session information.', 'Cookie managers or browser debugging tools.', 'Review which sites it can access and whether cookie access is necessary.'),
  downloads: entry('Can look up and manage browser downloads.', 'Download managers or tools that export several files.', 'Check whether download access fits the feature you use.'),
  bookmarks: entry('May read, create, change, or remove your bookmarks.', 'Bookmark organizers or import/export tools.', 'Review whether it needs access to your saved sites.'),
  clipboardRead: entry('May read clipboard content, which can include text you copied from elsewhere.', 'Clipboard managers or paste helpers.', 'Review whether reading your clipboard is necessary.'),
  clipboardWrite: entry('May write data to your clipboard.', 'Copy buttons or formatting helpers.', 'Check that copied content matches what you expected.'),
  geolocation: entry('May request your location. Browser and device settings can still limit access.', 'Maps or tools for finding nearby places.', 'Consider whether typing a location would be enough.'),
  management: entry('Can read installed-item metadata and has access to management actions such as enabling or removing extensions.', 'Extension managers or permission-auditing tools.', 'Review the purpose carefully; this permission is not read-only by itself.'),
  webRequest: entry('May observe browser network request information for permitted hosts; blocking capability depends on browser and manifest rules.', 'Request inspectors or privacy tools.', 'Review the host scope and the purpose of inspecting requests.'),
  webNavigation: entry('May observe browser navigation events and destination information.', 'Navigation helpers or page-transition tools.', 'Review whether navigation visibility is needed.'),
  notifications: entry('Can show browser notifications.', 'Reminders or alerts you requested.', 'Keep only alerts you find useful.'),
  storage: entry('Can save extension data in browser storage, including local or synced settings. This permission alone does not give access to browsing history or page content.', 'Saving preferences, notes, or settings.', 'Check what data it saves and whether it syncs data. This audit does not inspect saved data or retention.'),
  scripting: entry('Can run scripts or add styles on pages where it has website access or a temporary tab grant.', 'Page customization or accessibility helpers.', 'Check which websites it can run code on.'),
  debugger: entry('Can use Chrome’s debugging tools to inspect or control parts of the browser.', 'Developer or browser-testing tools.', 'Check carefully whether you expect it to need debugging access.'),
  proxy: entry('Can change browser proxy settings, which control where browser connections are routed.', 'Proxy managers or network configuration tools.', 'Check whether it needs control over how you connect.'),
  nativeMessaging: entry('Can communicate with software installed separately on your computer, outside the browser’s sandbox.', 'Password managers or desktop companion tools.', 'Check which desktop software it talks to and why.'),
  contentSettings: entry('Can read and change browser site content settings.', 'Site-setting managers or privacy utilities.', 'Review whether it explains or changes settings as expected.')
};

export function explainExtensionPermission(name) {
  return { name, ...(Object.prototype.hasOwnProperty.call(extensionPermissionCatalog, name) ? extensionPermissionCatalog[name] : entry(
    'Chrome reports this API permission. This prototype has no detailed local explanation for it.',
    'Uses depend on the extension and this permission.',
    'Compare the permission with browser details and the extension’s stated purpose.'
  )) };
}
