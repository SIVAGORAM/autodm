import { createAutomationSchema, updateAutomationSchema } from './automations.dto';

const base = {
  igAccountId: 'a6f45d92-96d0-4a6f-b5a6-e4449d029aaa',
  name: 'Welcome',
  triggerType: 'POST_COMMENT',
  dmBlocks: [{ type: 'buttons', buttons: [{ title: 'Visit', url: 'https://creator.example/path' }] }],
};

describe('automation URL validation', () => {
  it.each(['https://creator.example', 'http://creator.example'])('accepts web URLs: %s', (url) => {
    const result = createAutomationSchema.safeParse({
      ...base,
      dmBlocks: [{ type: 'buttons', buttons: [{ title: 'Visit', url }] }],
    });
    expect(result.success).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@creator.example'])('rejects unsafe URLs: %s', (url) => {
    const result = createAutomationSchema.safeParse({
      ...base,
      dmBlocks: [{ type: 'buttons', buttons: [{ title: 'Visit', url }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe('automation media ID validation', () => {
  it('rejects blank and oversized media IDs before calling Meta', () => {
    expect(createAutomationSchema.safeParse({ ...base, mediaId: '   ' }).success).toBe(false);
    expect(createAutomationSchema.safeParse({ ...base, mediaId: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('automation trigger support', () => {
  it('rejects the unsupported NEXT_POST trigger on create', () => {
    expect(createAutomationSchema.safeParse({ ...base, triggerType: 'NEXT_POST' }).success).toBe(false);
  });

  it('accepts a Live Comment trigger on create and update', () => {
    expect(createAutomationSchema.safeParse({ ...base, triggerType: 'LIVE_COMMENT' }).success).toBe(true);
    expect(updateAutomationSchema.safeParse({ triggerType: 'LIVE_COMMENT' }).success).toBe(true);
  });

  it('rejects the unsupported NEXT_POST trigger on update', () => {
    const triggerType = 'NEXT_POST';
    expect(updateAutomationSchema.safeParse({ triggerType }).success).toBe(false);
  });
});

describe('automation match-mode support', () => {
  it('rejects AI intent mode on create and update until an intent service exists', () => {
    expect(createAutomationSchema.safeParse({ ...base, matchMode: 'AI_INTENT' }).success).toBe(false);
    expect(updateAutomationSchema.safeParse({ matchMode: 'AI_INTENT' }).success).toBe(false);
  });
});

describe('automation update follow-up IDs', () => {
  const step = {
    order: 0,
    condition: 'DELAY',
    delayMinutes: 60,
    dmBlocks: [{ type: 'text', text: 'A follow-up message' }],
  };

  it('accepts an existing UUID so an edit can retain the scheduled step identity', () => {
    const result = updateAutomationSchema.safeParse({
      followUps: [{ ...step, id: '6ad10504-e083-4a78-a903-d8f57ad59792' }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed follow-up IDs', () => {
    const result = updateAutomationSchema.safeParse({ followUps: [{ ...step, id: 'another-automation-step' }] });

    expect(result.success).toBe(false);
  });

  it.each(['BOUGHT', 'NOT_BOUGHT', 'FORM_NOT_SUBMITTED'])('rejects unsupported %s conditions on new automations', (condition) => {
    const result = createAutomationSchema.safeParse({
      ...base,
      dmBlocks: [{ type: 'text', text: 'Thanks for commenting.' }],
      followUps: [{ order: 0, condition, delayMinutes: 60, dmBlocks: [{ type: 'text', text: 'Checking in.' }] }],
    });

    expect(result.success).toBe(false);
  });

  it('accepts a legacy unsupported condition only in an update payload for safe preservation', () => {
    const result = updateAutomationSchema.safeParse({
      followUps: [{ id: '6ad10504-e083-4a78-a903-d8f57ad59792', order: 0, condition: 'BOUGHT', delayMinutes: 60, dmBlocks: [{ type: 'text', text: 'Checking in.' }] }],
    });

    expect(result.success).toBe(true);
  });
});
