// Replace {{name}} / {{first_name}} / {{username}} / {{ticket_number}} in DM text at send time.
// Pure and unit-tested. Unknown tags are left as-is.
export interface PersonalizeCtx {
  username?: string | null;
  name?: string | null;
  ticketNumber?: number | string | null;
}

export function personalize(text: string, ctx: PersonalizeCtx): string {
  if (!text) return text;
  const username = (ctx.username ?? '').trim();
  const name = (ctx.name ?? '').trim();
  const firstName = name ? name.split(/\s+/)[0] : '';
  const fallback = 'there';
  const map: Record<string, string> = {
    name: name || username || fallback,
    first_name: firstName || username || fallback,
    firstname: firstName || username || fallback,
    username: username || fallback,
    ticket_number: ctx.ticketNumber != null ? String(ctx.ticketNumber) : '',
    ticket: ctx.ticketNumber != null ? String(ctx.ticketNumber) : '',
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => {
    const k = key.toLowerCase();
    if (k === 'ticket_number' || k === 'ticket') {
      return ctx.ticketNumber != null ? String(ctx.ticketNumber) : whole;
    }
    return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : whole;
  });
}
