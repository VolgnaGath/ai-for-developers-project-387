import { describe, expect, it } from 'vitest';
import { validateEventTypeForm } from './eventTypeValidation';

const valid = { title: 'Консультация', description: '', durationMinutes: 30 as const };
const invalidDuration = 45 as unknown as (typeof valid)['durationMinutes'];

describe('validateEventTypeForm', () => {
  it('requires a non-empty trimmed title', () => {
    expect(validateEventTypeForm({ ...valid, title: '' })).toEqual({
      title: 'Укажите название',
    });
    expect(validateEventTypeForm({ ...valid, title: '   ' })).toEqual({
      title: 'Укажите название',
    });
  });

  it('accepts a title with surrounding whitespace', () => {
    expect(validateEventTypeForm({ ...valid, title: '  Демо  ' })).toEqual({});
  });

  it('accepts only 15 or 30 minute durations', () => {
    expect(validateEventTypeForm({ ...valid, durationMinutes: 15 })).toEqual({});
    expect(validateEventTypeForm({ ...valid, durationMinutes: 30 })).toEqual({});
    expect(validateEventTypeForm({ ...valid, durationMinutes: invalidDuration })).toEqual({
      durationMinutes: 'Выберите длительность встречи',
    });
  });

  it('validates the full form', () => {
    expect(
      validateEventTypeForm({ title: '', description: 'x', durationMinutes: invalidDuration }),
    ).toEqual({
      title: 'Укажите название',
      durationMinutes: 'Выберите длительность встречи',
    });
  });
});
