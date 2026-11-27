// Multi-Language automation templates and helpers
// Supports TENGLISH (Telugu in English letters), ENGLISH, and TELUGU_ENGLISH (Hybrid)

export type AutomationLanguage = 'ENGLISH' | 'TENGLISH' | 'TELUGU_ENGLISH';

export type DmButtonPrompt = {
  title: string;
  url?: string;
  type: 'web_url' | 'postback';
  payload?: string;
};

// ─── 1. Public Comment Reply Templates ─────────────────────────
export const PUBLIC_COMMENT_REPLIES: Record<AutomationLanguage, string[]> = {
  TENGLISH: [
    'Pampinchanu bro! Mee DM chudandi 📩',
    'Mee link DM lo send chesanu, check cheyandi! ✨',
    'Check chesukondi! Inbox lo link pettanu 🚀',
    'DM vachesindi chudandi! Let me know if you got it 🔥',
    'Mee inbox lo link ready ga undi, open chesi chudandi 📬',
    'Sent andi! Mee DMs open chesi link chudandi 💫',
    'Done bro! Mee direct messages lo link share chesanu 🎯',
    'Already pampesa! Ventane mee DM check cheyandi 🎁',
    'Mee request chusi ventane DM chesa, chudandi 🤝',
    'Link sent! Mee inbox lo undi, miss avvakandi ⚡',
    'DM check cheyandi friend, meekosam link pampanu 💌',
    'Mee special link mee DM ki vachesindi, enjoy! 🥳',
  ],
  ENGLISH: [
    'Sent it your way! Check your DMs 📩',
    'Just dropped the link in your inbox! ✨',
    'Done! Head over to your DMs 🚀',
    'Sent! Let me know once you check it 🔥',
    "Check your messages, it's waiting for you! 📬",
    'Just sent it over! Hope you love it 💫',
    'In your DMs right now! Go take a look 🎯',
    "Delivered! Check your message requests if you don't see it ⚡",
    'All yours! Link is in your direct messages 🎁',
    'Sent to your DMs, my friend! 🤝',
    'Check your inbox, just sent the link! 💌',
    'Boom! 💥 The link is in your DMs now.',
  ],
  TELUGU_ENGLISH: [
    'Link sent chesanu! Check your DMs 📩',
    'Direct message vachindi, open and check it! ✨',
    'Link mee inbox lo undi, take a look 🚀',
    'Just sent it bro! Let me know if you received it 🔥',
    'All set! Mee DM open chesi chudandi 📬',
    'Link dropped in your inbox! Enjoy the resource 💫',
    'Done andi! Check your message requests 🎯',
    'Already sent! Inbox lo check chesukondi ⚡',
    'Special link mee kosam sent, check now 🎁',
    'Sent to your inbox friend! Hope this helps you 🤝',
  ],
};

