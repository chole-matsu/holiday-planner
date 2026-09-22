self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=clients.find(c=>c.url.startsWith(self.registration.scope));if(client)return client.focus();return self.clients.openWindow(self.registration.scope);})());});
