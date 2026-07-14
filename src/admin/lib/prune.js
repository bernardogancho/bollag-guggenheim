// Drops keys an editor "touched into existence" but left empty, so a draft
// that is semantically identical to the published content compares clean
// under the store's JSON.stringify dirty check. Rules:
// - a scalar '' whose counterpart is absent in remote → dropped (object keys only)
// - array SLOTS are never dropped (indices must not shift); pruning recurses
//   into array items' object keys instead
// - everything else is kept verbatim; key order of kept keys is preserved
const SKIP = Symbol('skip');

function pruneValue(next, remote) {
  if (next === '' && remote === undefined) {
    return SKIP;
  }
  if (Array.isArray(next)) {
    return next.map((item, index) => {
      const pruned = pruneValue(item, Array.isArray(remote) ? remote[index] : undefined);
      return pruned === SKIP ? item : pruned;
    });
  }
  if (next && typeof next === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(next)) {
      const pruned = pruneValue(value, remote && typeof remote === 'object' && !Array.isArray(remote) ? remote[key] : undefined);
      if (pruned !== SKIP) {
        result[key] = pruned;
      }
    }
    return result;
  }
  return next;
}

export function pruneEmptyAdditions(next, remote) {
  const pruned = pruneValue(next, remote);
  return pruned === SKIP ? undefined : pruned;
}
