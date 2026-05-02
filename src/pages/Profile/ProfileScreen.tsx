import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Moon, Sun, Shield, Users, HardDrive, Crown, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { logOut } from '../../firebase/auth';
import { isFirebaseConfigured } from '../../firebase/config';
import {
  localGetFamilyMembers,
  localRegenerateCode,
  localSignOut,
  type LocalUser,
} from '../../lib/localStore';
import { getFamilyMembers, regenerateInviteCode, leaveFamily, disbandFamily } from '../../firebase/firestore';
import type { UserDoc } from '../../types';
import { InviteCodeDisplay } from '../Onboarding/OnboardingScreen';

export default function ProfileScreen() {
  const { userDoc, family, refreshLocal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [members, setMembers] = useState<(UserDoc | LocalUser)[]>([]);
  const [regenLoading, setRegenLoading] = useState(false);
  const [localCode, setLocalCode] = useState<string | null>(null);

  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();

  useEffect(() => {
    if (!family) return;
    if (!isFirebaseConfigured) {
      setMembers(localGetFamilyMembers(family.memberUids));
    } else {
      getFamilyMembers(family.id).then(setMembers);
    }
  }, [family?.memberUids.length]);

  const handleRegenCode = async () => {
    if (!family) return;
    setRegenLoading(true);
    try {
      if (!isFirebaseConfigured) {
        const newCode = localRegenerateCode(family.id);
        setLocalCode(newCode);
        refreshLocal();
        toast.success('New invite code generated!');
      } else {
        await regenerateInviteCode(family.id);
        toast.success('Invite code regenerated!');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRegenLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!isFirebaseConfigured) {
      localSignOut();
      refreshLocal();
    } else {
      await logOut();
    }
  };

  const handleInstallClick = () => {
    if (isInstallable) {
      promptInstall();
    } else if (isInstalled) {
      toast.success('App is already installed!');
    } else {
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isInApp = /FBAN|FBAV|Instagram|LinkedIn|Messenger|Twitter|WhatsApp/.test(ua);

      if (isInApp) {
        toast('⚠️ You are in an In-App Browser. Please "Open in Chrome" or "Open in Safari" to install.', { duration: 6000 });
      } else if (isIOS) {
        toast('To install: Tap the "Share" button at the bottom and then "Add to Home Screen" 📲', { duration: 6000 });
      } else {
        toast('To install: Open the browser menu (⋮) and select "Install App" or "Add to Home screen"', { duration: 6000 });
      }
    }
  };

  const handleLeaveFamily = async () => {
    if (!userDoc) return;
    
    if (isAdmin && family) {
      if (!window.confirm(`⚠️ You are the Admin. If you leave, the vault "${family.name}" will be DELETED for everyone. Proceed?`)) return;
      handleDisbandFamily();
      return;
    }

    const vaultName = family?.name || 'this vault';
    if (!window.confirm(`Are you sure you want to leave ${vaultName}?`)) return;

    try {
      if (!isFirebaseConfigured) {
        toast('Local mode leave not implemented yet. Use Sign Out.');
      } else {
        // Use userDoc.familyId directly in case family object is null
        const fid = family?.id || userDoc.familyId;
        if (fid) await leaveFamily(userDoc.uid, fid);
        toast.success('Vault cleared.');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDisbandFamily = async () => {
    if (!family || !userDoc) return;
    if (!isAdmin && !isOwnerless) return;

    if (!window.confirm(`⚠️ WARNING: Are you sure you want to DISBAND "${family.name}"? This will delete the vault for everyone and you will have to create a new one.`)) return;

    try {
      if (!isFirebaseConfigured) {
        toast('Local mode disband not implemented yet.');
      } else {
        await disbandFamily(userDoc.uid, family.id);
        toast.success('The vault has been disbanded.');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isAdmin = userDoc?.role === 'admin';
  const isOwnerless = family && (!family.adminUid || !family.memberUids.includes(family.adminUid));
  const currentCode = localCode ?? family?.inviteCode ?? '';

  return (
    <div className="page-content">
      <div style={{ padding: '24px 20px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Profile</h1>
      </div>

      {/* User card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ margin: '0 20px 16px', padding: '20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="avatar" style={{ width: 60, height: 60, fontSize: 22, overflow: 'hidden', flexShrink: 0 }}>
            {userDoc?.photoURL
              ? <img src={userDoc.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : userDoc?.displayName?.[0]?.toUpperCase() ?? 'U'
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userDoc?.displayName}
            </p>
            {userDoc?.email && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 1 }}>{userDoc.email}</p>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {isAdmin && (
                <span className="badge" style={{ background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px' }}>
                  <Crown size={11} /> Admin
                </span>
              )}
              <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px' }}>
                <Shield size={11} /> {isFirebaseConfigured ? 'E2E Encrypted' : 'Local Mode'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Storage stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card"
        style={{ margin: '0 20px 16px', padding: '18px 20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <HardDrive size={16} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Family Storage</span>
        </div>
        <div className="progress-track" style={{ marginBottom: 8 }}>
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, ((family?.storageUsedBytes ?? 0) / (family?.storageLimitBytes ?? 1)) * 100)}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>{fmtBytes(family?.storageUsedBytes ?? 0)} used</span>
          <span>{fmtBytes(family?.storageLimitBytes ?? 10737418240)} total</span>
        </div>
      </motion.div>

      {/* Members */}
      {members.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card"
          style={{ margin: '0 20px 16px', padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Users size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{family?.name}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map(m => (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                  {m.photoURL
                    ? <img src={m.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : m.displayName[0]?.toUpperCase()
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.displayName}</p>
                  {m.email && <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{m.email}</p>}
                </div>
                {m.uid === family?.adminUid && (
                  <span className="badge" style={{ fontSize: 10, padding: '2px 8px' }}>Admin</span>
                )}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtBytes(m.storageUsedBytes ?? 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Invite section */}
      {family && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card"
          style={{ margin: '0 20px 16px', padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Invite to {family.name}</span>
            </div>
            {isAdmin && (
              <button
                className="btn-icon"
                onClick={handleRegenCode}
                disabled={regenLoading}
                title="Generate new code"
                style={{ width: 32, height: 32 }}
              >
                <RefreshCw size={14} className={regenLoading ? 'spinning' : ''} />
              </button>
            )}
          </div>

          <InviteCodeDisplay code={currentCode} familyId={family.id} />

          {family.inviteCodeExpiry && (
            <p style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
              Expires {new Date(
                typeof family.inviteCodeExpiry === 'number'
                  ? family.inviteCodeExpiry
                  : (family.inviteCodeExpiry as any).toDate?.().getTime?.() ?? 0
              ).toLocaleDateString()}
            </p>
          )}
        </motion.div>
      )}

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <SettingRow
          icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={toggleTheme}
        />
        <SettingRow icon={<Shield size={18} />} label="Privacy & Security" onClick={() => toast('Coming soon!')} />
        {family && (
          <SettingRow 
            icon={<Sparkles size={18} color="var(--accent)" />} 
            label={isInstalled ? "App Installed" : "Install FamVault App"} 
            onClick={isInstalled ? () => toast.success('App is already installed!') : handleInstallClick} 
            style={{ 
              background: isInstalled ? 'rgba(34,197,94,0.1)' : 'rgba(124,106,255,0.1)', 
              borderColor: isInstalled ? 'var(--success)' : 'var(--accent)',
              opacity: isInstalled ? 0.7 : 1
            }}
          />
        )}
        {!family && userDoc?.familyId && (
          <SettingRow 
            icon={<RefreshCw size={18} color="var(--danger)" />} 
            label="Reset Ghost Vault (Clear Data)" 
            onClick={handleLeaveFamily} 
            danger 
          />
        )}

        {isAdmin && family && (
          <SettingRow 
            icon={<LogOut size={18} color="var(--danger)" />} 
            label={`Disband "${family.name}" Vault (Delete)`} 
            onClick={handleDisbandFamily} 
            danger 
          />
        )}
        {!isAdmin && family && (
          <>
            {isOwnerless && (
              <SettingRow 
                icon={<LogOut size={18} color="var(--danger)" />} 
                label={`Disband Ownerless Vault (Delete)`} 
                onClick={handleDisbandFamily} 
                danger 
              />
            )}
            <SettingRow 
              icon={<LogOut size={18} color="var(--danger)" />} 
              label={`Leave "${family.name}" Vault`} 
              onClick={handleLeaveFamily} 
              danger 
            />
          </>
        )}
        <SettingRow icon={<LogOut size={18} color="var(--danger)" />} label="Sign Out" onClick={handleSignOut} danger />
      </motion.div>

      <div style={{ height: 40 }} />
    </div>
  );
}

function SettingRow({ icon, label, onClick, danger, style }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-glass)', border: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        color: danger ? 'var(--danger)' : 'var(--text-primary)',
        transition: 'background 0.2s',
        marginBottom: 8,
        ...style,
      }}
    >
      {icon}
      <span style={{ fontWeight: 500, fontSize: 14 }}>{label}</span>
    </button>
  );
}

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
