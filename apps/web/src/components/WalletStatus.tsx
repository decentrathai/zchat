'use client';

import { useEffect, useState } from 'react';

// Type for the wallet core module
type WalletCore = {
  init_new_wallet: () => string;
  get_backup_phrase: () => string;
  send_message_dm: (to_address: string, text: string) => string;
};

export default function WalletStatus() {
  const [walletCore, setWalletCore] = useState<WalletCore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // This runs only on the client side (browser)
    async function loadWallet() {
      try {
        // Load WASM module from public folder
        // Use webpackIgnore to prevent webpack from trying to bundle it
        // @ts-ignore - webpack will ignore this import
        const wasmModule = await import(
          /* webpackIgnore: true */
          '/wallet-core/pkg/wallet_core.js'
        );
        
        // Initialize the WASM module (this loads the .wasm file)
        await wasmModule.default();
        
        // Store the wallet core module
        setWalletCore(wasmModule as WalletCore);
        
        // Check if wallet is already initialized in localStorage
        const walletInitialized = localStorage.getItem('walletInitialized');
        
        if (!walletInitialized) {
          // Initialize the wallet
          wasmModule.init_new_wallet();
          localStorage.setItem('walletInitialized', 'true');
        }
        
        setIsInitialized(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load wallet WASM:', error);
        setIsLoading(false);
      }
    }

    loadWallet();
  }, []);

  // Expose walletCore to parent via a custom event or context
  // For simplicity, we'll pass it via props callback
  // But for now, we'll handle everything in this component

  if (isLoading) {
    return <p>Loading wallet...</p>;
  }

  if (!isInitialized || !walletCore) {
    return <p>Error: Wallet not available</p>;
  }

  return <WalletUI walletCore={walletCore} />;
}

// Separate component for the wallet UI
function WalletUI({ walletCore }: { walletCore: WalletCore }) {
  const [seedPhrase, setSeedPhrase] = useState<string>('');
  const [showSeed, setShowSeed] = useState(false);
  const [seedBackedUp, setSeedBackedUp] = useState(false);
  const [showBackupMessage, setShowBackupMessage] = useState(false);

  // Check if seed is already backed up
  useEffect(() => {
    const backedUp = localStorage.getItem('seedBackedUp');
    if (backedUp === 'true') {
      setSeedBackedUp(true);
    }
  }, []);

  const handleShowSeed = () => {
    const phrase = walletCore.get_backup_phrase();
    setSeedPhrase(phrase);
    setShowSeed(true);
  };

  const handleSeedBackedUp = () => {
    localStorage.setItem('seedBackedUp', 'true');
    setSeedBackedUp(true);
    setShowBackupMessage(true);
    // Hide message after 3 seconds
    setTimeout(() => setShowBackupMessage(false), 3000);
  };

  return (
    <div>
      <p>Wallet is initialized</p>
      
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={handleShowSeed}>Show seed phrase</button>
        <button onClick={handleSeedBackedUp} disabled={seedBackedUp}>
          I have saved my seed
        </button>
      </div>

      {showSeed && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <p><strong>Seed Phrase:</strong></p>
          <p>{seedPhrase}</p>
        </div>
      )}

      {showBackupMessage && (
        <div style={{ marginTop: '10px', color: 'green' }}>
          Great! Seed marked as saved.
        </div>
      )}

      {seedBackedUp && !showBackupMessage && (
        <div style={{ marginTop: '10px', color: 'green' }}>
          ✓ Seed phrase has been backed up
        </div>
      )}
    </div>
  );
}

