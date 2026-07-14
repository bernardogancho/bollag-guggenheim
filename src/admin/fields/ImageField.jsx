import React from 'react';
import { FieldShell, TextField } from './basics.jsx';
export function ImageField({ field, value, onChange }) {
  return <TextField field={field} value={value} onChange={onChange} />;
}
