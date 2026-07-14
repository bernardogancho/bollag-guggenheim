// Publish validation. Called with the config.yml field definitions and the
// draft value they describe. Returns [{ label, message }] — plain language,
// no dev words. Only dirty files are ever validated (callers enforce this).

const LINK_NAME = /(href|Href)$|^url$/;
const LINK_SHAPE = /^(https?:\/\/|mailto:|tel:|\/)/;

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

export function validateValue(fields, value, crumb) {
  const issues = [];
  for (const field of fields || []) {
    const fieldValue = value?.[field.name];
    const label = `${crumb} → ${field.label || field.name}`;
    const widget = field.widget || 'string';

    if (widget === 'object') {
      issues.push(...validateValue(field.fields || [], fieldValue || {}, label));
      continue;
    }

    if (widget === 'list') {
      const items = Array.isArray(fieldValue) ? fieldValue : [];
      items.forEach((item, index) => {
        if (field.fields) {
          issues.push(...validateValue(field.fields, item || {}, `${label} #${index + 1}`));
        } else if (field.field && field.field.required !== false && isEmpty(item)) {
          issues.push({ label: `${label} #${index + 1}`, message: 'This entry is empty.' });
        }
      });
      continue;
    }

    const required = field.required !== false;
    if (required && ['string', 'text', 'image', 'file', 'select'].includes(widget) && isEmpty(fieldValue)) {
      issues.push({ label, message: 'This field is empty and the website expects it.' });
      continue;
    }

    if (!isEmpty(fieldValue) && widget === 'string' && LINK_NAME.test(field.name) && !LINK_SHAPE.test(String(fieldValue))) {
      issues.push({ label, message: 'Links must start with https://, mailto:, tel: or / for a page on this site.' });
    }

    if (!isEmpty(fieldValue) && (widget === 'image' || widget === 'file') && !LINK_SHAPE.test(String(fieldValue))) {
      issues.push({ label, message: 'This should be an uploaded file path (starting with /) or a full https:// link.' });
    }
  }
  return issues;
}
