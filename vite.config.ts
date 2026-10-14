import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaApp } from '@huishouden/pwa-kit/vite';
import registry from './apps.json';

// The apps under their own paths on this site (pwa-kit docs/one-site.md): the portal's worker
// leaves navigations there to the network, so a tile never opens the portal instead of the app.
const otherApps = registry.flatMap((app: { path?: string }) => (app.path && app.path !== '/' ? [app.path] : []));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaApp({
      base: '/',
      otherApps,
      // The portal's worker (scope /) owns the one push subscription of the device for every app (pwa-kit STANDARD.md "Notifications").
      push: true,
      name: 'Huishouden',
      description: 'Free apps for running a home together: groceries, tasks, calendar, pets, baby and health, sharing one calendar. Start your own household.',
      // Contacts → Share → Huishouden on Android: a contact card becomes a household contact.
      shareTarget: { contacts: true },
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
    }),
  ],
});
