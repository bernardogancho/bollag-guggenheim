// Walks config.yml field definitions along a dot path with numeric indexes
// (e.g. 'groups.0.stores') and returns the list field definition at the end,
// or null if the path does not land on a list-of-objects field.
export function resolveListField(fields, listPath) {
  let currentFields = fields;
  let currentField = null;
  for (const segment of String(listPath).split('.')) {
    if (/^\d+$/.test(segment)) {
      if (!currentField || currentField.widget !== 'list' || !currentField.fields) {
        return null;
      }
      currentFields = currentField.fields;
      currentField = null;
      continue;
    }
    currentField = (currentFields || []).find(field => field.name === segment) || null;
    if (!currentField) {
      return null;
    }
    currentFields = currentField.fields || null;
  }
  return currentField && currentField.widget === 'list' && currentField.fields ? currentField : null;
}

export function defaultValueForFields(fields) {
  const value = {};
  for (const field of fields || []) {
    value[field.name] = defaultValueForField(field);
  }
  return value;
}

export function defaultValueForField(field) {
  const widget = field.widget || 'string';
  if (widget === 'object') {
    return defaultValueForFields(field.fields);
  }
  if (widget === 'list') {
    return [];
  }
  if (widget === 'select') {
    const first = Array.isArray(field.options) && field.options.length ? field.options[0] : '';
    return typeof first === 'object' && first !== null ? first.value ?? '' : first;
  }
  if (widget === 'boolean') {
    return false;
  }
  if (widget === 'number') {
    return 0;
  }
  return '';
}
