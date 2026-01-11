'use client';

import { useState } from 'react';
import { getAuthToken } from '@/lib/api';

// Props for DeveloperTools component
type DeveloperToolsProps = {
  walletCore: any;
  walletInitialized: boolean;
  debugResult: string;
  debugError: string;
  onDebugNetwork: () => void;
  onDebugInitWallet: () => void;
  syncResult: string;
  balance: string;
  onSyncWallet: () => void;
  onGetBalance: () => void;
  onLoadMessages: () => void;
};

/**
 * DeveloperTools Component
 * 
 * A collapsible panel containing debug controls and wallet operations.
 * This is for development/testing purposes.
 */
export default function DeveloperTools({
  walletCore,
  walletInitialized,
  debugResult,
  debugError,
  onDebugNetwork,
  onDebugInitWallet,
  syncResult,
  balance,
  onSyncWallet,
  onGetBalance,
  onLoadMessages,
}: DeveloperToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<{
    chain: string;
    blocks: number;
    headers: number;
    verificationprogress: number;
    size_on_disk?: number;
  } | null>(null);
  const [rpcStatusError, setRpcStatusError] = useState<string>('');
  const [isRpcLoading, setIsRpcLoading] = useState(false);

  const handleShowRpcStatus = async () => {
    setRpcStatusError('');
    setRpcStatus(null);
    const token = getAuthToken();

    if (!token) {
      setRpcStatusError('Missing auth token. Please log in first.');
      return;
    }

    setIsRpcLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/zcash/network-info`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = payload?.error || response.statusText || 'Failed to fetch Zcash RPC status';
        throw new Error(errorMsg);
      }

      setRpcStatus(payload);
    } catch (error: any) {
      setRpcStatus(null);
      setRpcStatusError(error?.message || 'Failed to fetch Zcash RPC status');
    } finally {
      setIsRpcLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between transition-colors"
      >
        <span>Developer Tools</span>
        <span className="text-xs">{isOpen ? '▼' : '▲'}</span>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-950">
          {/* Debug Controls Section */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Debug Controls</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={handleShowRpcStatus}
                disabled={!walletCore || isRpcLoading}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                {isRpcLoading ? 'Loading Zcash RPC status…' : 'Debug: Show Zcash RPC (GetBlock.io) status'}
              </button>
              <button
                onClick={onDebugNetwork}
                disabled={!walletCore}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                Show network
              </button>
              <button
                onClick={onDebugInitWallet}
                disabled={!walletCore}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                Init wallet & show seed + address
              </button>
            </div>

            {rpcStatusError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap">
                <strong>Zcash RPC Error:</strong><br />
                {rpcStatusError}
              </div>
            )}

            {rpcStatus && (
              <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200 space-y-1">
                <div className="font-semibold text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                  Zcash RPC (GetBlock.io) status
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">Chain:</span>
                  {rpcStatus.chain}
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">Blocks:</span>
                  {rpcStatus.blocks?.toLocaleString()}
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">Headers:</span>
                  {rpcStatus.headers?.toLocaleString()}
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">Size on disk:</span>
                  {typeof rpcStatus.size_on_disk === 'number'
                    ? `${rpcStatus.size_on_disk.toLocaleString()} bytes`
                    : 'N/A'}
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">Verification Progress:</span>
                  {typeof rpcStatus.verificationprogress === 'number'
                    ? `${(rpcStatus.verificationprogress * 100).toFixed(2)}%`
                    : 'N/A'}
                </div>
              </div>
            )}

            {debugError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap">
                <strong>Error:</strong><br />
                {debugError}
              </div>
            )}

            {debugResult && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400 whitespace-pre-wrap font-mono">
                <strong>Result:</strong><br />
                {debugResult}
              </div>
            )}
          </div>

          {/* Wallet Operations Section */}
          {walletInitialized && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Wallet Operations</h3>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={onSyncWallet}
                  disabled={!walletCore}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                >
                  Sync wallet
                </button>
                <button
                  onClick={onGetBalance}
                  disabled={!walletCore}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                >
                  Get balance
                </button>
                <button
                  onClick={onLoadMessages}
                  disabled={!walletCore}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                >
                  Load messages
                </button>
              </div>

              {syncResult && (
                <div
                  className={`mt-3 p-3 rounded text-xs ${
                    syncResult.startsWith('error:')
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                  }`}
                >
                  <strong>Sync Result:</strong> {syncResult}
                </div>
              )}

              {balance && (
                <div
                  className={`mt-3 p-3 rounded text-xs font-mono ${
                    balance.startsWith('error:')
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                  }`}
                >
                  <strong>Balance:</strong> {balance}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

