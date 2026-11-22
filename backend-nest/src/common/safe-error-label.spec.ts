import { safeErrorLabel } from './safe-error-label';

describe('safeErrorLabel', () => {
  it('keeps only a bounded error class name', () => {
    expect(safeErrorLabel(new Error('database URL with credentials'))).toBe('Error');
    expect(safeErrorLabel(Object.assign(new Error('sensitive'), { name: 'PrismaClientKnownRequestError' })))
      .toBe('PrismaClientKnownRequestError');
    expect(safeErrorLabel(Object.assign(new Error('sensitive'), { name: 'bad name with details' }))).toBe('Error');
    expect(safeErrorLabel('sensitive provider response')).toBe('UnknownError');
  });
});
