// frontend/lib/automation-templates.ts
// Multi-Language automation templates and helpers
// Supports TENGLISH (Telugu in English letters), ENGLISH, TELUGU_ENGLISH (Hybrid), and HINGLISH (Hindi in English letters)

export type AutomationLanguage = 'ENGLISH' | 'TENGLISH' | 'TELUGU_ENGLISH' | 'HINGLISH';

export interface LanguageOption {
  value: AutomationLanguage;
  label: string;
  badge: string;
  description: string;
  previewExample: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: 'HINGLISH',
    label: 'Hinglish (Hindi in English letters)',
    badge: '150M+ Pan-India Audience 🇮🇳',
    description: 'Casual, high-conversion Hindi written in English letters. The #1 spoken & texted format for creators across India.',
    previewExample: 'Bhai DM check karo! Link bhej diya hai 📩',
  },
  {
    value: 'TENGLISH',
    label: 'Telugu (English Letters)',
    badge: 'Popular for AP & Telangana',
    description: 'Telugu written in English letters. Ultra-casual, friendly, and connects deeply with Telugu audiences.',
    previewExample: 'Pampinchanu bro! Mee DM chudandi 📩',
  },
  {
    value: 'ENGLISH',
    label: 'English (Casual & Warm)',
    badge: 'Global Audience',
    description: 'Warm, natural, conversational English that builds real friendships instead of robotic corporate replies.',
    previewExample: 'Sent it your way! Check your DMs 📩',
  },
  {
    value: 'TELUGU_ENGLISH',
    label: 'Telugu & English (Hybrid Mix)',
    badge: 'Youth & Tech Creators',
    description: 'Natural bilingual flow mixing Telugu phrases with English keywords for modern youth audiences.',
    previewExample: 'Link sent chesanu! Check your DMs 📩',
  },
];

// ─── 1. Public Comment Reply Templates (12+ per language) ───────
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
    'Check your DM bro, just dropped the link! 🚀',
    'Mee message inbox ki link deliver ayyindi! 💌',
  ],
  HINGLISH: [
    'Bhai DM check karo! Link bhej diya hai 📩',
    'Sent bro! Check your DM inbox right now ⚡',
    'Inbox me link de diya bhai, check karlo! 🙌',
    'Check your inbox dost! Link share kar diya hai ✨',
    'DM bheja hai bhai! Ek baar check karlo 🚀',
    'Check karo inbox bhai! Link mil gaya hoga 📬',
    'Hey dost! Check your DM, link bhej diya hai ❤️',
    'Bhai inbox dekho, saari details bhej di hain! 🔥',
    'Link send ho gaya bhai, DM check karo! 📩',
    'Sent you the link bro! Check your inbox right now 🚀',
    'Inbox me check karo dost! Sab de diya hai ⚡',
    'Bhai DM check kar lo! Link bhej diya hai ✨',
  ],
};

