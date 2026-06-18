async function fetchPendingNotifications() {
  const subscription = await self.registration.pushManager.getSubscription();
  if (!subscription) return [];

  const response = await fetch("/api/pwa/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data.notifications) ? data.notifications : [];
}

async function showPendingNotifications() {
  const notifications = await fetchPendingNotifications();
  await Promise.all(
    notifications.map((item) =>
      self.registration.showNotification(item.titulo, {
        body: item.cuerpo,
        tag: item.id,
        data: {
          url: item.url,
        },
      }),
    ),
  );
}

self.addEventListener("push", (event) => {
  event.waitUntil(showPendingNotifications());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PWA_PUSH_SYNC") {
    event.waitUntil(showPendingNotifications());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          const currentPath = new URL(client.url).pathname;
          if (currentPath === targetUrl || client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
