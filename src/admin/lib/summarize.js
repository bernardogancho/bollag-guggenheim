const TITLE_KEYS = ['name', 'brand', 'title', 'label', 'month', 'dateLabel'];
const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

function labelize(key) {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function summarize(value) {
  if (value === null || value === undefined || value === '') {
    return 'Empty';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  const parts = [];
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === null || entryValue === undefined || entryValue === '') {
      continue;
    }
    parts.push(`${labelize(key)}: ${Array.isArray(entryValue) ? `${entryValue.length} items` : typeof entryValue === 'object' ? '…' : String(entryValue)}`);
    if (parts.length === 2) {
      break;
    }
  }
  return parts.join(' · ') || 'Empty';
}

export function itemTitle(item) {
  if (!item || typeof item !== 'object') {
    return String(item ?? 'Untitled') || 'Untitled';
  }
  for (const key of TITLE_KEYS) {
    if (typeof item[key] === 'string' && item[key].trim()) {
      return item[key];
    }
  }
  for (const value of Object.values(item)) {
    if (typeof value === 'string' && value.trim() && !IMAGE_SHAPE.test(value)) {
      return value;
    }
  }
  return 'Untitled';
}

export function itemImage(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  for (const value of Object.values(item)) {
    if (typeof value === 'string' && IMAGE_SHAPE.test(value)) {
      return value;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = itemImage(value);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}