// ─── 2. Direct Message (DM) Default Templates (10 per language) ─
export const DM_BODY_TEMPLATES: Record<AutomationLanguage, Array<{ title: string; text: string }>> = {
  TENGLISH: [
    {
      title: 'Casual & Friendly',
      text: 'Hey friend! 🙌 Meeru adigina exclusive link idigo. Click chesi enjoy cheyandi! Emaina doubts unte DM lo adagandi! ✨',
    },
    {
      title: 'Bro Style (Community)',
      text: 'Arey bro! 🔥 Meeru adigina details & resource link kindha undi. Check chesi ela undo cheppandi! 🚀',
    },
    {
      title: 'Value Resource Delivery',
      text: 'Hello andi! 🎁 Mana special guide & complete resource ikkada ready ga undi. Miss avvakunda save chesukondi! 💫',
    },
    {
      title: 'VIP / Exclusive',
      text: 'Super excited to share this with you! 🌟 Ee special link meekosame create chesam. Ippude open chesi start cheyandi! ⚡',
    },
    {
      title: 'Step-by-Step Starter',
      text: 'Hey! 🎯 Meeru start cheyadaniki direct link kindha undi. Oka sari open chesi chusi, meeku help ayithe naku cheppandi! 🤝',
    },
    {
      title: 'Quick & Direct',
      text: 'Hello! 📬 Meeru comment chesina link ready ga undi. Kindha unna button click chesi access cheyandi! 📩',
    },
    {
      title: 'Creator Special',
      text: 'Hey there! ❤️ Mana Instagram family kosam idi nenu specially prepare chesa. Hope this brings huge value to you! ✨',
    },
    {
      title: 'Limited Access Drop',
      text: 'Vachesindi! 🚀 Ee link meedha click chesi direct ga access pondandi. Let me know your thoughts after checking it out! 🔥',
    },
    {
      title: 'Helpful Mentor',
      text: 'Hi friend! 🤗 Meekosam link send chesthunna. Read cheyandi, practice cheyandi. Emaina doubt unte always here to help! 💡',
    },
    {
      title: 'Celebration / Reward',
      text: 'Congrats on taking action! 🎉 Ee link tho mee journey inka easy avthundi. Go ahead and unlock it now! 🎁',
    },
  ],
  ENGLISH: [
    {
      title: 'Casual & Warm',
      text: "Hey there! 🙌 Here is the link you requested from my recent post. Tap the button below to check it out! ✨",
    },
    {
      title: 'Friend & Community',
      text: "Hey friend! 🔥 So excited you reached out! Here is the direct link with everything you need. Let me know what you think! 🚀",
    },
    {
      title: 'Value Guide Delivery',
      text: "Hello! 🎁 Your resource is ready. Tap below to access the full guide, and save it so you don't lose it! 💫",
    },
    {
      title: 'VIP Exclusive',
      text: "Boom! 🌟 Here is your VIP access link. I put a lot of work into this, hope it helps you achieve great results! ⚡",
    },
    {
      title: 'Step-by-Step Starter',
      text: "Hey! 🎯 Here is the direct link to get started right away. If you have any questions, just reply here! 🤝",
    },
    {
      title: 'Quick & Direct',
      text: "Hey there! 📬 Here is the link you asked for. Hit the button below to open it immediately! 📩",
    },
    {
      title: 'Creator Special',
      text: "Hey friend! ❤️ Made this specifically for our Instagram community. Hope you get immense value from it! ✨",
    },
    {
      title: 'Action Taker',
      text: "Love that you're taking action! 🚀 The complete link is right below. Go ahead and dive in! 🔥",
    },
    {
      title: 'Helpful Mentor',
      text: "Hi there! 🤗 Here is your link. Take a look and let me know if anything needs clarification! 💡",
    },
    {
      title: 'Celebration / Unlock',
      text: "You unlocked it! 🎉 Here is your direct link. Go check it out and have fun exploring! 🎁",
    },
  ],
  TELUGU_ENGLISH: [
    {
      title: 'Casual Hybrid',
      text: "Hey friend! 🙌 Meeru adigina resource link idigo. Tap the button below to check it out! ✨",
    },
    {
      title: 'Bro Style Hybrid',
      text: "Arey bro! 🔥 So glad you commented. Complete details link kindha undi, take a look! 🚀",
    },
    {
      title: 'Value Guide Hybrid',
      text: "Hello andi! 🎁 Here is the complete guide link for you. Tap below and start exploring! 💫",
    },
    {
      title: 'VIP Exclusive Hybrid',
      text: "Boom! 🌟 Exclusive link mee kosam deliver chesam. Ippude open chesi check cheyandi! ⚡",
    },
    {
      title: 'Quick Access Hybrid',
      text: "Hey! 🎯 Just sent the link over. Button click chesi access chesukondi, let me know if you need help! 🤝",
    },
    {
      title: 'Community Hybrid',
      text: "Hey bro! ❤️ Mana Instagram family kosam idi specially made. Hope you get lots of value from it! ✨",
    },
    {
      title: 'Action Taker Hybrid',
      text: "Super! 🚀 Direct link ready ga undi. Go ahead and tap below to unlock everything! 🔥",
    },
    {
      title: 'Helpful Mentor Hybrid',
      text: "Hi friend! 🤗 Here is the link. Check cheyandi, emaina questions unte reply ivvandi! 💡",
    },
    {
      title: 'Direct Link Hybrid',
      text: "Hello! 📬 Direct link is right here. Kindha button tap chesi access cheyandi! 📩",
    },
    {
      title: 'Celebration Hybrid',
      text: "All set! 🎉 Link is ready for you. Check out the link below and let's grow together! 🎁",
    },
  ],
  HINGLISH: [
    {
      title: 'Casual & Friendly',
      text: 'Hey dost! 🙌 Jo exclusive link aapne maanga tha wo ye raha. Tap karke explore karo! Kuch bhi poochhna ho toh DM me batana ✨',
    },
    {
      title: 'Bhai Style (Community)',
      text: 'Arey bhai! 🔥 Saari details aur direct link niche de diya hai. Check karke batao kaisa laga! 🚀',
    },
    {
      title: 'Giveaway Lucky Ticket 🎟️',
      text: "You're entered in the giveaway! 🎉 Aapka lucky ticket # is {{ticket_number}} 🎟️ Results jaldi announce honge. All the best dost! 🎁",
    },
    {
      title: 'Value Resource Delivery',
      text: 'Hello dost! 🎁 Special guide aur resources yaha ready hain. Save kar lo taaki baad me miss na ho! 💫',
    },
    {
      title: 'VIP Exclusive',
      text: 'Super excited to share this! 🌟 Yeh VIP link specifically hamare active followers ke liye hai. Abhi check karo ⚡',
    },
    {
      title: 'Quick & Direct',
      text: 'Hey there! 📬 Jo link aapne comment kiya tha wo direct niche available hai. Button tap karke access karo! 📩',
    },
    {
      title: 'Action Taker',
      text: 'Love that you took action bhai! 🚀 Direct resource link niche ready hai. Enjoy karo! 🔥',
    },
    {
      title: 'Helpful Mentor',
      text: 'Hi friend! 🤗 Link share kar diya hai. Aaram se check karo, koi bhi problem ho toh I am always here to help! 💡',
    },
  ],
};

