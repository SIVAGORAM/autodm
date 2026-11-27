'use client';

import { useState } from 'react';
import {
  Check,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Gift,
  AtSign,
  Languages,
} from 'lucide-react';
import styles from '../app/page.module.css';

type DemoTab = 'comment' | 'story' | 'hinglish' | 'giveaway';

export function LandingReplyDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>('comment');

  return (
    <div className={styles.replyPath} aria-label="Interactive automation workflow simulator">
      <div className={styles.demoHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setActiveTab('comment')}
            className={`${styles.demoTab} ${activeTab === 'comment' ? styles.demoTabActive : ''}`}
          >
            <MessageCircle size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Reel Comment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('story')}
            className={`${styles.demoTab} ${activeTab === 'story' ? styles.demoTabActive : ''}`}
          >
            <AtSign size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Story Mention
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hinglish')}
            className={`${styles.demoTab} ${activeTab === 'hinglish' ? styles.demoTabActive : ''}`}
          >
            <Languages size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Hinglish
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giveaway')}
            className={`${styles.demoTab} ${activeTab === 'giveaway' ? styles.demoTabActive : ''}`}
          >
            <Gift size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Giveaway
          </button>
        </div>
        <span className={styles.exampleTag}>Live Simulation</span>
      </div>

      {activeTab === 'comment' && (
        <div className={styles.pathBody}>
          <div className={styles.pathRail} aria-hidden="true"><span /><span /><span /></div>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>01</span>
            <div className={styles.commentCard}>
              <div className={styles.commentAvatar} aria-hidden="true">R</div>
              <div className={styles.commentText}>
                <small>Comment on Reel · @rohit_dev</small>
                <p>Bro please send the preset link!</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f43f5e', fontSize: 11, fontWeight: 700 }}>
                <Heart size={14} fill="#f43f5e" /> Liked
              </div>
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>02</span>
            <div className={styles.matchCard}>
              <div className={styles.matchMark}><Check size={16} aria-hidden="true" /></div>
              <div>
                <small>Keyword Match + Public Reply</small>
                <p>&ldquo;Sent! Check your DMs brother 📩&rdquo;</p>
              </div>
              <span className={styles.matchState}>Automated</span>
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>03</span>
            <div className={styles.replyCard}>
              <div className={styles.replyLabel}><MessageCircle size={15} aria-hidden="true" /><small>Private DM Delivered</small></div>
              <p>Hey Rohit! Thanks for the love on my Reel 🙌 Here is your free Lightroom preset download 👇</p>
              <div style={{ marginTop: 8, padding: '7px 12px', background: 'rgba(185, 245, 0, 0.15)', border: '1px solid #b9f500', borderRadius: 8, color: '#b9f500', fontSize: 12, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Download Preset [↗]
              </div>
              <div className={styles.replyFooter}><span>Delivered in 2.1 seconds</span><ArrowUpRight size={14} aria-hidden="true" /></div>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'story' && (
        <div className={styles.pathBody}>
          <div className={styles.pathRail} aria-hidden="true"><span /><span /><span /></div>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>01</span>
            <div className={styles.commentCard}>
              <div className={styles.commentAvatar} style={{ background: '#fce7f3', color: '#be185d' }} aria-hidden="true">A</div>
              <div className={styles.commentText}>
                <small>Instagram Story Tag · @ananya_art</small>
                <p>Tagged you in their story: &ldquo;Best creator tips from @yourhandle ❤️&rdquo;</p>
              </div>
              <AtSign size={17} style={{ color: '#ec4899' }} aria-hidden="true" />
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>02</span>
            <div className={styles.matchCard}>
              <div className={styles.matchMark} style={{ background: '#ec4899', color: '#fff' }}><Sparkles size={16} aria-hidden="true" /></div>
              <div>
                <small>Story Mention Detected</small>
                <p>HeyLaunch Fan Appreciation Trigger</p>
              </div>
              <span className={styles.matchState} style={{ color: '#f472b6' }}>Instant</span>
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>03</span>
            <div className={styles.replyCard}>
              <div className={styles.replyLabel}><MessageCircle size={15} aria-hidden="true" /><small>Warm DM Delivered to Fan</small></div>
              <p>Thank you so much for the story mention Ananya! Means the world to me 🙌 Here is a secret gift link for you ✨</p>
              <div className={styles.replyFooter}><span>Turns casual viewers into superfans</span><Heart size={14} fill="#f43f5e" style={{ color: '#f43f5e' }} aria-hidden="true" /></div>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'hinglish' && (
        <div className={styles.pathBody}>
          <div className={styles.pathRail} aria-hidden="true"><span /><span /><span /></div>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>01</span>
            <div className={styles.commentCard}>
              <div className={styles.commentAvatar} style={{ background: '#fef3c7', color: '#b45309' }} aria-hidden="true">V</div>
              <div className={styles.commentText}>
                <small>Public Comment · @vikram_vlogs</small>
                <p>LINK bhej do bhai!</p>
              </div>
              <MessageCircle size={17} aria-hidden="true" />
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>02</span>
            <div className={styles.matchCard}>
              <div className={styles.matchMark} style={{ background: '#f59e0b', color: '#fff' }}><Languages size={16} aria-hidden="true" /></div>
              <div>
                <small>Public Reply (Hinglish)</small>
                <p>&ldquo;Bhai DM check karo! Link bhej diya hai 📩&rdquo;</p>
              </div>
              <span className={styles.matchState} style={{ color: '#fbbf24' }}>Hinglish</span>
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>03</span>
            <div className={styles.replyCard}>
              <div className={styles.replyLabel}><MessageCircle size={15} aria-hidden="true" /><small>Follow-First Gate Prompt</small></div>
              <p>Arey ruko bro! Pehle @yourhandle ko follow karo, fir link unlock ho jayega ✨</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                  Profile Dekho ↗
                </span>
                <span style={{ padding: '6px 12px', background: '#b9f500', color: '#171c18', borderRadius: 8, fontSize: 11, fontWeight: 750 }}>
                  Follow Kar Liya ⚡
                </span>
              </div>
              <div className={styles.replyFooter}><span>Unlocks link automatically on tap</span><ArrowUpRight size={14} aria-hidden="true" /></div>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'giveaway' && (
        <div className={styles.pathBody}>
          <div className={styles.pathRail} aria-hidden="true"><span /><span /><span /></div>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>01</span>
            <div className={styles.commentCard}>
              <div className={styles.commentAvatar} style={{ background: '#ede9fe', color: '#6d28d9' }} aria-hidden="true">S</div>
              <div className={styles.commentText}>
                <small>Giveaway Comment · @sneha_lens</small>
                <p>GIFT to win the camera giveaway!</p>
              </div>
              <Gift size={17} style={{ color: '#8b5cf6' }} aria-hidden="true" />
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>02</span>
            <div className={styles.matchCard}>
              <div className={styles.matchMark} style={{ background: '#8b5cf6', color: '#fff' }}><Check size={16} aria-hidden="true" /></div>
              <div>
                <small>Follower Verified + Ticket Issued</small>
                <p>Unique Sequential Ticket Assigned</p>
              </div>
              <span className={styles.matchState} style={{ color: '#a78bfa' }}>Ticket #4182</span>
            </div>
          </article>
          <article className={styles.pathStep}>
            <span className={styles.pathIndex}>03</span>
            <div className={styles.replyCard}>
              <div className={styles.replyLabel}><MessageCircle size={15} aria-hidden="true" /><small>DM with Lucky Ticket</small></div>
              <p>You&apos;re entered! Your lucky ticket # is 4182 🎟️ Winner announced live in our Sunday stream!</p>
              <div style={{ marginTop: 8, padding: '7px 12px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6', borderRadius: 8, color: '#c4b5fd', fontSize: 11.5, fontWeight: 700 }}>
                🎲 Dashboard: 1-Click Pick Random Winner
              </div>
              <div className={styles.replyFooter}><span>Export all entries to CSV anytime</span><Gift size={14} aria-hidden="true" /></div>
            </div>
          </article>
        </div>
      )}

      <div className={styles.demoFoot}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Official Meta Instagram Graph API · Zero password sharing · 100% policy safe</span>
      </div>
    </div>
  );
}
