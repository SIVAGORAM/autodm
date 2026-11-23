import { assertRedisNoeviction, hasNoevictionPolicy } from './redis';

describe('Redis BullMQ durability policy', () => {
  it('recognizes only an explicit noeviction memory policy', async () => {
    const info = jest.fn().mockResolvedValue('# Memory\r\nmaxmemory_policy:noeviction\r\n');
    await expect(hasNoevictionPolicy({ info })).resolves.toBe(true);
    await expect(assertRedisNoeviction({ info })).resolves.toBeUndefined();
    expect(info).toHaveBeenCalledWith('memory');
  });

  it('rejects eviction or missing policy values', async () => {
    for (const value of ['# Memory\r\nmaxmemory_policy:volatile-lru\r\n', '# Memory\r\n']) {
      const info = jest.fn().mockResolvedValue(value);
      await expect(hasNoevictionPolicy({ info })).resolves.toBe(false);
      await expect(assertRedisNoeviction({ info })).rejects.toThrow('maxmemory_policy must be noeviction');
    }
  });
});
