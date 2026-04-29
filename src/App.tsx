import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Images, Upload, Clock, User } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useShareTarget, ShareTargetToast } from './context/ShareTargetContext';
import OnboardingScreen from './pages/Onboarding/OnboardingScreen';
import HomeScreen from './pages/Home/HomeScreen';
import GalleryScreen from './pages/Gallery/GalleryScreen';
import UploadScreen from './pages/Upload/UploadScreen';
import TimelineScreen from './pages/Timeline/TimelineScreen';
import ProfileScreen from './pages/Profile/ProfileScreen';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import './index.css';

type Tab = 'home' | 'gallery' | 'upload' | 'timeline' | 'profile';

const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: 'home',     icon: <Home size={20} />,    label: 'Home' },
  { id: 'gallery',  icon: <Images size={20} />,  label: 'Gallery' },
  { id: 'upload',   icon: <Upload size={20} />,  label: 'Upload' },
  { id: 'timeline', icon: <Clock size={20} />,   label: 'Memories' },
  { id: 'profile',  icon: <User size={20} />,    label: 'Profile' },
];

function InstallBanner({ isInstallable, promptInstall }: { isInstallable: boolean; promptInstall: () => void }) {
  return (
    <AnimatePresence>
      {isInstallable && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          style={{ background: 'var(--accent)', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 200, flexShrink: 0 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Install FamVault</span>
            <span style={{ fontSize: 12, opacity: 0.9 }}>Add to home screen for the full app experience</span>
          </div>
          <button
            onClick={promptInstall}
            style={{ background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 99, padding: '6px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            Install
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppInner() {
  const { userDoc, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Register service worker for Web Share Target
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Handle files shared from other apps
  const { sharedFiles, shareActive, dismissShare } = useShareTarget(() => setActiveTab('gallery'));

  // Install Prompt
  const { isInstallable, promptInstall } = useInstallPrompt();

  // Loading splash
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
          }}
        />
      </div>
    );
  }

  // No user or no family → onboarding
  if (!userDoc?.familyId) {
    return (
      <div className="app-shell" style={{ overflow: 'auto' }}>
        <InstallBanner isInstallable={isInstallable} promptInstall={promptInstall} />
        <OnboardingScreen />
      </div>
    );
  }

  const SCREENS: Record<Tab, React.ReactNode> = {
    home:     <HomeScreen onTabChange={(tab) => setActiveTab(tab as Tab)} />,
    gallery:  <GalleryScreen />,
    upload:   <UploadScreen onDone={() => setActiveTab('gallery')} />,
    timeline: <TimelineScreen />,
    profile:  <ProfileScreen />,
  };

  return (
    <div className="app-shell">
      {/* Install App Banner (Android/Chrome only) */}
      <InstallBanner isInstallable={isInstallable} promptInstall={promptInstall} />

      {/* Screen */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ flex: 1, overflow: 'hidden' }}
        >
          {SCREENS[activeTab]}
        </motion.div>
      </AnimatePresence>

      {/* Share Target Toast — shown when files arrive from other apps */}
      {shareActive && (
        <ShareTargetToast files={sharedFiles} onDismiss={dismissShare} />
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeTab;
          const isUpload = item.id === 'upload';

          if (isUpload) {
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.88 }}
                onClick={() => setActiveTab(item.id)}
                className="nav-upload-btn"
                style={{ background: isActive ? 'var(--grad-accent)' : 'var(--grad-primary)' }}
              >
                {item.icon}
              </motion.button>
            );
          }

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.88 }}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <motion.div animate={{ y: isActive ? -2 : 0 }} transition={{ type: 'spring', stiffness: 400 }}>
                {item.icon}
              </motion.div>
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  style={{
                    position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)',
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
