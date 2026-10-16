import { Platform } from 'react-native';

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export type LocalNotice = { title: string; body: string; /** In-app path opened when tapped. */ url?: string };

const isWeb = Platform.OS === 'web';

type NativeNotifications = typeof import('expo-notifications');
let native: NativeNotifications | null = null;
function loadNative(): NativeNotifications | null {
  if (isWeb || Platform.isTV) return null;
  if (!native) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('expo-notifications') as NativeNotifications;
    native.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      void native.setNotificationChannelAsync('news', {
        name: 'تازه‌های ویسپار',
        importance: native.AndroidImportance.DEFAULT,
        lightColor: '#F2B544',
      });
    }
  }
  return native;
}

export function notificationsSupported(): boolean {
  if (Platform.isTV) return false;
  if (isWeb) return typeof window !== 'undefined' && 'Notification' in window;
  return true;
}

export async function getPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return 'unsupported';
  if (isWeb) return Notification.permission as NotifyPermission;
  const n = loadNative();
  if (!n) return 'unsupported';
  const p = await n.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'default' : 'denied';
}

export async function requestPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return 'unsupported';
  if (isWeb) return (await Notification.requestPermission()) as NotifyPermission;
  const n = loadNative();
  if (!n) return 'unsupported';
  const p = await n.requestPermissionsAsync();
  return p.granted ? 'granted' : 'denied';
}

/** Shows a notification right now (no server involved). Returns false if it could not be shown. */
export async function notifyLocal(msg: LocalNotice): Promise<boolean> {
  if ((await getPermission()) !== 'granted') return false;
  try {
    if (isWeb) {
      const opts: NotificationOptions = { body: msg.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', dir: 'rtl', lang: 'fa', data: { url: msg.url ?? '/' } };
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      if (reg) await reg.showNotification(msg.title, opts);
      else new Notification(msg.title, opts);
      return true;
    }
    const n = loadNative();
    if (!n) return false;
    await n.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body, data: { url: msg.url ?? '/' } },
      trigger: Platform.OS === 'android' ? { channelId: 'news' } : null,
    });
    return true;
  } catch {
    return false;
  }
}

/** Routes taps on native notifications to the screen carried in `data.url`. */
export function onNotificationTap(open: (url: string) => void): () => void {
  const n = loadNative();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => {
    const url = (r.notification.request.content.data as { url?: string } | undefined)?.url;
    if (url) open(url);
  });
  return () => sub.remove();
}