// ─── 2. Follow-Gate Initial Prompts ────────────────────────────
export const FOLLOW_GATE_PROMPTS: Record<AutomationLanguage, (username: string, name?: string | null) => string[]> = {
  TENGLISH: (username, name) => [
    `Okkasaari aagandi! 👀 Meeru inka nannu follow avvaledu. Kindha 'Profile Chudandi' click chesi follow ayyi, 'Follow Ayanu' tap cheyandi! ✨`,
    `Arey wait bro! 🥺 Meeru inka follow avvaledu. First follow chesi, kindha 'Follow Ayanu' click cheste link unlock avthundi! 👇`,
    `Chinna request friend! 🤗 Ee link access cheyadaniki nannu follow cheyandi, then 'Follow Ayanu' click cheyandi! 🚀`,
    `Hey ${name || 'friend'}! 👀 Meeru inka mana community lo join avvaledu. Just @${username} ni follow chesi, kindha button tap cheyandi! 💫`,
    `Almost there! 🔍 Nannu follow cheyatam marchipoyara? @${username} ni follow chesi kindha 'Follow Ayanu' nokkandi, link vachesthundi! 🎁`,
    `Okkare second! ✨ Exclusive resources mana followers kosame! Follow chesi, 'Follow Ayanu' click cheyandi! 🔥`,
    `Hey bro! 🤝 Mana account @${username} ni inka follow avvaledu meeru. Quick ga follow chesi 'Follow Ayanu' tap cheyandi! ⚡`,
    `Wait a sec! 🙈 Link ready ga undi, but first nannu follow cheyandi. Follow ayyaka kindha button click cheyandi! 👇`,
    `Hey ${name || 'there'}! ❤️ Mana updates miss avvakunda undataniki follow cheyandi, then 'Follow Ayanu' tap chesi link teesukondi!`,
    `Chinna step migilindi! 🎯 Profile follow chesi 'Follow Ayanu' button click cheyandi, ventane link open avthundi!`,
  ],
  ENGLISH: (username, name) => [
    `Wait a second! 👀 Looks like you're not following @${username} yet. Tap 'Visit Profile' below to follow, then tap 'I'm following' to get your link! ✨`,
    `Hold on ${name || 'friend'}! 🥺 You haven't followed @${username} yet. Hit 'Visit Profile' below, then press 'I'm following' to unlock your link! 🚀`,
    `Almost there! 🔍 Quick favor—give @${username} a follow first, then tap 'I'm following' below to grab your resource! 👇`,
    `Hey ${name || 'there'}! ✨ Exclusive drops are for our community! Tap 'Visit Profile' to follow @${username}, then tap 'I'm following'! 🔥`,
    `Oops! 🙈 You forgot to follow! Follow @${username} and hit 'I'm following' right here to unlock your link! 💫`,
    `One quick step! 🤝 Hit 'Visit Profile' to follow @${username}, then press 'I'm following' and I'll send it right over! ⚡`,
    `Wait bro! 👀 Join the fam first! Follow @${username}, then tap 'I'm following' to access your link! 🎁`,
    `Hey ${name || 'there'}! ❤️ Don't miss out on future drops—follow @${username}, then click 'I'm following' below!`,
    `Hold tight! 🎯 Give @${username} a quick follow, tap 'I'm following', and the link is yours!`,
    `Just one tap away! 🚀 Follow @${username} below, then tap 'I'm following' to instantly unlock it!`,
  ],
  TELUGU_ENGLISH: (username, name) => [
    `Wait a second! 👀 Meeru inka @${username} ni follow avvaledu. Tap 'Visit Profile' to follow, then tap 'Follow Ayanu'! ✨`,
    `Hold on ${name || 'friend'}! 🥺 First @${username} ni follow chesi, kindha 'Follow Ayanu' click chesi link unlock cheyandi! 🚀`,
    `Almost there! 🔍 Quick follow to @${username}, then tap 'Follow Ayanu' to grab your link! 👇`,
    `Hey ${name || 'bro'}! ✨ Exclusive link mana community members kosame! Follow @${username} and tap 'Follow Ayanu'! 🔥`,
    `Just one quick step! 🤝 Hit 'Visit Profile' below to follow @${username}, then press 'Follow Ayanu'! ⚡`,
  ],
};

// ─── 3. Follow-Gate Button Labels ──────────────────────────────
export function getFollowButtons(language: AutomationLanguage, username: string): DmButtonPrompt[] {
  if (language === 'TENGLISH' || language === 'TELUGU_ENGLISH') {
    return [
      { title: 'Profile Chudandi', url: `https://instagram.com/${username}`, type: 'web_url' },
      { title: 'Follow Ayanu', type: 'postback', payload: 'CONFIRM_FOLLOW' },
    ];
  }
  return [
    { title: 'Visit Profile', url: `https://instagram.com/${username}`, type: 'web_url' },
    { title: "I'm following", type: 'postback', payload: 'CONFIRM_FOLLOW' },
  ];
}

