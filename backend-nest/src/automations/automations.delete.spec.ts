import { AutomationsService } from './automations.service';

describe('AutomationsService.remove queue cleanup', () => {
  const automationId = 'automation-1';

  function setup(getJobs: jest.Mock) {
    const prisma: any = {
      automation: {
        findUnique: jest.fn().mockResolvedValue({ id: automationId, igAccount: { userId: 'user-1' } }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const queue: any = { getJobs };
    const quota: any = {
      settle: jest.fn().mockResolvedValue(undefined),
      settleUnstartedForAutomation: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new AutomationsService(prisma, queue, quota, {} as any, {} as any), prisma, queue, quota };
  }

  it('pauses first, removes only this automation pending jobs, drains active jobs, then deletes', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const target = { data: { automationId, triggerEventId: 'comment:ig:1' }, remove };
    const unrelated = { data: { automationId: 'another-automation' }, remove: jest.fn() };
    const getJobs = jest.fn()
      .mockResolvedValueOnce([target, unrelated])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { service, prisma, quota } = setup(getJobs);

    await expect(service.remove('user-1', automationId)).resolves.toEqual({ success: true });

    expect(prisma.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: { status: 'PAUSED' } });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(quota.settle).toHaveBeenCalledWith('comment:ig:1', false);
    expect(unrelated.remove).not.toHaveBeenCalled();
    expect(prisma.automation.delete).toHaveBeenCalledWith({ where: { id: automationId } });
    expect(quota.settleUnstartedForAutomation).toHaveBeenCalledWith(automationId);
  });

  it('keeps the automation paused and does not delete it if queue cleanup is unavailable', async () => {
    const { service, prisma } = setup(jest.fn().mockRejectedValue(new Error('Redis unavailable')));

    await expect(service.remove('user-1', automationId)).rejects.toThrow('queued messages could not be cleared');

    expect(prisma.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: { status: 'PAUSED' } });
    expect(prisma.automation.delete).not.toHaveBeenCalled();
  });

  it('releases the correct quota claim for a canceled follow-up job', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const target = { data: { automationId, triggerEventId: 'comment:ig:1', followUpId: 'step-1' }, remove };
    const getJobs = jest.fn().mockResolvedValueOnce([target]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { service, quota } = setup(getJobs);

    await service.remove('user-1', automationId);

    expect(quota.settle).toHaveBeenCalledWith('comment:ig:1:fu:step-1', false);
  });
});