// ─── 3. Follow-Gate Initial Prompts ─────────────────────────────
export const FOLLOW_GATE_PROMPTS: Record<AutomationLanguage, (username: string, name?: string) => string[]> = {
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
  HINGLISH: (username, name) => [
    `Arey ruko bro! 👀 Pehle @${username} ko follow karo, fir link unlock ho jayega ✨ Niche 'Profile Dekho' pe tap karke follow karo, fir 'Follow Kar Liya' click karo!`,
    `Wait bhai! 🥺 Pehle @${username} ko follow kar lo dost, fir turant link mil jayega! 👇`,
    `Chhota sa step bro! 🤗 Exclusive link access karne ke liye @${username} ko follow karo, aur 'Follow Kar Liya' tap karo! 🚀`,
    `Hey ${name || 'dost'}! ✨ Exclusive resource hamari community ke liye hai. Pehle @${username} ko follow karo, phir 'Follow Kar Liya' click karo! 🔥`,
    `Almost done bhai! 🎯 Bas ek tap door ho—profile visit karke follow karo aur 'Follow Kar Liya' dabao! ⚡`,
  ],
};

// ─── 4. Follow-Gate Button Labels ───────────────────────────────
export function getFollowButtons(language: AutomationLanguage, username = 'creator') {
  if (language === 'HINGLISH') {
    return [
      { title: 'Profile Dekho ↗', url: `https://instagram.com/${username}` },
      { title: 'Follow Kar Liya ⚡', url: '#confirm-follow' },
    ];
  }
  if (language === 'TENGLISH' || language === 'TELUGU_ENGLISH') {
    return [
      { title: 'Profile Chudandi', url: `https://instagram.com/${username}` },
      { title: 'Follow Ayanu', url: '#confirm-follow' },
    ];
  }
  return [
    { title: 'Visit Profile', url: `https://instagram.com/${username}` },
    { title: "I'm following", url: '#confirm-follow' },
  ];
}

// ─── 5. Email Collection Prompts (10 per language) ──────────────
export const EMAIL_COLLECTION_PROMPTS: Record<AutomationLanguage, (name?: string) => string[]> = {
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
    `Super excited! 🎁 Where should I send the link? Mee email reply ivvandi!`,
  ],
  HINGLISH: (name) => [
    `Hey ${name || 'dost'}! 🎉 Link bhejne ke liye aapka best email ID kya hai? Niche reply karo! 📩`,
    `Super! ✨ Guide & link aapke paas hamesha rahe, isliye apna email address yaha type karo! 🚀`,
    `Awesome ${name || 'bhai'}! 🎁 Direct link deliver karne ke liye apna email ID niche share karo! 👇`,
    `Quick question ${name || 'dost'}! ⚡ Aapka email address kya hai? Reply karo aur turant link access karo! 📬`,
  ],
};

// ─── 6. Story Reply & Live Comment Templates ────────────────────
export const STORY_REPLY_TEMPLATES: Record<AutomationLanguage, string[]> = {
  TENGLISH: [
    'Story chusinanduku thanks bro! Meeru adigina link idigo 🚀',
    'Hey friend! Story meeda reply ichinanduku special link pampanu ✨',
    'Thanks for the story reply! Kindha link undi, check cheyandi 🔥',
  ],
  ENGLISH: [
    'Thanks for replying to my story! Here is the link you requested 🚀',
    'Hey there! Love that you checked out my story—here is your link ✨',
    'Story exclusive! Here is what you asked for right here 🔥',
  ],
  TELUGU_ENGLISH: [
    'Thanks for your story reply bro! Here is your link 🚀',
    'Hey friend! Story lo chusina link mee kosam sent ✨',
  ],
  HINGLISH: [
    'Story pe reply karne ke liye thanks bhai! Yeh raha aapka link 🚀',
    'Hey dost! Story dekhne ke liye shukriya, link inbox me send kar diya hai ✨',
    'Story exclusive link ready hai bhai, niche tap karke dekho! 🔥',
  ],
};

