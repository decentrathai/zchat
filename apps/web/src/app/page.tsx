'use client';

import { useEffect, useState } from 'react';
import { register, login, linkWalletAddress, broadcastTransaction, getAuthToken, getWalletAddress, getWalletBalance, syncWallet as apiSyncWallet, getMessages as apiGetMessages } from '@/lib/api';
import ChatSidebar from '@/components/ChatSidebar';
import ChatWindow from '@/components/ChatWindow';
import DeveloperTools from '@/components/DeveloperTools';
import { useTheme } from '@/components/theme/ThemeProvider';

// Type for the wallet core module
type WalletCore = {
  init_new_wallet: () => string;
  get_backup_phrase: () => string;
  send_message_dm: (to_address: string, text: string) => any; // Returns JsValue (JSON)
  get_primary_address: () => string;
  get_lightwalletd_url: () => string;
  get_network_name: () => string;
  sync_wallet: () => string;
  get_balance: () => string;
  list_messages: () => any; // Returns JsValue which becomes a JS array
  regenerate_wallet_quiet: () => any; // Returns JsValue (JSON)
  build_rotation_memo: (new_address: string) => string;
};

// Type for a message from the wallet
type Message = {
  id: string;
  txid: string;
  from_address?: string; // Sender's address (from ZMSGv2 memo or our address for outgoing)
  to_address: string;    // Recipient's address
  timestamp: number;
  text: string;
  type?: string; // Message type: "rotation" for rotation messages
  new_address?: string; // New address (for rotation messages)
  incoming?: boolean; // True if we received this message, false if we sent it
};

// Type for a conversation (grouped by peer address)
type Conversation = {
  peerAddress: string;
  lastMessage: Message;
  messages: Message[];
};

