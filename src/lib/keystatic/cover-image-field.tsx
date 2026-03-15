import type { BasicFormField } from '@keystatic/core';
import CoverImagePicker from '../../components/keystatic/CoverImagePicker';

export function coverImageField(label = 'Cover Image'): BasicFormField<string | null> {
  return {
    kind: 'form',
    Input({ value, onChange }) {
      return <CoverImagePicker value={value} onChange={onChange} />;
    },
    defaultValue() {
      return null;
    },
    parse(value) {
      return typeof value === 'string' ? value : null;
    },
    serialize(value) {
      return { value: value ?? undefined };
    },
    validate(value) {
      return value;
    },
    reader: {
      parse(value) {
        return typeof value === 'string' ? value : null;
      },
    },
    label,
  };
}
