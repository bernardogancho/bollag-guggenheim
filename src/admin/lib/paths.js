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

// Writing past the end of an array (e.g. slot 1 of an empty list) would leave
// the skipped slots as holes, which JSON.stringify saves as null — and editors
// that read item.image then crash on that brand. Fill skipped slots with an
// empty value shaped like the slot being written instead.
function fillSkippedSlots(list, index, filler) {
  for (let i = list.length; i < index; i += 1) {
    list[i] = filler();
  }
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
      const makeSlot = () => (/^\d+$/.test(nextKey) ? [] : {});
      if (Array.isArray(current) && /^\d+$/.test(key)) {
        fillSkippedSlots(current, Number(key), makeSlot);
      }
      current[key] = makeSlot();
    }
    current = current[key];
  }
  if (Array.isArray(current) && /^\d+$/.test(last)) {
    fillSkippedSlots(current, Number(last), () => (value !== null && typeof value === 'object' ? {} : ''));
  }
  current[last] = value;
}

export function reorder(list, fromIndex, toIndex) {
  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
