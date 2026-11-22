import { createHmac, timingSafeEqual } from 'node:crypto';

const ATTRIBUTION_CONTEXT = 'heylaunch:click-attribution:v1';

function attributionKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(ATTRIBUTION_CONTEXT).digest();
}

export function signClickAttribution(slug: string, contactIgsid: string, secret: string): string {
  return createHmac('sha256', attributionKey(secret))
    .update(`${slug}\n${contactIgsid}`)
    .digest('hex');
}

export function verifyClickAttribution(
  slug: string,
  contactIgsid: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signClickAttribution(slug, contactIgsid, secret), 'hex');
  const supplied = Buffer.from(signature, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
