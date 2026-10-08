# balikpinas_planner
# balikpinas_planner

## Settings

Open **Settings** from the Home menu.

- **Dark Mode** changes the appearance across the app immediately. On the first visit it uses the device's appearance; after choosing a setting, that choice is restored on reload.
- **Reminder** opts into browser notifications. It starts off and requests permission only when switched on. Blocked permissions must be changed in the browser's site settings. Switching off closes notifications opened by this app and leaves the browser's permission unchanged.
- **Send test notification** checks delivery when Reminder is on. Browser notifications need HTTPS (or localhost), browser support, and device permission. Some mobile browsers require a service worker and do not support this app's foreground notification delivery; failures are shown in Settings.

Preferences are stored on the current browser, shared by accounts using it. Scheduled trip alerts, background push, and native notification scheduling are not implemented by these settings.