export default function Home() {
  // Theme
  const { theme, toggleTheme } = useTheme();

  // Authentication state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null);
  const [authMessage, setAuthMessage] = useState('');

  // Wallet state
  const [walletCore, setWalletCore] = useState<WalletCore | null>(null);
  const [walletInitialized, setWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [networkName, setNetworkName] = useState<string>('');
  const [currentUserAddress, setCurrentUserAddress] = useState<string>('');

  // Seed phrase state
  const [seedPhrase, setSeedPhrase] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [seedBackedUp, setSeedBackedUp] = useState(false);
  const [showBackupMessage, setShowBackupMessage] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPeerAddress, setSelectedPeerAddress] = useState<string | null>(null);
  const [isComposingNewChat, setIsComposingNewChat] = useState(false);
  // Map of old peer addresses to new addresses (for rotation messages)
  const [peerAddressMap, setPeerAddressMap] = useState<Map<string, string>>(new Map());

  // Debug state
  const [debugResult, setDebugResult] = useState<string>('');
  const [debugError, setDebugError] = useState<string>('');

  // Wallet operation state
  const [syncResult, setSyncResult] = useState<string>('');
  const [balance, setBalance] = useState<string>('');
  const [walletActionStatus, setWalletActionStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Load wallet WASM module on mount
  useEffect(() => {
    async function loadWallet() {
      try {
        // @ts-ignore - webpack will ignore this import
        const wasmModule = await import(
          /* webpackIgnore: true */
          '/wallet-core/pkg/wallet_core.js'
        );

        await wasmModule.default();
        setWalletCore(wasmModule as WalletCore);

        // Get network name
        try {
          const network = wasmModule.get_network_name();
          setNetworkName(network);
        } catch (e) {
          setNetworkName('unknown');
        }

        // Check if user is already logged in (has token)
        const token = getAuthToken();
        if (token) {
          // Try to restore session from backend
          try {
            const walletResponse = await getWalletAddress(token);
            setCurrentUserAddress(walletResponse.address);
            setWalletInitialized(true);

            // Load balance
            try {
              const balanceResult = await getWalletBalance(token);
              const balanceZatoshis = balanceResult.balance_zatoshis;
              const balanceZEC = (balanceZatoshis / 100_000_000).toFixed(4);
              setBalance(balanceZEC);
            } catch (balanceError) {
              console.error('Failed to get balance:', balanceError);
            }

            // Also load messages
            const messagesResult = await apiGetMessages(token);
            const transformedMessages: Message[] = messagesResult.messages.map((msg: any) => ({
              id: msg.txid,
              txid: msg.txid,
              // Use from_address from backend if available, otherwise infer from incoming flag
              from_address: msg.from_address || (msg.incoming ? undefined : walletResponse.address),
              // Use to_address from backend if available, otherwise infer from incoming flag
              to_address: msg.to_address || (msg.incoming ? walletResponse.address : ''),
              timestamp: msg.timestamp,
              text: msg.memo || '',
              type: msg.type,
              new_address: msg.new_address,
              incoming: msg.incoming, // Pass through incoming flag for display purposes
            }));
            setMessages(transformedMessages);
          } catch (e) {
            console.error('Failed to restore session from backend:', e);
            // Clear invalid token
            localStorage.removeItem('authToken');
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load wallet WASM:', error);
        setIsLoading(false);
      }
    }

    loadWallet();
  }, []);

  // Check if seed is backed up
  useEffect(() => {
    const backedUp = localStorage.getItem('seedBackedUp');
    if (backedUp === 'true') {
      setSeedBackedUp(true);
    }
  }, []);

  // Process rotation messages to update peer address mappings
  useEffect(() => {
    const newPeerAddressMap = new Map<string, string>(peerAddressMap);
    let hasChanges = false;

    messages.forEach((msg) => {
      if (msg.type === 'rotation' && msg.new_address && msg.from_address) {
        // This is a rotation message from a peer
        // Update the mapping: old address -> new address
        const oldAddress = msg.from_address;
        const newAddress = msg.new_address;
        if (newPeerAddressMap.get(oldAddress) !== newAddress) {
          newPeerAddressMap.set(oldAddress, newAddress);
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setPeerAddressMap(newPeerAddressMap);
    }
  }, [messages, peerAddressMap]);

  // Derive conversations from messages when messages or currentUserAddress changes
  useEffect(() => {
    if (!currentUserAddress || messages.length === 0) {
      setConversations([]);
      return;
    }

    // Helper function to get the current address for a peer (handles rotation)
    const getCurrentPeerAddress = (originalAddress: string): string => {
      return peerAddressMap.get(originalAddress) || originalAddress;
    };

    // Group messages by peer address (using original addresses for grouping)
    // A "peer" is the other party in the conversation:
    // - For outgoing messages (incoming=false): peer is the recipient (to_address)
    // - For incoming messages (incoming=true): peer is the sender (from_address)
    const conversationMap = new Map<string, Message[]>();

    messages.forEach((msg) => {
      // Determine the peer address (the other party in this message)
      let peerAddress: string;

      // Use the incoming flag if available (from backend)
      // Otherwise fall back to checking if to_address matches our address
      const isIncoming = msg.incoming !== undefined
        ? msg.incoming
        : (msg.to_address === currentUserAddress);

      if (isIncoming) {
        // Message was sent TO us, so peer is the sender
        // Use from_address if available (ZMSGv2 format), otherwise mark as unknown
        peerAddress = msg.from_address || 'unknown_sender';
      } else {
        // Message was sent FROM us, so peer is the recipient
        peerAddress = msg.to_address;
      }

      // Skip messages with empty peer address
      if (!peerAddress || peerAddress === '') {
        return;
      }

      // Add message to the conversation for this peer
      if (!conversationMap.has(peerAddress)) {
        conversationMap.set(peerAddress, []);
      }
      conversationMap.get(peerAddress)!.push(msg);
    });

    // Build conversations array with last message
    const conversationsArray: Conversation[] = Array.from(conversationMap.entries()).map(
      ([originalPeerAddress, peerMessages]) => {
        // Sort messages by timestamp (oldest first)
        const sortedMessages = [...peerMessages].sort((a, b) => a.timestamp - b.timestamp);

        // Get the last (most recent) message
        const lastMessage = sortedMessages[sortedMessages.length - 1];

        // Use current address (after rotation) for the conversation
        const currentPeerAddress = getCurrentPeerAddress(originalPeerAddress);

        return {
          peerAddress: currentPeerAddress, // Use current address for display/sending
          lastMessage,
          messages: sortedMessages,
        };
      }
    );

    // Sort conversations by last message timestamp (most recent first)
    conversationsArray.sort(
      (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
    );

    setConversations(conversationsArray);
  }, [messages, currentUserAddress, peerAddressMap]);

  // Authentication handlers
  const handleRegister = async () => {
    try {
      setAuthMessage('');

      // Register with backend
      const registerResponse = await register(username, password);

      // Initialize wallet
      if (walletCore) {
        walletCore.init_new_wallet();
        localStorage.setItem('walletInitialized', 'true');
        setWalletInitialized(true);

        // Get address
        try {
          const address = walletCore.get_primary_address();
          if (!address.startsWith('error:')) {
            setCurrentUserAddress(address);
          }
        } catch (e) {
          console.error('Failed to get address:', e);
        }
      }

      // Store auth token (login after registration)
      const loginResponse = await login(username, password);
      localStorage.setItem('authToken', loginResponse.token);

      // Link wallet address to account
      if (walletCore && currentUserAddress) {
        try {
          await linkWalletAddress(loginResponse.token, currentUserAddress);
          setAuthMessage('Wallet and account created. Wallet address linked to account.');
        } catch (error: any) {
          setAuthMessage(`Wallet and account created, but failed to link address: ${error.message}`);
        }
      } else {
        setAuthMessage('Wallet and account created');
      }

      setCurrentUser(loginResponse.user);
      setUsername('');
      setPassword('');
    } catch (error: any) {
      setAuthMessage(error.message || 'Registration failed');
    }
  };

  const handleLogin = async () => {
    try {
      setAuthMessage('');

      const loginResponse = await login(username, password);
      localStorage.setItem('authToken', loginResponse.token);

      // Fetch wallet address from backend API (not WASM)
      try {
        const walletResponse = await getWalletAddress(loginResponse.token);
        setCurrentUserAddress(walletResponse.address);
        setWalletInitialized(true);
        setAuthMessage(`Logged in as ${loginResponse.user.username}`);

        // Load balance
        try {
          const balanceResult = await getWalletBalance(loginResponse.token);
          const balanceZatoshis = balanceResult.balance_zatoshis;
          const balanceZEC = (balanceZatoshis / 100_000_000).toFixed(4);
          setBalance(balanceZEC);
        } catch (balanceError) {
          console.error('Failed to get balance on login:', balanceError);
        }

        // Load messages from backend (pass address since state update is async)
        await loadMessagesFromBackend(loginResponse.token, walletResponse.address);
      } catch (error: any) {
        setAuthMessage(`Logged in as ${loginResponse.user.username}, but failed to get wallet: ${error.message}`);
      }

      setCurrentUser(loginResponse.user);
      setUsername('');
      setPassword('');
    } catch (error: any) {
      setAuthMessage(error.message || 'Login failed');
    }
  };

  // Wallet handlers
  const handleShowSeed = () => {
    if (walletCore) {
      const phrase = walletCore.get_backup_phrase();
      setSeedPhrase(phrase);
      setShowSeed(true);
    }
  };

  const handleSeedBackedUp = () => {
    localStorage.setItem('seedBackedUp', 'true');
    setSeedBackedUp(true);
    setShowBackupMessage(true);
    setTimeout(() => setShowBackupMessage(false), 3000);
  };

  // Wallet regeneration handlers
  const handleRegenerateQuiet = async () => {
    // 1) Confirm with user
    if (!window.confirm('This will regenerate your wallet with a new seed and address. You will lose access to your old wallet. Continue?')) {
      return;
    }

    if (!walletCore) {
      setWalletActionStatus('error: Wallet not loaded');
      return;
    }

    try {
      setWalletActionStatus('Regenerating wallet...');

      // 2) Call walletCore.regenerate_wallet_quiet()
      const result = walletCore.regenerate_wallet_quiet();

      // 3) Parse JSON result
      let parsedResult: any;
      if (typeof result === 'string') {
        parsedResult = JSON.parse(result);
      } else {
        parsedResult = result;
      }

      // Check for error
      if (parsedResult.error) {
        setWalletActionStatus(`error: ${parsedResult.error}`);
        return;
      }

      // 4) Update currentUserAddress with new address
      const newAddress = parsedResult.address;
      setCurrentUserAddress(newAddress);

      // 5) Update localStorage
      localStorage.setItem('walletInitialized', 'true');
      // Clear old seed backup status since it's a new wallet
      localStorage.removeItem('seedBackedUp');

      // 6) Clear messages/conversations state
      setMessages([]);
      setConversations([]);
      setSelectedPeerAddress(null);

      // 7) Call linkWalletAddress to update backend
      const token = getAuthToken();
      if (token) {
        try {
          await linkWalletAddress(token, newAddress);
          setWalletActionStatus('Wallet regenerated successfully');
        } catch (error: any) {
          setWalletActionStatus(`Wallet regenerated, but failed to link address: ${error.message}`);
        }
      } else {
        setWalletActionStatus('Wallet regenerated (not logged in, address not linked)');
      }

      // Clear status after 5 seconds
      setTimeout(() => setWalletActionStatus(''), 5000);
    } catch (error: any) {
      setWalletActionStatus(`error: ${error.message || String(error)}`);
    }
  };

  const handleRegenerateAndNotify = async () => {
    // 1) Confirm with user
    if (!window.confirm('This will regenerate your wallet and notify all your contacts of your new address. Continue?')) {
      return;
    }

    if (!walletCore) {
      setWalletActionStatus('error: Wallet not loaded');
      return;
    }

    if (!currentUser) {
      setWalletActionStatus('error: Not logged in');
      return;
    }

    try {
      setWalletActionStatus('Regenerating wallet...');

      // 2) Regenerate wallet quietly
      const result = walletCore.regenerate_wallet_quiet();

      // Parse JSON result
      let parsedResult: any;
      if (typeof result === 'string') {
        parsedResult = JSON.parse(result);
      } else {
        parsedResult = result;
      }

      // Check for error
      if (parsedResult.error) {
        setWalletActionStatus(`error: ${parsedResult.error}`);
        return;
      }

      const newAddress = parsedResult.address;

      // 3) Send rotation messages to all peers
      const token = getAuthToken();
      if (!token) {
        setWalletActionStatus('error: Not authenticated');
        return;
      }

      setWalletActionStatus(`Sending rotation messages to ${conversations.length} contact(s)...`);

      let successCount = 0;
      let errorCount = 0;

      // Loop through conversations and send rotation message to each peer
      for (const conversation of conversations) {
        try {
          const peerAddress = conversation.peerAddress;
          const rotationMessage = `Address rotation: my new address is ${newAddress}`;

          // Build and sign the transaction
          const wasmResult = walletCore.send_message_dm(peerAddress, rotationMessage);

          // Parse the result
          let parsedWasmResult: any;
          if (typeof wasmResult === 'string') {
            parsedWasmResult = JSON.parse(wasmResult);
          } else {
            parsedWasmResult = wasmResult;
          }

          // Check for error from WASM
          if (parsedWasmResult.error) {
            console.error(`Failed to create rotation message for ${peerAddress}:`, parsedWasmResult.error);
            errorCount++;
            continue;
          }

          // Broadcast the transaction
          if (parsedWasmResult.txHex && parsedWasmResult.txid) {
            await broadcastTransaction(token, parsedWasmResult.txHex);
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error: any) {
          console.error(`Failed to send rotation message to ${conversation.peerAddress}:`, error);
          errorCount++;
        }
      }

      // 4) Finalize regeneration: update address and backend
      setCurrentUserAddress(newAddress);
      localStorage.setItem('walletInitialized', 'true');
      localStorage.removeItem('seedBackedUp');

      // Link new address to backend
      try {
        await linkWalletAddress(token, newAddress);
        setWalletActionStatus(`Rotation complete: ${successCount} sent, ${errorCount} failed`);
      } catch (error: any) {
        setWalletActionStatus(`Rotation messages sent (${successCount}/${conversations.length}), but failed to link address: ${error.message}`);
      }

      // Clear status after 8 seconds
      setTimeout(() => setWalletActionStatus(''), 8000);
    } catch (error: any) {
      setWalletActionStatus(`error: ${error.message || String(error)}`);
    }
  };

  // Chat handlers
  const handleSelectConversation = (peerAddress: string) => {
    setSelectedPeerAddress(peerAddress);
    setIsComposingNewChat(false);
  };

  const handleNewChat = () => {
    setSelectedPeerAddress(null);
    setIsComposingNewChat(true);
  };

  const handleNewChatCreated = (peerAddress: string) => {
    setSelectedPeerAddress(peerAddress);
    setIsComposingNewChat(false);
  };

  // Handler for when a message is sent (called from ChatWindow)
  const handleSendMessage = async (text: string, toAddress: string) => {
    // This is now handled entirely in ChatWindow component
    // We keep this for compatibility but it's not used
  };

  // Handler for adding a sent message to local state
  const handleMessageSent = (message: Message) => {
    // Add the message to the messages array
    setMessages((prev) => [...prev, message]);
    
    // Optionally reload messages from wallet after a delay to get the confirmed version
    setTimeout(() => {
      handleLoadMessages();
    }, 3000);
  };

  // Debug handlers
  const handleDebugLightwalletdUrl = () => {
    try {
      setDebugError('');
      if (!walletCore) {
        setDebugError('Wallet core not loaded');
        return;
      }
      const url = walletCore.get_lightwalletd_url();
      setDebugResult(`Lightwalletd URL: ${url}`);
    } catch (error: any) {
      setDebugError(`Error: ${error.message || String(error)}`);
      setDebugResult('');
    }
  };

  const handleDebugNetwork = () => {
    try {
      setDebugError('');
      if (!walletCore) {
        setDebugError('Wallet core not loaded');
        return;
      }
      const network = walletCore.get_network_name();
      setDebugResult(`Network: ${network}`);
    } catch (error: any) {
      setDebugError(`Error: ${error.message || String(error)}`);
      setDebugResult('');
    }
  };

  const handleDebugInitWallet = () => {
    try {
      setDebugError('');
      if (!walletCore) {
        setDebugError('Wallet core not loaded');
        return;
      }

      const initResult = walletCore.init_new_wallet();
      if (initResult.startsWith('error:')) {
        setDebugError(initResult);
        setDebugResult('');
        return;
      }

      const phrase = walletCore.get_backup_phrase();
      if (phrase.startsWith('error:')) {
        setDebugError(phrase);
        setDebugResult('');
        return;
      }

      const address = walletCore.get_primary_address();
      if (address.startsWith('error:')) {
        setDebugError(address);
        setDebugResult('');
        return;
      }

      setDebugResult(`Init Result: ${initResult}\n\nBackup Phrase: ${phrase}\n\nPrimary Address: ${address}`);
    } catch (error: any) {
      setDebugError(`Error: ${error.message || String(error)}`);
      setDebugResult('');
    }
  };

  // Helper function to load messages from backend API
  const loadMessagesFromBackend = async (token: string, userAddress?: string) => {
    try {
      const result = await apiGetMessages(token);
      const myAddress = userAddress || currentUserAddress;
      // Transform backend messages to frontend format
      const transformedMessages: Message[] = result.messages.map((msg: any) => ({
        id: msg.txid,
        txid: msg.txid,
        from_address: msg.incoming ? undefined : myAddress, // If incoming, sender is unknown (peer)
        to_address: msg.incoming ? myAddress : (msg.to_address || ''),
        timestamp: msg.timestamp,
        text: msg.memo || '',
        type: msg.type,
        new_address: msg.new_address,
      }));
      setMessages(transformedMessages);
      setSyncResult('');
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      setSyncResult(`error: ${error.message || String(error)}`);
    }
  };

  // Wallet operation handlers - using backend API
  const handleSyncWallet = async () => {
    const token = getAuthToken();
    if (!token) {
      setSyncResult('error: Not authenticated');
      return;
    }

    try {
      setSyncResult('Syncing...');
      const result = await apiSyncWallet(token);
      setSyncResult(`Synced to height ${result.synced_to_height}`);
      // Reload messages after sync
      await loadMessagesFromBackend(token);
    } catch (error: any) {
      setSyncResult(`error: ${error.message || String(error)}`);
    }
  };

  const handleGetBalance = async () => {
    const token = getAuthToken();
    if (!token) {
      setBalance('error: Not authenticated');
      return;
    }

    try {
      const result = await getWalletBalance(token);
      const balanceZatoshis = result.balance_zatoshis;
      const balanceZEC = balanceZatoshis / 100_000_000;
      setBalance(`${balanceZatoshis.toLocaleString()} zatoshis (${balanceZEC.toFixed(8)} ZEC)`);
    } catch (error: any) {
      setBalance(`error: ${error.message || String(error)}`);
    }
  };

  // Load messages from backend
  const handleLoadMessages = async () => {
    const token = getAuthToken();
    if (!token) {
      setMessages([]);
      setSyncResult('error: Not authenticated');
      return;
    }

    await loadMessagesFromBackend(token);
  };

  // Combined update handler - syncs wallet, updates balance, and reloads messages
  const handleUpdate = async () => {
    const token = getAuthToken();
    if (!token) {
      setSyncResult('error: Not authenticated');
      return;
    }

    setIsUpdating(true);
    try {
      // Step 1: Sync wallet to get latest blockchain data
      const syncResult = await apiSyncWallet(token);
      setSyncResult(`Synced to height ${syncResult.synced_to_height}`);

      // Step 2: Get updated balance
      const balanceResult = await getWalletBalance(token);
      const balanceZatoshis = balanceResult.balance_zatoshis;
      const balanceZEC = (balanceZatoshis / 100_000_000).toFixed(4);
      setBalance(balanceZEC);

      // Step 3: Reload messages
      await loadMessagesFromBackend(token, currentUserAddress);
    } catch (error: any) {
      setSyncResult(`error: ${error.message || String(error)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Load messages on mount if wallet is initialized (using backend API)
  useEffect(() => {
    if (walletInitialized && currentUserAddress) {
      const token = getAuthToken();
      if (token) {
        loadMessagesFromBackend(token);
      }
    }
  }, [walletInitialized, currentUserAddress]);

  // Auto-update interval (every 75 seconds - approximately one Zcash block)
  useEffect(() => {
    // Only run auto-update when user is logged in and wallet is initialized
    if (!currentUser || !walletInitialized || !currentUserAddress) {
      return;
    }

    const AUTO_UPDATE_INTERVAL = 75 * 1000; // 75 seconds in milliseconds

    const runAutoUpdate = async () => {
      const token = getAuthToken();
      if (!token) return;

      // Don't run if a manual update is in progress
      if (isUpdating) return;

      try {
        // Sync wallet silently (no UI state changes except on error)
        const syncResult = await apiSyncWallet(token);

        // Update balance
        const balanceResult = await getWalletBalance(token);
        const balanceZatoshis = balanceResult.balance_zatoshis;
        const balanceZEC = (balanceZatoshis / 100_000_000).toFixed(4);
        setBalance(balanceZEC);

        // Reload messages
        await loadMessagesFromBackend(token, currentUserAddress);

        // Update sync result with timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSyncResult(`Auto-synced to ${syncResult.synced_to_height} at ${timeStr}`);
      } catch (error: any) {
        console.error('Auto-update failed:', error);
        // Don't show error in UI for auto-updates to avoid spamming
      }
    };

    // Set up the interval
    const intervalId = setInterval(runAutoUpdate, AUTO_UPDATE_INTERVAL);

    // Cleanup on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser, walletInitialized, currentUserAddress, isUpdating]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="text-slate-400 dark:text-slate-500 text-xl mb-2">Loading...</div>
          <div className="text-slate-500 dark:text-slate-400 text-sm">Initializing wallet</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Zcash Chat</h1>
        <div className="flex items-center gap-4">
          {networkName && (
            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-full">
              Network: {networkName}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      {!currentUser ? (
        // Login/Register Screen
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 text-center">
              Welcome to Zcash Chat
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 text-center">
              Shielded messenger on Zcash
            </p>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRegister}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Register & Create Wallet
                </button>
                <button
                  onClick={handleLogin}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Log in
                </button>
              </div>
              {authMessage && (
                <div
                  className={`text-sm p-3 rounded-lg ${
                    authMessage.includes('failed') || authMessage.includes('error')
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  }`}
                >
                  {authMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Main Chat Interface
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar */}
          <div className="w-80 flex-shrink-0 h-full">
            <ChatSidebar
              conversations={conversations}
              selectedPeerAddress={selectedPeerAddress}
              onSelectConversation={handleSelectConversation}
              onNewChat={handleNewChat}
              currentUser={currentUser}
              walletInitialized={walletInitialized}
              currentUserAddress={currentUserAddress}
              walletBalance={balance}
              onShowSeed={handleShowSeed}
              seedBackedUp={seedBackedUp}
              onSeedBackedUp={handleSeedBackedUp}
              showSeed={showSeed}
              seedPhrase={seedPhrase}
              onRegenerateQuiet={handleRegenerateQuiet}
              onRegenerateAndNotify={handleRegenerateAndNotify}
              walletActionStatus={walletActionStatus}
              isComposingNewChat={isComposingNewChat}
              onUpdate={handleUpdate}
              isUpdating={isUpdating}
              lastSyncStatus={syncResult}
            />
          </div>

          {/* Right Chat Window */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            <ChatWindow
              selectedPeerAddress={selectedPeerAddress}
              conversations={conversations}
              currentUserAddress={currentUserAddress}
              walletCore={walletCore}
              onSendMessage={handleSendMessage}
              onMessageSent={handleMessageSent}
              isComposingNewChat={isComposingNewChat}
              onNewChatCreated={handleNewChatCreated}
            />
          </div>
        </div>
      )}

      {/* Developer Tools Panel (always visible at bottom) */}
      <DeveloperTools
        walletCore={walletCore}
        walletInitialized={walletInitialized}
        debugResult={debugResult}
        debugError={debugError}
        onDebugLightwalletdUrl={handleDebugLightwalletdUrl}
        onDebugNetwork={handleDebugNetwork}
        onDebugInitWallet={handleDebugInitWallet}
        syncResult={syncResult}
        balance={balance}
        onSyncWallet={handleSyncWallet}
        onGetBalance={handleGetBalance}
        onLoadMessages={handleLoadMessages}
      />
    </div>
  );
}
