import { useEffect, useState } from 'react';

// Hash routes (all parts URI-encoded):
//   #/page/<pageId>
//   #/page/<pageId>/<sectionId>
//   #/page/<pageId>/<sectionId>/list/<listPath>            (managed item list)
//   #/page/<pageId>/<sectionId>/list/<listPath>/<index>    (item editor)
//   #/page/wearhouse/wearhouse-brands/<slug>                (joined item editor)
//   #/media   #/people
export function parseRoute() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(...parts) {
  window.location.hash = '/' + parts.map(encodeURIComponent).join('/');
}

export function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