// ─── 4. Follow-Gate Retry Prompts (When user clicked follow button but hasn't actually followed) ──
export const FOLLOW_RETRY_PROMPTS: Record<AutomationLanguage, (username: string) => string[]> = {
  TENGLISH: (username) => [
    `Hmm, meeru inka follow avvaledu anukunta! 🔍👀 Kindha unna 'Profile Chudandi' tap chesi follow ayyi, malli 'Follow Ayanu' click cheyandi! ✨`,
    `Inka follow kanipinchaledu bro! 👀 No worries, kindha 'Profile Chudandi' nokki @${username} ni follow avvandi, then 'Follow Ayanu' tap cheyandi! 🚀`,
    `Check chesa bro, inka follow avvaledu! 🥺 Please profile visit chesi follow ayyaka 'Follow Ayanu' nokkandi! 👇`,
    `Almost! 👀 First @${username} profile meeda follow nokkandi. Ayyaka kindha 'Follow Ayanu' tap cheyandi! 💫`,
  ],
  ENGLISH: (username) => [
    `Hmm, it looks like you haven't followed yet! 🔍👀 Please tap 'Visit Profile' below, hit Follow on @${username}, and then tap 'I'm following'! ✨`,
    `Still not seeing that follow! 👀 Don't worry, tap 'Visit Profile' below to follow @${username}, then tap 'I'm following' right here! 🚀`,
    `We checked, but you're not following @${username} yet! 🥺👀 Please tap 'Visit Profile' and follow us, then press 'I'm following'! 👇`,
    `Almost! 👀 You need to hit Follow on @${username}'s profile first. Tap 'Visit Profile' below, then tap 'I'm following'! 💫`,
  ],
  TELUGU_ENGLISH: (username) => [
    `Hmm, checked but follow inka raledu! 🔍 Please tap 'Visit Profile', follow @${username}, and tap 'Follow Ayanu'! ✨`,
    `Still not seeing your follow bro! 👀 No worries, tap 'Visit Profile' to follow @${username}, then press 'Follow Ayanu'! 🚀`,
  ],
};

// ─── 5. Email Collection Prompts ───────────────────────────────
export const EMAIL_COLLECTION_PROMPTS: Record<AutomationLanguage, (name?: string | null, username?: string | null) => string[]> = {
  TENGLISH: (name) => [
    `Hey ${name || 'there'}! 🎉 Link pampadam kosam, mee best email address enti? Kindha reply ivvandi! 📩`,
    `Hi friend! ✨ Ee link mee email ki kuda save cheyadaniki, mee email address ikkada type cheyandi! 🚀`,
    `Super! 🎁 Meeru link miss avvakunda undataniki, mee email id share cheyandi bro! 👇`,
    `Hey ${name || 'bro'}! 📩 Exclusive updates & link kosam mee email address kindha reply ga pettandi!`,
    `One quick thing ${name || 'friend'}! ⚡ Link direct ga pampadaniki mee email id enti? Just type cheyandi!`,
    `Hi ${name || 'there'}! 🤝 Mana special newsletter & link access kosam, mee email address ikkada cheppandi!`,
    `Great choice ${name || 'friend'}! 🔥 Ee guide mee inbox ki ravalante mee email id reply ivvandi!`,
    `Hey bro! 📬 Mee personal email address share cheyandi, link ventane drop chestha!`,
    `Awesome! 🌟 Future drops kuda miss avvakudadante, mee email id ikkada enter cheyandi!`,
    `Hey ${name || 'there'}! 💌 Link drop chese mundhu, mee email address kindha reply cheyandi, lets connect!`,
  ],
  ENGLISH: (name) => [
    `Hey ${name || 'there'}! 🎉 Before I drop your link right here, what's your best email address? Reply below! 📩`,
    `Awesome! ✨ Where should I send your link and backup copy? Drop your email right here! 🚀`,
    `So excited for you! 🎁 What's your email so I can send the direct link over? 👇`,
    `Quick question ${name || 'friend'}! ⚡ What's your email address? Reply right here and I'll send it! 📬`,
    `Great to connect ${name || 'there'}! 🤝 Drop your email below so you never lose access to this link!`,
    `One second friend! 🔥 What's the best email to reach you at? Send it below! 💌`,
    `Hey ${name || 'there'}! 🌟 Drop your email address below, and I'll unlock your link right away!`,
    `Almost there! 🎯 Reply with your email id and I'll deliver the link instantly! ⚡`,
    `Love this! 💫 What email address do you check most often? Reply right below! 📩`,
    `Hey ${name || 'there'}! 📬 Send over your email and I'll drop the VIP link right into your inbox!`,
  ],
  TELUGU_ENGLISH: (name) => [
    `Hey ${name || 'friend'}! 🎉 Link pampadaniki, what is your best email address? Kindha reply ivvandi! 📩`,
    `Awesome! ✨ Where should I send your link? Mee email address drop cheyandi! 🚀`,
    `Quick question ${name || 'bro'}! ⚡ Mee email address kindha share cheyandi, link send chestha! 📬`,
    `Hey ${name || 'there'}! 🤝 Drop your email below so you never lose this link!`,
  ],
};

