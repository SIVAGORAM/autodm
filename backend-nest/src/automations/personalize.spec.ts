import { personalize } from './personalize';

describe('personalize', () => {
  it('fills name and username', () => {
    expect(personalize('Hi {{name}}!', { name: 'Asha Rao', username: 'asha' })).toBe('Hi Asha Rao!');
    expect(personalize('@{{username}}', { username: 'asha' })).toBe('@asha');
  });
  it('first_name takes the first word', () => {
    expect(personalize('Hey {{first_name}}', { name: 'Asha Rao' })).toBe('Hey Asha');
  });
  it('falls back name -> username -> there', () => {
    expect(personalize('Hi {{name}}', { username: 'asha' })).toBe('Hi asha');
    expect(personalize('Hi {{name}}', {})).toBe('Hi there');
  });
  it('is case and space tolerant', () => {
    expect(personalize('Hi {{ Name }}', { name: 'Asha' })).toBe('Hi Asha');
  });
  it('leaves unknown tags untouched', () => {
    expect(personalize('Order {{order_id}}', { name: 'Asha' })).toBe('Order {{order_id}}');
  });
});
