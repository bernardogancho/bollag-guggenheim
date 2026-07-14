export function deepClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function getAtPath(obj, path) {
  if (!path) {
    return obj;
  }
  let current = obj;
  for (const key of String(path).split('.')) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export function setAtPath(obj, path, value) {
  const keys = String(path).split('.');
  const last = keys.pop();
  let current = obj;
  for (const key of keys) {
    if (current[key] === null || current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = /^\d+$/.test(key) ? [] : {};
    }
    current = current[key];
  }
  current[last] = value;
}

export function reorder(list, fromIndex, toIndex) {
  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