// ─── 6. Email Collection Retry Prompts (Invalid Email Entered) ──
export const EMAIL_RETRY_PROMPTS: Record<AutomationLanguage, string[]> = {
  TENGLISH: [
    `Arey, adi valid email address la lede! ✉️ Mee correct email (e.g. name@gmail.com) kindha reply ivvandi, link ventane vachesthundi! ✨`,
    `Chinna mistake bro! 👀 Please mee real email address share cheyandi, link ventane drop chestha! 🚀`,
    `Email format sarigga ledu friend! 📩 name@example.com laanti valid email reply ivvandi! ⚡`,
  ],
  ENGLISH: [
    `Oops, that doesn't look like a valid email address! ✉️ Please reply with your email (e.g. name@example.com) to get your link right here! ✨`,
    `Almost! 🔍 Make sure it includes an @ and domain like name@gmail.com. Reply below to get your link! 🚀`,
    `Check that email format friend! 📩 Reply with your valid email and I'll deliver your link right away! ⚡`,
  ],
  TELUGU_ENGLISH: [
    `Oops, that doesn't look like a valid email bro! ✉️ Please reply with your valid email (e.g. name@gmail.com) to get your link! ✨`,
    `Format mistake anukunta friend! 📩 Please send your real email address right here! 🚀`,
  ],
};

// ─── 7. Follow-Verified Success + Email Transition Prompt ──────
export function getFollowVerifiedEmailPrompt(language: AutomationLanguage, username: string): string {
  if (language === 'TENGLISH' || language === 'TELUGU_ENGLISH') {
    return `Super bro! @${username} ni follow chesinanduku thanks! 🎉 Link pampadaniki, mee email address enti? Kindha reply ivvandi! 📩`;
  }
  return `Awesome, thanks for following @${username}! 🎉 Before I drop your link right here, what's your email address? Reply with your email below! 📩`;
}

// ─── 8. Helper Functions ───────────────────────────────────────
export function normalizeLanguage(lang?: string | null): AutomationLanguage {
  if (lang === 'TENGLISH' || lang === 'TELUGU_ENGLISH') return lang;
  return 'ENGLISH';
}

export function getRandomFollowPrompt(language: AutomationLanguage, username: string, name?: string | null): string {
  const prompts = FOLLOW_GATE_PROMPTS[language](username, name);
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export function getRandomFollowRetryPrompt(language: AutomationLanguage, username: string): string {
  const prompts = FOLLOW_RETRY_PROMPTS[language](username);
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export function getRandomEmailPrompt(language: AutomationLanguage, name?: string | null): string {
  const prompts = EMAIL_COLLECTION_PROMPTS[language](name);
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export function getRandomEmailRetryPrompt(language: AutomationLanguage): string {
  const prompts = EMAIL_RETRY_PROMPTS[language];
  return prompts[Math.floor(Math.random() * prompts.length)];
}