// ─── 7. Story Mention Default Templates (Fan Loyalty Booster) ──
export const STORY_MENTION_TEMPLATES: Record<AutomationLanguage, Array<{ title: string; text: string; hasButton?: boolean }>> = {
  ENGLISH: [
    {
      title: 'Warm Fan Thank-You (No Link)',
      text: 'Hey {{first_name}}! 🙌 Thank you so much for the story mention! Really appreciate your love and support bro ❤️',
    },
    {
      title: 'Shoutout Appreciation',
      text: 'Loved the story tag {{first_name}}! ✨ Means the world to have followers like you. Hope you have an awesome week! 🔥',
    },
    {
      title: 'With Special Gift / Resource (Optional)',
      text: 'Thank you so much for the story mention, {{first_name}}! 🎁 To show my appreciation, here is a special link just for you:',
      hasButton: true,
    },
    {
      title: 'VIP Community Invite',
      text: 'Thanks for the story shoutout! 🙌 If you want to connect closer with us, join our VIP community below:',
      hasButton: true,
    },
  ],
  TENGLISH: [
    {
      title: 'Warm Fan Thank-You (No Link)',
      text: 'Hey {{first_name}}! 🙌 Story lo tag chesinandhuku chala chala thanks bro! Mee love and support ki nijanga thankful ❤️',
    },
    {
      title: 'Casual Shoutout Love',
      text: 'Story mention chusanu {{first_name}}! Chala happy ga anipinchindi bro. Thanks a lot for the love! 🔥✨',
    },
    {
      title: 'With Special Gift / Resource (Optional)',
      text: 'Story lo mention chesinandhuku thanks {{first_name}}! 🎁 Mee support ki gratitude ga ee special link share chestunna:',
      hasButton: true,
    },
  ],
  TELUGU_ENGLISH: [
    {
      title: 'Warm Fan Thank-You (No Link)',
      text: 'Hey {{first_name}}! 🙌 Thanks so much for the story tag! Mee continuous support means a lot to me bro ❤️',
    },
    {
      title: 'Shoutout Appreciation',
      text: 'Loved the story mention {{first_name}}! ✨ Thank you for sharing the love with your friends! 🔥',
    },
    {
      title: 'With Special Gift / Resource (Optional)',
      text: 'Thanks for tagging me in your story {{first_name}}! 🎁 Here is an exclusive gift link just for you:',
      hasButton: true,
    },
  ],
  HINGLISH: [
    {
      title: 'Warm Fan Thank-You (No Link)',
      text: 'Hey {{first_name}}! 🙌 Story me tag karne ke liye bohot bohot shukriya bhai! Dil se support ke liye thanks ❤️',
    },
    {
      title: 'Casual Shoutout Love',
      text: 'Story mention dekha {{first_name}}! Bohot accha laga bhai. Thanks a lot for your love and support! 🔥✨',
    },
    {
      title: 'With Special Gift / Resource (Optional)',
      text: 'Story me mention karne ke liye shukriya {{first_name}}! 🎁 Aapke support ke liye yeh special gift link share kar raha hoon:',
      hasButton: true,
    },
    {
      title: 'VIP Community Invite',
      text: 'Story shoutout ke liye thanks {{first_name}}! 🙌 Hamari exclusive VIP community join karne ke liye niche click karo:',
      hasButton: true,
    },
  ],
};

// ─── 8. Helpers ─────────────────────────────────────────────────
export function normalizeLanguage(lang?: string | null): AutomationLanguage {
  if (lang === 'TENGLISH' || lang === 'TELUGU_ENGLISH' || lang === 'HINGLISH') return lang;
  return 'ENGLISH';
}

export function getRandomFollowPrompt(language: AutomationLanguage, username = 'creator', name?: string): string {
  const prompts = FOLLOW_GATE_PROMPTS[language](username, name);
  return prompts[0];
}

export function getRandomEmailPrompt(language: AutomationLanguage, name?: string): string {
  const prompts = EMAIL_COLLECTION_PROMPTS[language](name);
  return prompts[0];
}
