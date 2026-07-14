import { parse as parseYAML } from 'yaml';

// Loads the field definitions (config.yml) and content files the admin edits.

export async function loadFieldConfig() {
  const response = await fetch('/admin/config.yml');
  if (!response.ok) {
    throw new Error(`Could not load the editor configuration (${response.status}).`);
  }
  const config = parseYAML(await response.text());
  const byFile = new Map();
  for (const collection of config.collections || []) {
    for (const entry of collection.files || []) {
      byFile.set(entry.file, entry);
    }
  }
  return byFile; // file path -> { name, label, file, fields }
}

export async function loadContentFile(filePath) {
  const relative = filePath.replace(/^src\/_data\/cms\//, '');
  const response = await fetch(`/cms-data/${relative}`);
  if (!response.ok) {
    throw new Error(`Could not load ${relative} (${response.status}).`);
  }
  return response.json();
}

export async function loadMediaIndex() {
  try {
    const response = await fetch('/admin/media-index.json');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null; // media library degrades; picker still allows upload + manual path
  }
}
