'use client';

import { useState, useEffect, useRef } from 'react';
import { sendMessage as apiSendMessage, getAuthToken } from '@/lib/api';
import { truncateAddress } from '@/lib/formatting';

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
  incoming?: boolean; // True if we received this message, false if we sent it
};

// Type for a conversation
type Conversation = {
  peerAddress: string;
  lastMessage: Message;
  messages: Message[];
};

// Props for the ChatWindow component
type ChatWindowProps = {
  selectedPeerAddress: string | null;
  conversations: Conversation[];
  currentUserAddress?: string;
  walletCore: any; // WalletCore WASM module
  onSendMessage: (text: string, toAddress: string) => Promise<void>;
  onMessageSent?: (message: Message) => void; // Optional callback to add message to local state
  isComposingNewChat: boolean;
  onNewChatCreated?: (peerAddress: string) => void;
};

/**
 * ChatWindow Component
 * 
 * Displays the active chat conversation with messages and an input box.
 */
export default function ChatWindow({
  selectedPeerAddress,
  conversations,
  currentUserAddress,
  walletCore,
  onSendMessage,
  onMessageSent,
  isComposingNewChat,
  onNewChatCreated,
}: ChatWindowProps) {
  const [messageInput, setMessageInput] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toAddressRef = useRef<HTMLInputElement | null>(null);

  // Find the selected conversation
  const selectedConversation = selectedPeerAddress
    ? conversations.find((conv) => conv.peerAddress === selectedPeerAddress)
    : null;

  // Get messages for the selected conversation
  const chatMessages = selectedConversation ? selectedConversation.messages : [];

  // Determine if we are composing a brand-new chat (no peer selected yet)
  const isNewChat = isComposingNewChat || !selectedPeerAddress;

  // Reset the compose form whenever we begin a new chat
  useEffect(() => {
    if (isNewChat) {
      setRecipientAddress('');
      setMessageInput('');
      return;
    }

    if (selectedPeerAddress) {
      setRecipientAddress(selectedPeerAddress);
    }
  }, [selectedPeerAddress, isNewChat]);

  // Autofocus the "To" input whenever we enter compose mode
  useEffect(() => {
    if (isNewChat && toAddressRef.current) {
      toAddressRef.current.focus();
    }
  }, [isNewChat]);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Handle sending a message
  const handleSend = async () => {
    // Validate inputs
    if (!messageInput.trim()) {
      setSendStatus({ type: 'error', message: 'Please enter a message' });
      return;
    }

    // Determine recipient address
    let toAddress: string;
    if (!isNewChat && selectedPeerAddress) {
      // If we have a selected conversation, use the peer address
      toAddress = selectedPeerAddress;
    } else {
      // New chat - require recipient address input
      if (!recipientAddress.trim()) {
        setSendStatus({ type: 'error', message: 'Please enter a recipient address' });
        return;
      }
      toAddress = recipientAddress;
    }

    if (!toAddress || !toAddress.trim()) {
      setSendStatus({ type: 'error', message: 'Recipient address is required' });
      return;
    }

    // Get auth token from localStorage
    const token = getAuthToken();
    if (!token) {
      setSendStatus({ type: 'error', message: 'Not authenticated. Please log in again.' });
      return;
    }

    setIsSending(true);
    setSendStatus(null);

    try {
      // Use backend API to send message (builds tx, broadcasts, returns txid)
      // Amount is 10000 zatoshis (0.0001 ZEC) - minimum for message
      const result = await apiSendMessage(token, toAddress, 10000, messageInput.trim());

      // Success! Show success message
      setSendStatus({
        type: 'success',
        message: `Message sent! TXID: ${truncateAddress(result.txid)}`
      });

      // Optionally add message to local state (pending status)
      if (onMessageSent) {
        const pendingMessage: Message = {
          id: `pending-${Date.now()}`,
          txid: result.txid,
          from_address: currentUserAddress ?? null,
          to_address: toAddress,
          timestamp: Math.floor(Date.now() / 1000), // Current Unix timestamp
          text: messageInput.trim(),
          incoming: false, // We sent this message
        };
        onMessageSent(pendingMessage);
      }

      // Clear the input
      setMessageInput('');
      if (isNewChat && onNewChatCreated) {
        onNewChatCreated(toAddress);
      }

      // Clear status message after 5 seconds
      setTimeout(() => {
        setSendStatus(null);
      }, 5000);
    } catch (error: any) {
      // Error sending message
      setSendStatus({
        type: 'error',
        message: `Failed to send message: ${error.message || String(error)}`
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show empty state only if we have no active chat and no messages at all
  // Otherwise, show the chat interface with the form

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Chat Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        {isNewChat ? (
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100 mb-2">New Message</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Enter a shielded address and your first message below.
            </div>
          </div>
        ) : (
          <div>
            <div
              className="font-medium text-slate-900 dark:text-slate-100 cursor-help"
              title={selectedPeerAddress || ''}
            >
              {truncateAddress(selectedPeerAddress || '')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {chatMessages.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-8">
            {isNewChat
              ? 'Ready to start a new conversation. Your first message will appear here.'
              : 'No messages yet. Start the conversation!'}
          </div>
        ) : (
          chatMessages.map((msg) => {
            // Determine if message is from current user
            // Use the `incoming` flag if available (from backend)
            // If incoming=false, message is from us (we sent it)
            // If incoming=true, message is from the peer (we received it)
            const isFromMe = msg.incoming !== undefined
              ? !msg.incoming  // incoming=false means we sent it
              : (msg.from_address === currentUserAddress);  // Fallback: check from_address
            const isRotation = msg.type === 'rotation';
            
            return (
              <div
                key={msg.id}
                className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isFromMe
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {/* Rotation badge */}
                  {isRotation && (
                    <div className={`mb-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      isFromMe
                        ? 'bg-blue-500 text-blue-50'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      Address updated
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      isFromMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        {isNewChat && (
          <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            You’re starting a new conversation. Paste a recipient Unified Address to begin.
          </div>
        )}

        {/* Status Message */}
        {sendStatus && (
          <div
            className={`mb-3 p-3 rounded-lg text-sm ${
              sendStatus.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            }`}
          >
            {sendStatus.message}
          </div>
        )}

        {/* To Address Input (shown when composing a new chat) */}
        {isNewChat && (
          <div className="mb-3">
            <input
              type="text"
              placeholder="Recipient Zcash address (u1...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              ref={toAddressRef}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
        )}

        {/* Message Input and Send Button */}
        <div className="flex gap-2">
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={2}
            disabled={isSending}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={
              isSending || 
              !messageInput.trim() || 
              (isNewChat && !recipientAddress.trim())
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

