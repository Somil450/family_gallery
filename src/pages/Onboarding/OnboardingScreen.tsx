import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ArrowRight, Copy, Check, ChevronLeft, Sparkles,
  UserCircle, Home, Hash, LogIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../firebase/config';
import {
  localCreateUser,
  localCreateFamily,
  localJoinFamily,
  localGetCurrentUser,
} from '../../lib/localStore';

// Firebase imports (only used when configured)
import { signInWithGoogle, signInGuest } from '../../firebase/auth';
import { createFamily, joinFamilyByCode } from '../../firebase/firestore';

import { useInstallPrompt } from '../../hooks/useInstallPrompt';

type Step = 'welcome' | 'name' | 'family-choice' | 'create' | 'join' | 'firebase-auth';

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit:    { opacity: 0, x: -30, transition: { duration: 0.2 } },
};

export default function OnboardingScreen() {
  const { refreshLocal, firebaseUser } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { isInstallable, promptInstall } = useInstallPrompt();

  // Check URL for auto-join code (?join=XXXXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && joinCode.length === 6) {
      setCode(joinCode.toUpperCase());
      setStep('name');
    }
  }, []);

  // Firebase mode: if user is logged in but has no family, skip to family choice
  useEffect(() => {
    if (isFirebaseConfigured && firebaseUser) {
      setStep('family-choice');
    }
  }, [firebaseUser]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleNameContinue = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Enter your name (at least 2 characters)');
      return;
    }
    
    if (isFirebase && !firebaseUser) {
      try {
        setLoading(true);
        await signInGuest(name.trim());
        // Step will automatically advance via useEffect
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    } else {
      setStep('family-choice');
    }
  };

  const handleLocalCreate = () => {
    if (!familyName.trim()) { toast.error('Enter a family name'); return; }
    try {
      setLoading(true);
      const user = localCreateUser(name.trim());
      localCreateFamily(user, familyName.trim());
      toast.success(`${familyName} vault created! 🎉`);
      // Clear join param from URL if present
      window.history.replaceState({}, '', '/');
      refreshLocal();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalJoin = () => {
    if (code.length !== 6) { toast.error('Enter a 6-character invite code'); return; }
    try {
      setLoading(true);
      const user = localCreateUser(name.trim() || 'Family Member');
      const family = localJoinFamily(user, code);
      toast.success(`Joined ${family.name}! 🎉`);
      window.history.replaceState({}, '', '/');
      refreshLocal();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (e: any) {
      toast.error(e.message ?? 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFirebaseCreate = async () => {
    if (!familyName.trim()) { toast.error('Enter a family name'); return; }
    if (!firebaseUser) { toast.error('Please sign in to create a vault'); return; }
    try {
      setLoading(true);
      await createFamily(firebaseUser.uid, familyName.trim());
      toast.success(`${familyName} vault created! 🎉`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFirebaseJoin = async () => {
    if (code.length !== 6) { toast.error('Enter a 6-character invite code'); return; }
    if (!firebaseUser) { toast.error('Please sign in to join a vault'); return; }
    try {
      setLoading(true);
      await joinFamilyByCode(firebaseUser.uid, code.trim());
      toast.success('Joined family! 🎉');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed ─────────────────────────────────────────────────────────────────

  const isFirebase = isFirebaseConfigured;
  const doCreate = isFirebase ? handleFirebaseCreate : handleLocalCreate;
  const doJoin   = isFirebase ? handleFirebaseJoin   : handleLocalJoin;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow orbs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-15%',
        width: '55%', height: '55%',
        background: 'radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%',
        width: '45%', height: '45%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '50%', right: '-5%',
        width: '30%', height: '30%',
        background: 'radial-gradient(circle, rgba(240,147,251,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Logo mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ textAlign: 'center', marginBottom: 36, position: 'relative', zIndex: 1 }}
      >
        <div style={{
          width: 76, height: 76, borderRadius: 24,
          background: 'var(--grad-primary)',
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(124,106,255,0.12), 0 16px 56px rgba(124,106,255,0.45)',
          position: 'relative',
        }}>
          <Users size={34} color="#fff" />
          {/* Ring pulse */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: -8,
              borderRadius: 32,
              border: '2px solid rgba(124,106,255,0.3)',
            }}
          />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>FamVault</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '5px 0 0', letterSpacing: '0.02em' }}>
          Your family's private memory cloud
        </p>
      </motion.div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 24,
        padding: '28px 24px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
        backdropFilter: 'blur(32px)',
        minHeight: 320,
        display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1,
      }}>
        <AnimatePresence mode="wait">

          {/* ── WELCOME ── */}
          {step === 'welcome' && (
            <motion.div key="welcome" variants={slide} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Welcome 👋</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
                FamVault keeps your family photos &amp; videos safe, together, forever.
              </p>

              {isFirebase ? (
                <>
                  <button className="btn-primary" onClick={handleGoogleLogin} disabled={loading} style={{ gap: 10 }}>
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, margin: '4px 0' }}>or</div>
                  <button className="btn-secondary" onClick={() => setStep('name')}>
                    <UserCircle size={16} /> Continue with name only
                  </button>
                </>
              ) : (
                <button className="btn-primary" onClick={() => setStep('name')} style={{ marginTop: 8 }}>
                  Get Started <ArrowRight size={16} />
                </button>
              )}

              {isInstallable && (
                <button className="btn-secondary" onClick={promptInstall} style={{ marginTop: 4, background: 'rgba(124,106,255,0.15)', color: 'var(--accent)' }}>
                  ⬇️ Install App to Home Screen
                </button>
              )}

              <p style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', marginTop: 'auto', paddingTop: 12 }}>
                No account needed · Works offline · Private &amp; encrypted
              </p>
            </motion.div>
          )}

          {/* ── NAME ── */}
          {step === 'name' && (
            <motion.div key="name" variants={slide} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}
            >
              <BackBtn onClick={() => setStep('welcome')} />
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>What's your name?</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Your family will see this.</p>
              </div>
              <input
                className="input"
                placeholder="e.g. Ananya"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleNameContinue()}
                style={{ fontSize: 18, fontWeight: 600 }}
              />
              <button className="btn-primary" onClick={handleNameContinue} disabled={!name.trim()} style={{ marginTop: 'auto' }}>
                Continue <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ── FAMILY CHOICE ── */}
          {step === 'family-choice' && (
            <motion.div key="choice" variants={slide} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}
            >
              {!isFirebase && <BackBtn onClick={() => setStep('name')} />}
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
                  {isFirebase ? `Welcome, ${firebaseUser?.displayName?.split(' ')[0] ?? 'there'}!` : `Hi, ${name.split(' ')[0]}!`}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Create a vault for your family or join an existing one.</p>
              </div>

              <button
                onClick={() => setStep('create')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'var(--bg-glass)', border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '18px 20px', cursor: 'pointer',
                  textAlign: 'left', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Home size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Create a Family Vault</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>Start fresh — invite family members later</div>
                </div>
                <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
              </button>

              <button
                onClick={() => setStep('join')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'var(--bg-glass)', border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '18px 20px', cursor: 'pointer',
                  textAlign: 'left', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #f093fb, #f5576c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LogIn size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Join with Invite Code</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                    {code ? `Using code: ${code}` : 'Enter the 6-character code from your family'}
                  </div>
                </div>
                <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
              </button>
            </motion.div>
          )}

          {/* ── CREATE ── */}
          {step === 'create' && (
            <motion.div key="create" variants={slide} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}
            >
              <BackBtn onClick={() => setStep('family-choice')} />
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Name your vault</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Pick something your family will recognize.</p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {['The Sharmas', 'Patel Family', 'Our Family'].map(s => (
                  <button key={s} onClick={() => setFamilyName(s)}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 20,
                      background: familyName === s ? 'var(--accent)' : 'var(--bg-glass)',
                      border: '1px solid var(--border)',
                      color: familyName === s ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >{s}</button>
                ))}
              </div>

              <input
                className="input"
                placeholder="e.g. The Sharma Family"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && !loading && doCreate()}
                style={{ fontSize: 16, fontWeight: 600 }}
              />
              <button className="btn-primary" onClick={doCreate}
                disabled={loading || !familyName.trim()} style={{ marginTop: 'auto' }}
              >
                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <>Create Vault <Sparkles size={16} /></>}
              </button>
            </motion.div>
          )}

          {/* ── JOIN ── */}
          {step === 'join' && (
            <motion.div key="join" variants={slide} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}
            >
              <BackBtn onClick={() => setStep('family-choice')} />
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Enter invite code</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Ask your family admin to share their invite code or link from the Profile screen.
                </p>
              </div>

              <div style={{ position: 'relative' }}>
                <Hash size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  placeholder="A B C 1 2 3"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && !loading && doJoin()}
                  style={{
                    paddingLeft: 40, fontSize: 22, fontWeight: 800,
                    letterSpacing: 10, textAlign: 'center',
                  }}
                />
              </div>

              {code.length > 0 && code.length < 6 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                  {6 - code.length} more character{code.length < 5 ? 's' : ''} needed
                </p>
              )}

              <button className="btn-primary" onClick={doJoin}
                disabled={loading || code.length !== 6} style={{ marginTop: 'auto' }}
              >
                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <>Join Vault <ArrowRight size={16} /></>}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 20, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {isFirebaseConfigured ? 'Powered by Firebase · End-to-end encrypted' : 'Local mode · Data saved on this device'}
      </p>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      color: 'var(--text-muted)', fontSize: 13, background: 'none',
      border: 'none', cursor: 'pointer', padding: '0 0 4px',
    }}>
      <ChevronLeft size={16} /> Back
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Invite Code Copy Widget (used on Profile screen) ────────────────────────
// Exported for reuse in ProfileScreen
export function InviteCodeDisplay({ code, familyId }: { code: string; familyId: string }) {
  const [copied, setCopied] = useState(false);
  const shareURL = `${window.location.origin}/?join=${code}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my FamVault',
          text: `Join our family vault on FamVault! Use code: ${code}`,
          url: shareURL,
        });
      } catch { /* dismissed */ }
    } else {
      copy(shareURL);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Code display */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-glass)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '12px 16px',
      }}>
        <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: 8, flex: 1, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {code}
        </span>
        <button className="btn-icon" onClick={() => copy(code)} title="Copy code" style={{ width: 36, height: 36, flexShrink: 0 }}>
          {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={share}>
          📤 Share Invite Link
        </button>
        <button className="btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={() => copy(shareURL)}>
          <Copy size={13} /> Copy Link
        </button>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        Invite link: <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{shareURL}</span>
      </p>
    </div>
  );
}
