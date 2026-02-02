'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { useTheme } from '@/components/theme/ThemeProvider';
import { truncateAddress } from '@/lib/formatting';

// Re-export for backward compatibility (used by ChatWindow)
export { truncateAddress };

// Type for a message
type Message = {
  id: string;
  txid: string;
  from_address: string | null;
  to_address: string;
  timestamp: number;
  text: string;
  type?: string; // Message type: "rotation" for rotation messages
  new_address?: string; // New address (for rotation messages)
};

// Type for a conversation (grouped by peer address)
type Conversation = {
  peerAddress: string;
  lastMessage: Message;
  messages: Message[];
};

// Props for the ChatSidebar component
type ChatSidebarProps = {
  conversations: Conversation[];
  selectedPeerAddress: string | null;
  onSelectConversation: (peerAddress: string) => void;
  onNewChat: () => void;
  currentUser: { id: number; username: string } | null;
  walletInitialized: boolean;
  currentUserAddress?: string;
  walletBalance?: string; // Balance in ZEC (e.g., "0.0007")
  onShowSeed: () => void;
  seedBackedUp: boolean;
  onSeedBackedUp: () => void;
  showSeed: boolean;
  seedPhrase: string;
  onRegenerateQuiet: () => void;
  onRegenerateAndNotify: () => void;
  walletActionStatus?: string;
  isComposingNewChat: boolean;
  onUpdate?: () => Promise<void>; // Callback to refresh messages and balance
  isUpdating?: boolean; // Whether update is in progress
  lastSyncStatus?: string; // Last sync status message (e.g., "Auto-synced to 3162331 at 18:45")
};

/**
 * ChatSidebar Component
 * 
 * Displays the list of chats on the left side of the screen.
 * Also includes account/wallet management in a card at the top.
 */
export default function ChatSidebar({
  conversations,
  selectedPeerAddress,
  onSelectConversation,
  onNewChat,
  currentUser,
  walletInitialized,
  currentUserAddress,
  walletBalance,
  onShowSeed,
  seedBackedUp,
  onSeedBackedUp,
  showSeed,
  seedPhrase,
  onRegenerateQuiet,
  onRegenerateAndNotify,
  walletActionStatus,
  isComposingNewChat,
  onUpdate,
  isUpdating,
  lastSyncStatus,
}: ChatSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const { theme } = useTheme();
  // Helper function to format timestamp for chat preview
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };


  // Handle copy address to clipboard
  const handleCopyAddress = async () => {
    if (!currentUserAddress) return;
    
    try {
      await navigator.clipboard.writeText(currentUserAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
      {/* Account Card */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Account</h2>
        
        {!currentUser ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Not logged in
          </div>
        ) : (
          <div className="space-y-3">
            {/* User info */}
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Username</div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentUser.username}</div>
            </div>

            {/* Wallet address and balance */}
            {currentUserAddress ? (
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700">
                {/* Balance display */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Balance</div>
                  <div className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
                    {walletBalance || '...'} ZEC
                  </div>
                </div>

                {/* Collapsed view - truncated address with expand button */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Address</div>
                  <button
                    onClick={() => setShowFullAddress(!showFullAddress)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {showFullAddress ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                {/* Truncated address with copy button */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 font-mono text-sm text-slate-900 dark:text-slate-100">
                    {truncateAddress(currentUserAddress)}
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="flex-shrink-0 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Update button */}
                {onUpdate && (
                  <button
                    onClick={onUpdate}
                    disabled={isUpdating}
                    className="w-full mt-3 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded transition-colors flex items-center justify-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <span className="animate-spin">⟳</span>
                        Syncing...
                      </>
                    ) : (
                      <>
                        ⟳ Update
                      </>
                    )}
                  </button>
                )}

                {/* Last sync status */}
                {lastSyncStatus && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                    {lastSyncStatus}
                  </div>
                )}

                {/* Expanded view - full address and QR code */}
                {showFullAddress && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    {/* Full address */}
                    <div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                      {currentUserAddress}
                    </div>

                    {/* QR Code */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg flex items-center justify-center">
                      <QRCode
                        value={currentUserAddress}
                        size={128}
                        level="M"
                        bgColor={theme === 'dark' ? '#0f172a' : '#f1f5f9'}
                        fgColor={theme === 'dark' ? '#e2e8f0' : '#0f172a'}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : walletInitialized ? (
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">Wallet not initialized</div>
              </div>
            ) : null}

            {/* Wallet status */}
            {walletInitialized ? (
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm space-y-2 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Wallet</span>
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                    Initialized
                  </span>
                </div>
                
                {/* Seed phrase controls */}
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={onShowSeed}
                    className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded transition-colors"
                  >
                    {showSeed ? 'Hide' : 'Show'} Seed Phrase
                  </button>
                  
                  {!seedBackedUp && (
                    <button
                      onClick={onSeedBackedUp}
                      className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 px-3 py-1.5 rounded transition-colors"
                    >
                      I have saved my seed
                    </button>
                  )}
                  
                  {seedBackedUp && (
                    <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <span>✓</span> Seed backed up
                    </div>
                  )}
                </div>

                {/* Seed phrase display */}
                {showSeed && seedPhrase && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs font-mono text-slate-800 dark:text-slate-200 break-words">
                    {seedPhrase}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">Wallet not initialized</div>
              </div>
            )}

            {/* Wallet settings */}
            {walletInitialized && (
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Wallet settings</div>
                
                {/* Regenerate quiet button */}
                <div className="space-y-1">
                  <button
                    onClick={onRegenerateQuiet}
                    className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 rounded transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    Regenerate wallet (quiet)
                  </button>
                  <div className="text-xs text-slate-500 dark:text-slate-400 px-1">
                    New wallet, no notifications
                  </div>
                </div>

                {/* Regenerate and notify button */}
                <div className="space-y-1">
                  <button
                    onClick={onRegenerateAndNotify}
                    className="w-full px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Regenerate & notify contacts
                  </button>
                  <div className="text-xs text-slate-500 dark:text-slate-400 px-1">
                    New wallet, notify all
                  </div>
                </div>

                {/* Status message */}
                {walletActionStatus && (
                  <div
                    className={`mt-2 p-2 rounded text-xs ${
                      walletActionStatus.startsWith('error:')
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {walletActionStatus}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Conversations List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No conversations yet. Start a new chat to begin messaging.
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.peerAddress}
                onClick={() => onSelectConversation(conversation.peerAddress)}
                className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  selectedPeerAddress === conversation.peerAddress 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-500' 
                    : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    {truncateAddress(conversation.peerAddress)}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                    {formatTime(conversation.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                  {conversation.lastMessage.text}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {conversation.messages.length} message{conversation.messages.length !== 1 ? 's' : ''}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* New Chat Button - Fixed at bottom */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <button
          onClick={onNewChat}
          className={`w-full text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors ${
            isComposingNewChat
              ? 'bg-blue-500 hover:bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-500'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          + New Chat
        </button>
        {conversations.length === 0 && !isComposingNewChat && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            No conversations yet. Click &quot;+ New Chat&quot; and paste a recipient address.
          </p>
        )}
      </div>
    </div>
  );
}

