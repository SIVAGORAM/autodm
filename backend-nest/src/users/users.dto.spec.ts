import { updateProfileSchema } from './users.dto';

describe('updateProfileSchema', () => {
  it('trims a valid account name', () => {
    expect(updateProfileSchema.parse({ name: '  Creator Name  ' })).toEqual({ name: 'Creator Name' });
  });

  it.each([
    null,
    { name: 123 },
    { name: 'x' },
    { name: 'x'.repeat(81) },
    { name: 'Creator', email: 'ignored@example.test' },
  ])('rejects invalid account profile input', (input) => {
    expect(() => updateProfileSchema.parse(input)).toThrow();
  });
});
