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
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (current[key] === null || current[key] === undefined || typeof current[key] !== 'object') {
      // A missing intermediate's type is chosen by the NEXT segment (the one that
      // will index into it): numeric next segment → array, otherwise object.
      const nextKey = i + 1 < keys.length ? keys[i + 1] : last;
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
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
