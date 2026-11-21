import { useEffect } from 'react';
import { Platform } from 'react-native';

import { documentTitle, type PageMeta } from '@/lib/pageMetaText';

export { posterPageMeta, documentTitle, type PageMeta } from '@/lib/pageMetaText';

/**
 * Sets the browser title, description and canonical for the current screen (#62).
 *
 * The prerendered pages already carry these for a first visit; this keeps them right while the user
 * navigates inside the app, and for screens that are not prerendered. Web only; a no-op elsewhere.
 */
const ORIGIN = 'https://vispar.ehsanfazli.ir';

function setMeta(selector: string, attr: 'content' | 'href', value: string | null, create: () => HTMLElement) {
  let el = document.head.querySelector(selector);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}


export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = documentTitle(title);
    if (description) {
      setMeta('meta[name="description"]', 'content', description, () => Object.assign(document.createElement('meta'), { name: 'description' }));
      setMeta('meta[property="og:description"]', 'content', description, () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:description');
        return m;
      });
    }
    const href = path === null ? null : `${ORIGIN}${path}`;
    setMeta('link[rel="canonical"]', 'href', href, () => Object.assign(document.createElement('link'), { rel: 'canonical' }));
    setMeta('meta[property="og:url"]', 'content', href, () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:url');
      return m;
    });
    setMeta('meta[property="og:title"]', 'content', documentTitle(title), () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:title');
      return m;
    });
  }, [title, description, path]);
}
