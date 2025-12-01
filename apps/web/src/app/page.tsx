'use client';

import { useEffect, useState } from 'react';
import { register, login, linkWalletAddress, broadcastTransaction, getAuthToken } from '@/lib/api';
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
  from_address?: string; // Optional in WASM response
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

        // Check if wallet is already initialized
        const initialized = localStorage.getItem('walletInitialized');
        if (initialized === 'true') {
          setWalletInitialized(true);
          // Get current user's address
          try {
            const address = wasmModule.get_primary_address();
            if (!address.startsWith('error:')) {
              setCurrentUserAddress(address);
            }
          } catch (e) {
            console.error('Failed to get primary address:', e);
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
    const conversationMap = new Map<string, Message[]>();

    messages.forEach((msg) => {
      // Determine the peer address (the other party)
      let peerAddress: string;
      
      if (msg.to_address === currentUserAddress) {
        // Message was sent TO us, so peer is the sender
        peerAddress = msg.from_address || 'unknown';
      } else {
        // Message was sent FROM us, so peer is the recipient
        peerAddress = msg.to_address;
      }

      // Use original peer address for grouping (before rotation)
      // This keeps all messages in the same conversation even after rotation
      const originalPeerAddress = peerAddress;

      // Add message to the conversation for this peer
      if (!conversationMap.has(originalPeerAddress)) {
        conversationMap.set(originalPeerAddress, []);
      }
      conversationMap.get(originalPeerAddress)!.push(msg);
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

      // Check if wallet is initialized and link address if available
      if (walletCore && walletInitialized) {
        try {
          const address = walletCore.get_primary_address();
          if (!address.startsWith('error:')) {
            setCurrentUserAddress(address);
            await linkWalletAddress(loginResponse.token, address);
            setAuthMessage(`Logged in as ${loginResponse.user.username}. Wallet address linked to account.`);
          }
        } catch (error: any) {
          setAuthMessage(`Logged in as ${loginResponse.user.username}, but failed to link address: ${error.message}`);
        }
      } else {
        setAuthMessage(`Logged in as ${loginResponse.user.username}`);
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

  // Wallet operation handlers
  const handleSyncWallet = () => {
    if (!walletCore) {
      setSyncResult('error: Wallet core not loaded');
      return;
    }

    try {
      const result = walletCore.sync_wallet();
      setSyncResult(result);
    } catch (error: any) {
      setSyncResult(`error: ${error.message || String(error)}`);
    }
  };

  const handleGetBalance = () => {
    if (!walletCore) {
      setBalance('error: Wallet core not loaded');
      return;
    }

    try {
      const balanceStr = walletCore.get_balance();

      if (balanceStr.startsWith('error:')) {
        setBalance(balanceStr);
        return;
      }

      const balanceZatoshis = parseInt(balanceStr, 10);
      const balanceZEC = balanceZatoshis / 100_000_000;

      setBalance(`${balanceZatoshis.toLocaleString()} zatoshis (${balanceZEC.toFixed(8)} ZEC)`);
    } catch (error: any) {
      setBalance(`error: ${error.message || String(error)}`);
    }
  };

  // Load messages from wallet
  const handleLoadMessages = () => {
    if (!walletCore) {
      setMessages([]);
      setSyncResult('error: Wallet core not loaded');
      return;
    }

    try {
      // Call WASM function to get messages
      const result = walletCore.list_messages();

      // Check if result is an error object
      if (result && typeof result === 'object' && !Array.isArray(result) && 'error' in result) {
        setMessages([]);
        setSyncResult(`error: ${(result as any).error}`);
        return;
      }

      // Parse the result (should be an array of messages)
      let messagesArray: Message[];
      if (Array.isArray(result)) {
        messagesArray = result as Message[];
      } else if (typeof result === 'string') {
        // Try to parse as JSON string
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          messagesArray = parsed as Message[];
        } else {
          setMessages([]);
          setSyncResult('error: Unexpected result format from list_messages');
          return;
        }
      } else {
        setMessages([]);
        setSyncResult('error: Unexpected result format from list_messages');
        return;
      }

      // Store messages in state (conversations will be derived automatically via useEffect)
      setMessages(messagesArray);
      setSyncResult('');
    } catch (error: any) {
      setMessages([]);
      setSyncResult(`error: ${error.message || String(error)}`);
    }
  };

  // Load messages on mount if wallet is initialized
  useEffect(() => {
    if (walletCore && walletInitialized && currentUserAddress) {
      // Load messages when wallet is ready
      try {
        const result = walletCore.list_messages();

        if (result && typeof result === 'object' && !Array.isArray(result) && 'error' in result) {
          console.error('Failed to load messages:', (result as any).error);
          return;
        }

        let messagesArray: Message[];
        if (Array.isArray(result)) {
          messagesArray = result as Message[];
        } else if (typeof result === 'string') {
          const parsed = JSON.parse(result);
          if (Array.isArray(parsed)) {
            messagesArray = parsed as Message[];
          } else {
            return;
          }
        } else {
          return;
        }

        setMessages(messagesArray);
      } catch (error) {
        console.error('Failed to load messages on mount:', error);
      }
    }
  }, [walletCore, walletInitialized, currentUserAddress]);

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
              onShowSeed={handleShowSeed}
              seedBackedUp={seedBackedUp}
              onSeedBackedUp={handleSeedBackedUp}
              showSeed={showSeed}
              seedPhrase={seedPhrase}
              onRegenerateQuiet={handleRegenerateQuiet}
              onRegenerateAndNotify={handleRegenerateAndNotify}
              walletActionStatus={walletActionStatus}
              isComposingNewChat={isComposingNewChat}
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
