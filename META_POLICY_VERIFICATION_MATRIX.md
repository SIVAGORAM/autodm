# HEYLAUNCH — META POLICY VERIFICATION MATRIX

## 1. Graph API & Messaging API Endpoint Inventory

| Endpoint | Method | Required Scope | Rate Limit Tier | HeyLaunch Safety Handling |
| :--- | :--- | :--- | :--- | :--- |
| `/{comment-id}/replies` | POST | `instagram_manage_comments` | 200/hr/account | Private reply within 7 days; only 1 private reply per comment allowed by Meta. |
| `/{ig-user-id}/messages` | POST | `instagram_manage_messages` | Standard 200/hr | Sent within 24-hour messaging window. If window expired, fails gracefully without crash. |
| `/{igsid}?fields=is_user_follow_business` | GET | `instagram_manage_messages` | Graph API Standard | Queried upon incoming message/postback. Fails closed (withholds link) if unverified. |
| `/{ig-user-id}/media` | GET | `instagram_basic` | Graph API Standard | Paginated media discovery with cached thumbnails; skips unsupported media types. |
| `/{comment-id}/replies` (Public) | POST | `instagram_manage_comments` | 60/hr recommended | Executed only AFTER private DM delivery succeeds; rotated across up to 10 templates. |

---

## 2. Instagram Stories: Technical Reality vs Platform Limits

1. **Story Comments:** Instagram Stories **do not support public comments** on the Meta platform. Any service claiming "Story comment automation" is violating technical realities. HeyLaunch explicitly communicates this distinction in the UI.
2. **Story Replies:** When a viewer replies to an active 24-hour Story, Meta dispatches a message webhook containing `message.reply_to.story.id`. HeyLaunch intercepts this event and delivers the automated conversational response.
3. **Story Mentions:** When a user tags the creator in a Story, Meta dispatches a messaging event with `attachments[0].type = 'story_mention'`. HeyLaunch handles this via the Story mention trigger pipeline.

---

## 3. Human Agent & Anti-Spam Compliance

- **No Repeated Comments:** Public comment replies are rotated in atomic sequential round-robin order using Redis `INCR` to prevent identical consecutive comments that trigger Meta spam flags.
- **Voluntary Gating:** Email collection provides clear user disclosure and a voluntary `SKIP` option.
- **Rate-Limiting:** Both per-account and global BullMQ throttlers enforce delivery delays (minimum 1.5–3 seconds between public comment actions) to simulate human pacing.
