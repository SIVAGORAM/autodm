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
  it('leaves inherited object property names untouched', () => {
    expect(personalize('{{constructor}} {{__proto__}} {{toString}}', { name: 'Asha' }))
      .toBe('{{constructor}} {{__proto__}} {{toString}}');
  });
  it('fills ticket_number and ticket when provided', () => {
    expect(personalize('Your lucky ticket is #{{ticket_number}}!', { username: 'siva', ticketNumber: 4182 }))
      .toBe('Your lucky ticket is #4182!');
    expect(personalize('Ticket {{ticket}}', { ticketNumber: '5501' }))
      .toBe('Ticket 5501');
    expect(personalize('Ticket {{ticket_number}}', {}))
      .toBe('Ticket {{ticket_number}}');
  });
});
