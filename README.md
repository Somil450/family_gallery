# 📸 FamVault – Your Private Family Memory Cloud

FamVault is a modern, secure, and privacy-first Progressive Web App (PWA) designed to store and share your family's precious memories. Built with **React**, **TypeScript**, and **Firebase**, it offers a premium experience for preserving photos and videos within a closed family circle.

![FamVault Preview](https://famvault-dd2a1.web.app/icon-512.png)

## 🔗 Live Links
- **Vercel (Primary):** [https://family-gallery-s2p1.vercel.app](https://family-gallery-s2p1.vercel.app)
- **Firebase Hosting:** [https://famvault-dd2a1.web.app](https://famvault-dd2a1.web.app)

## ✨ Features

- **🔐 Private & Secure:** End-to-end cloud storage powered by Firebase.
- **🏠 Family Vaults:** Create a private vault for your family and invite members via secure 6-character codes.
- **📱 PWA Ready:** Installable on iOS, Android, and Desktop with a native-app feel.
- **🌓 Dark/Light Mode:** Premium UI with glassmorphism effects and adaptive themes.
- **📤 Smart Sharing:** Instant invite links and QR-ready codes for family onboarding.
- **🖼️ Media Gallery:** High-performance gallery with lightbox support for photos and videos.
- **🔄 Local Mode:** Full functionality even without Firebase (local-only storage fallback).
- **🚀 Account Management:** Google Auth integration with easy account switching.

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Backend:** Firebase (Auth, Firestore, Storage)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Styling:** Vanilla CSS (Modern Design System)
- **PWA:** Vite PWA Plugin with Service Worker integration

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Somil450/family_gallery.git
cd family_gallery/web
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run Development Server
```bash
npm run dev
```

## 📦 Deployment

The app is set up for automatic deployment to **Vercel** and **Firebase Hosting**. Any changes pushed to the `main` branch are automatically built and deployed.

## 📱 Installation (PWA)

### **iOS (Safari)**
1. Tap the **Share** icon.
2. Select **"Add to Home Screen"**.

### **Android (Chrome)**
1. Tap the **"Install App"** button inside the Profile screen.
2. Or open the menu (⋮) and select **"Install App"**.

## 🛡️ Security Rules

This project uses strict Firestore security rules to ensure:
1. Only family members can read/write to their vault.
2. Storage limits are enforced per family.
3. Vault disbanding is restricted to admins or ownerless states.

---
Built with ❤️ by [Somil450](https://github.com/Somil450)
