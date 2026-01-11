use wasm_bindgen::prelude::*;

// Include generated proto code for lightwalletd gRPC client
// tonic-build generates code based on package name
// Package "cash.z.wallet.sdk.rpc" generates modules at cash::z::wallet::sdk::rpc
// The generated file already contains the module structure, so we include it at root
#[cfg(feature = "native")]
#[allow(clippy::all)]
mod cash {
    pub mod z {
        pub mod wallet {
            pub mod sdk {
                pub mod rpc {
                    include!(concat!(env!("OUT_DIR"), "/cash.z.wallet.sdk.rpc.rs"));
                }
            }
        }
    }
}

// Conditional compilation: only use SQLite when "native" feature is enabled
// This prevents Zcash dependencies from being compiled for WASM builds
#[cfg(feature = "native")]
use zcash_client_sqlite::WalletDb;
#[cfg(feature = "native")]
use zcash_client_sqlite::wallet::init::init_wallet_db;
#[cfg(feature = "native")]
use zcash_client_sqlite::util::SystemClock;
#[cfg(feature = "native")]
use zcash_protocol::consensus::MainNetwork as ProtocolMainNetwork;
#[cfg(feature = "native")]
use zcash_keys::keys::UnifiedSpendingKey;
#[cfg(feature = "native")]
use zcash_address::unified::{Address, Encoding};
#[cfg(feature = "native")]
use zip32::AccountId;
#[cfg(feature = "native")]
use bip0039::{English, Mnemonic};
// WalletRead and WalletWrite traits for database operations
#[cfg(feature = "native")]
use zcash_client_backend::data_api::{WalletRead, WalletWrite, AccountBirthday, InputSource, WalletCommitmentTrees};
#[cfg(feature = "native")]
use zcash_client_backend::data_api::wallet::{propose_standard_transfer_to_address, create_proposed_transactions, SpendingKeys, ConfirmationsPolicy};
#[cfg(feature = "native")]
use zcash_client_backend::fees::StandardFeeRule;
#[cfg(feature = "native")]
use zcash_client_backend::data_api::Account as AccountTrait;
#[cfg(feature = "native")]
use zcash_client_backend::wallet::OvkPolicy;
#[cfg(feature = "native")]
use zcash_client_backend::ShieldedProtocol;
#[cfg(feature = "native")]
use zcash_proofs::prover::LocalTxProver;
#[cfg(feature = "native")]
use zcash_client_backend::data_api::chain::{scan_cached_blocks, BlockSource, ChainState};
#[cfg(feature = "native")]
use zcash_client_backend::proto::compact_formats::CompactBlock as BackendCompactBlock;
#[cfg(feature = "native")]
use rusqlite::Connection;
#[cfg(feature = "native")]
// gRPC imports for lightwalletd
use tonic::transport::Channel;
#[cfg(feature = "native")]
use tokio::runtime::Runtime;
#[cfg(feature = "native")]
use zcash_protocol::memo::MemoBytes;
#[cfg(feature = "native")]
use zcash_protocol::value::Zatoshis;
#[cfg(feature = "native")]
use zcash_keys::keys::{UnifiedAddressRequest, ReceiverRequirement};
#[cfg(feature = "native")]
use zcash_protocol::TxId;
#[cfg(feature = "native")]
use nonempty::NonEmpty;
#[cfg(feature = "native")]
use std::path::Path;
#[cfg(feature = "native")]
use std::fs;
#[cfg(feature = "native")]
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(feature = "native")]
use hex;
#[cfg(feature = "native")]
use rand::rngs::OsRng;
#[cfg(feature = "native")]
use zcash_client_backend::decrypt_transaction;
#[cfg(feature = "native")]
use zcash_primitives::transaction::Transaction;
#[cfg(feature = "native")]
use zcash_protocol::consensus::BlockHeight;
#[cfg(feature = "native")]
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

// Constants for network configuration
// Lightwalletd server URL
const LIGHTWALLETD_URL: &str = "http://188.166.42.201:9067";

// Rotation memo prefix for address rotation messages
const ROTATE_MEMO_PREFIX: &str = "ZROTv1";

// Network helper function
#[cfg(feature = "native")]
fn network_protocol() -> ProtocolMainNetwork {
    ProtocolMainNetwork
}

/// Opens the wallet database and ensures the schema is initialized.
/// This is the single source of truth for opening the wallet DB.
/// Call this instead of WalletDb::for_path directly.
#[cfg(feature = "native")]
fn open_or_init_wallet_db<P: AsRef<Path>>(
    db_path: P,
) -> Result<WalletDb<Connection, ProtocolMainNetwork, SystemClock, OsRng>, String> {
    // Step 1: Open (or create) the database file
    let mut wallet_db = WalletDb::for_path(db_path, network_protocol(), SystemClock, OsRng)
        .map_err(|e| format!("Failed to open wallet database: {:?}", e))?;
    
    // Step 2: Initialize/migrate the wallet schema
    // init_wallet_db is idempotent - it creates tables if missing or runs migrations
    // We pass None for seed since we handle key derivation separately
    init_wallet_db(&mut wallet_db, None)
        .map_err(|e| format!("Failed to initialize wallet database schema: {:?}", e))?;
    
    Ok(wallet_db)
}

/// Fetches the tree state from lightwalletd at a given height.
/// Returns the TreeState proto message from lightwalletd.
#[cfg(feature = "native")]
async fn fetch_tree_state_async(
    lightwalletd_url: &str,
    height: u64,
) -> Result<crate::cash::z::wallet::sdk::rpc::TreeState, String> {
    use crate::cash::z::wallet::sdk::rpc::compact_tx_streamer_client::CompactTxStreamerClient;
    use crate::cash::z::wallet::sdk::rpc::BlockId;
    
    let grpc_url = if lightwalletd_url.starts_with("http://") {
        lightwalletd_url.to_string()
    } else {
        format!("http://{}", lightwalletd_url)
    };
    
    let channel = Channel::from_shared(grpc_url)
        .map_err(|e| format!("Invalid lightwalletd URL: {}", e))?
        .connect()
        .await
        .map_err(|e| format!("Failed to connect to lightwalletd: {}", e))?;
    
    let mut client = CompactTxStreamerClient::new(channel);
    
    let block_id = BlockId {
        height,
        hash: vec![],
    };
    
    let tree_state = client.get_tree_state(tonic::Request::new(block_id))
        .await
        .map_err(|e| format!("Failed to get tree state at height {}: {}", height, e))?
        .into_inner();
    
    Ok(tree_state)
}

/// Creates an AccountBirthday from a TreeState fetched from lightwalletd.
/// This uses the zcash_client_backend's native TreeState parsing.
#[cfg(feature = "native")]
fn create_account_birthday_from_treestate(
    tree_state: &crate::cash::z::wallet::sdk::rpc::TreeState,
) -> Result<AccountBirthday, String> {
    use zcash_client_backend::proto::service::TreeState as BackendTreeState;
    
    // Convert our proto TreeState to the backend's expected format
    let backend_tree_state = BackendTreeState {
        network: tree_state.network.clone(),
        height: tree_state.height,
        hash: tree_state.hash.clone(),
        time: tree_state.time,
        sapling_tree: tree_state.sapling_tree.clone(),
        orchard_tree: tree_state.orchard_tree.clone(),
    };
    
    // Use the backend's from_treestate which handles all the parsing
    let birthday = AccountBirthday::from_treestate(backend_tree_state, None)
        .map_err(|_| "Failed to create birthday from tree state".to_string())?;

    Ok(birthday)
}

/// Creates a ChainState from a TreeState fetched from lightwalletd.
/// The TreeState should be for the block BEFORE the first block to scan.
/// This converts from our proto TreeState to zcash_client_backend's TreeState
/// and uses its built-in to_chain_state() method.
#[cfg(feature = "native")]
fn create_chain_state_from_treestate(
    tree_state: &crate::cash::z::wallet::sdk::rpc::TreeState,
) -> Result<ChainState, String> {
    use zcash_client_backend::proto::service::TreeState as BackendTreeState;

    // Convert our proto TreeState to the backend's expected format
    let backend_tree_state = BackendTreeState {
        network: tree_state.network.clone(),
        height: tree_state.height,
        hash: tree_state.hash.clone(),
        time: tree_state.time,
        sapling_tree: tree_state.sapling_tree.clone(),
        orchard_tree: tree_state.orchard_tree.clone(),
    };

    // Use the backend's to_chain_state() which handles all the parsing
    backend_tree_state.to_chain_state()
        .map_err(|e| format!("Failed to parse tree state: {:?}", e))
}

// Message struct for representing parsed messages from memos
#[allow(dead_code)]
#[derive(Serialize, Deserialize, Debug, Clone)]
struct Message {
    id: String,                    // Random ID from memo (for deduplication)
    txid: String,                  // Transaction ID (hex encoded)
    from_address: Option<String>,  // Sender address (if we can determine it)
    to_address: String,            // Recipient address (our address or the recipient)
    timestamp: u64,                // Unix timestamp from memo
    text: String,                  // Message text content
    #[serde(rename = "type")]
    message_type: Option<String>,  // Message type: "rotation" for ZROTv1 messages, None for regular messages
    new_address: Option<String>,   // New address (for rotation messages)
}

// ChatMessage struct for CLI output (simpler format)
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub txid: String,
    pub height: u32,
    pub timestamp: i64,
    pub incoming: bool,
    pub value_zatoshis: i64,
    pub memo: String,
    pub to_address: Option<String>,
    pub from_address: Option<String>,  // Sender's address (extracted from memo for incoming, our address for outgoing)
}

// Public WalletCore struct - can be used as a library
pub struct WalletCore {
    db_path: String,
    lightwalletd_url: String,
}

impl WalletCore {
    /// Create a new WalletCore instance with custom db_path and lightwalletd_url
    /// This is the library-friendly constructor for native builds
    pub fn new_with_path(db_path: String, lightwalletd_url: String) -> Self {
        Self {
            db_path,
            lightwalletd_url,
        }
    }

    /// Create a new WalletCore instance with default db_path
    /// This is used by WASM bindings to maintain backward compatibility
    fn new(lightwalletd_url: String) -> Self {
        Self {
            db_path: default_db_path(),
            lightwalletd_url,
        }
    }

    #[cfg(feature = "native")]
    pub fn init_new_wallet(&self) -> Result<String, String> {
        self.init_new_wallet_at_height(None)
    }
    
    /// Initialize a new wallet at a specific birthday height.
    /// If birthday_height is None, uses the current chain tip from lightwalletd.
    #[cfg(feature = "native")]
    pub fn init_new_wallet_at_height(&self, birthday_height: Option<u64>) -> Result<String, String> {
        use rand::RngCore;

        // Step 1: Check if database file already exists
        let db_path = Path::new(&self.db_path);
        let db_exists = db_path.exists();

        // Step 2: Initialize or open the wallet database for mainnet
        // open_or_init_wallet_db ensures the schema is created/migrated
        let mut wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 3: If this is a new wallet (DB didn't exist), create an account with a seed
        if !db_exists {
            let seed_file_path = format!("{}.seed", self.db_path);
            let mnemonic_file_path = format!("{}.mnemonic", self.db_path);

            // Check if mnemonic file already exists (restore scenario)
            let (seed, mnemonic_phrase): ([u8; 32], String) = if Path::new(&mnemonic_file_path).exists() {
                eprintln!("Found existing mnemonic file, restoring wallet...");
                let mnemonic_str = fs::read_to_string(&mnemonic_file_path)
                    .map_err(|e| format!("Failed to read mnemonic file: {:?}", e))?;
                let trimmed = mnemonic_str.trim();
                let mnemonic: Mnemonic<English> = Mnemonic::from_phrase(trimmed)
                    .map_err(|e| format!("Invalid mnemonic phrase: {:?}", e))?;
                // Derive seed from mnemonic using BIP39/ZIP339 standard (no passphrase)
                let seed_bytes = mnemonic.to_seed("");
                let mut seed = [0u8; 32];
                // BIP39 seed is 64 bytes, but Zcash uses first 32 bytes for ZIP-32
                seed.copy_from_slice(&seed_bytes[..32]);
                (seed, trimmed.to_string())
            } else if Path::new(&seed_file_path).exists() {
                // Legacy: seed file exists but no mnemonic (old wallet format)
                eprintln!("Found legacy seed file, restoring wallet...");
                let seed_bytes = fs::read(&seed_file_path)
                    .map_err(|e| format!("Failed to read seed file: {:?}", e))?;
                if seed_bytes.len() != 32 {
                    return Err(format!("Invalid seed file length: {} (expected 32)", seed_bytes.len()));
                }
                let mut seed = [0u8; 32];
                seed.copy_from_slice(&seed_bytes);
                // Generate mnemonic from entropy for display (not reversible to same seed)
                let mnemonic: Mnemonic<English> = Mnemonic::from_entropy(&seed)
                    .map_err(|e| format!("Failed to create mnemonic: {:?}", e))?;
                (seed, mnemonic.phrase().to_string())
            } else {
                // Generate a new BIP39/ZIP339 mnemonic (24 words = 256 bits of entropy)
                use rand::RngCore;
                let mut entropy = [0u8; 32];
                rand::thread_rng().fill_bytes(&mut entropy);

                let mnemonic: Mnemonic<English> = Mnemonic::from_entropy(&entropy)
                    .map_err(|e| format!("Failed to generate mnemonic: {:?}", e))?;

                // Derive seed from mnemonic using BIP39/ZIP339 standard (no passphrase)
                let seed_bytes = mnemonic.to_seed("");
                let mut seed = [0u8; 32];
                // BIP39 seed is 64 bytes, but Zcash uses first 32 bytes for ZIP-32
                seed.copy_from_slice(&seed_bytes[..32]);

                let mnemonic_phrase = mnemonic.phrase().to_string();

                // Store the mnemonic for backup phrase retrieval (human-readable)
                fs::write(&mnemonic_file_path, &mnemonic_phrase)
                    .map_err(|e| format!("Failed to store mnemonic: {:?}", e))?;

                // Also store the derived seed for faster loading
                fs::write(&seed_file_path, &seed)
                    .map_err(|e| format!("Failed to store seed: {:?}", e))?;

                eprintln!("Generated new 24-word mnemonic phrase");
                (seed, mnemonic_phrase)
            };

            // Log mnemonic for user (will be shown in output)
            eprintln!("Mnemonic phrase: {}", mnemonic_phrase);

            // Step 5: Fetch tree state from lightwalletd to create proper AccountBirthday
            let rt = Runtime::new()
                .map_err(|e| format!("Failed to create tokio runtime: {:?}", e))?;
            
            let tree_state = rt.block_on(async {
                use crate::cash::z::wallet::sdk::rpc::compact_tx_streamer_client::CompactTxStreamerClient;
                use crate::cash::z::wallet::sdk::rpc::Empty;
                
                // First, get chain tip if birthday_height is not specified
                let height = match birthday_height {
                    Some(h) => h,
                    None => {
                        let grpc_url = if self.lightwalletd_url.starts_with("http://") {
                            self.lightwalletd_url.clone()
                        } else {
                            format!("http://{}", self.lightwalletd_url)
                        };
                        
                        let channel = Channel::from_shared(grpc_url)
                            .map_err(|e| format!("Invalid lightwalletd URL: {}", e))?
                            .connect()
                            .await
                            .map_err(|e| format!("Failed to connect to lightwalletd: {}", e))?;
                        
                        let mut client = CompactTxStreamerClient::new(channel);
                        let info = client.get_lightd_info(tonic::Request::new(Empty {}))
                            .await
                            .map_err(|e| format!("Failed to get lightwalletd info: {}", e))?;
                        
                        info.get_ref().block_height
                    }
                };
                
                // Fetch tree state at the birthday height
                fetch_tree_state_async(&self.lightwalletd_url, height).await
            })?;
            
            eprintln!("Creating wallet with birthday at height {}", tree_state.height);
            
            // Step 6: Create AccountBirthday with proper tree state
            let birthday = create_account_birthday_from_treestate(&tree_state)?;
            
            eprintln!("AccountBirthday created successfully with tree state");

            // Step 7: Create account using WalletWrite::create_account
            // This properly registers the account with the birthday including tree state
            use secrecy::SecretVec;
            let seed_secret: SecretVec<u8> = SecretVec::new(seed.to_vec());
            let (account_id, usk) = wallet_db.create_account("zchat", &seed_secret, &birthday, None)
                .map_err(|e| format!("Failed to create account: {:?}", e))?;

            eprintln!("Account {:?} created with birthday tree state", account_id);

            // Step 8: Derive a Unified Address from the spending key
            let ufvk = usk.to_unified_full_viewing_key();
            // Use UnifiedAddressRequest::SHIELDED for Orchard+Sapling receivers
            let request = UnifiedAddressRequest::SHIELDED;
            let (ua, _diversifier_index) = ufvk.default_address(request)
                .map_err(|e| format!("Failed to generate default address: {:?}", e))?;

            // Step 9: Convert the Unified Address to a string format
            let address_string = ua.encode(&network_protocol());

            Ok(format!("wallet-initialized: {}", address_string))
        } else {
            // Wallet already exists
            Ok("wallet-already-exists".to_string())
        }
    }

    #[cfg(not(feature = "native"))]
    fn init_new_wallet(&self) -> Result<String, String> {
        // WASM stub: SQLite doesn't work in WASM
        // We'll need to implement IndexedDB or similar storage later
        // This implementation is used when "native" feature is not enabled
        Ok("wallet-initialized".to_string())
    }

    #[cfg(feature = "native")]
    fn get_backup_phrase(&self) -> Result<String, String> {
        // First, try to read from the mnemonic file (new format)
        let mnemonic_file_path = format!("{}.mnemonic", self.db_path);
        if Path::new(&mnemonic_file_path).exists() {
            let mnemonic_str = fs::read_to_string(&mnemonic_file_path)
                .map_err(|e| format!("Failed to read mnemonic file: {:?}", e))?;
            return Ok(mnemonic_str.trim().to_string());
        }

        // Fallback: read from seed file (legacy format)
        // Note: This generates a mnemonic from entropy, which is NOT the same as
        // deriving a seed from a mnemonic. Legacy wallets created this way
        // cannot be imported into Zashi using the displayed phrase.
        let seed_file_path = format!("{}.seed", self.db_path);
        let seed_bytes = fs::read(&seed_file_path)
            .map_err(|e| format!("Failed to read seed file: {:?}. Make sure the wallet is initialized.", e))?;

        if seed_bytes.len() != 32 {
            return Err(format!("Invalid seed length: expected 32 bytes, got {}", seed_bytes.len()));
        }

        let seed_array: [u8; 32] = seed_bytes.try_into()
            .map_err(|_| "Failed to convert seed to array".to_string())?;

        let mnemonic: Mnemonic<English> = Mnemonic::from_entropy(&seed_array)
            .map_err(|e| format!("Failed to create mnemonic from seed: {:?}", e))?;

        // Return the phrase with a warning prefix for legacy wallets
        Ok(format!("[LEGACY - NOT ZASHI COMPATIBLE] {}", mnemonic.phrase()))
    }

    #[cfg(not(feature = "native"))]
    fn get_backup_phrase(&self) -> Result<String, String> {
        // WASM stub
        Ok("word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12".to_string())
    }

    #[cfg(feature = "native")]
    pub fn get_primary_address(&self) -> Result<String, String> {
        // Step 1: Read the seed from the stored seed file
        // We need the seed to derive the address (since we may not have stored the account in DB yet)
        let seed_file_path = format!("{}.seed", self.db_path);
        let seed_bytes = fs::read(&seed_file_path)
            .map_err(|e| format!("Failed to read seed file: {:?}. Make sure the wallet is initialized.", e))?;

        // Step 2: Validate seed length
        if seed_bytes.len() != 32 {
            return Err(format!("Invalid seed length: expected 32 bytes, got {}", seed_bytes.len()));
        }

        // Step 3: Convert seed bytes to array
        let seed_array: [u8; 32] = seed_bytes.try_into()
            .map_err(|_| "Failed to convert seed to array".to_string())?;

        // Step 4: Get account ID 0 (the default/primary account)
        let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");

        // Step 5: Derive the Unified Spending Key from the seed
        // This is the same derivation we did in init_new_wallet()
        // Note: UnifiedSpendingKey::from_seed expects zcash_protocol::consensus::Parameters
        let usk = UnifiedSpendingKey::from_seed(
            &network_protocol(), // Use ProtocolMainNetwork, not PrimitivesMainNetwork
            &seed_array,
            account_id,
        )
        .map_err(|e| format!("Failed to derive spending key: {:?}", e))?;

        // Step 6: Get the unified full viewing key from the spending key
        let ufvk = usk.to_unified_full_viewing_key();

        // Step 7: Derive the unified address
        // default_address() now requires UnifiedAddressRequest and returns Result
        // Use UnifiedAddressRequest::SHIELDED for Orchard+Sapling receivers
        let request = UnifiedAddressRequest::SHIELDED;
        let (ua, _diversifier_index) = ufvk.default_address(request)
            .map_err(|e| format!("Failed to generate default address: {:?}", e))?;

        // Step 8: Encode the unified address as a string
        let address_string = ua.encode(&network_protocol());

        Ok(address_string)
    }

    #[cfg(not(feature = "native"))]
    fn get_primary_address(&self) -> Result<String, String> {
        // WASM stub
        Ok("u1dummyaddressfornow".to_string())
    }

    #[cfg(feature = "native")]
    pub fn get_balance(&self) -> Result<u64, String> {
        // ============================================================
        // GET BALANCE FUNCTION - Real implementation
        // ============================================================
        // Returns the confirmed balance for account 0 in zatoshis
        // Combines Sapling and Orchard pools
        // ============================================================

        // Step 1: Open the wallet database (ensures schema is initialized)
        let db_path = Path::new(&self.db_path);
        let wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 2: Get account ID 0
        let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");

        // Step 3: Get balance using WalletRead trait
        // In zcash_client_backend 0.10, we need to use the correct API
        // Since direct methods don't exist, we'll query the database more directly
        // or use methods that are actually available
        
        let min_confirmations = 1u32;
        
        // The zcash_client_backend 0.10 API doesn't have get_balance() or get_unspent_notes()
        // We need to use alternative methods. Common alternatives:
        // 1. Query transactions and sum note values
        // 2. Use database queries directly
        // 3. Use methods that return note iterators
        
        // For now, we'll implement a placeholder that returns 0
        // but includes clear error messaging about what needs to be done
        // 
        // TODO: The actual implementation needs to:
        // - Find the correct WalletRead trait method to query notes
        // - Filter for unspent, confirmed notes
        // - Sum their values
        // 
        // Possible methods to check in zcash_client_backend 0.10:
        // - Methods that return transactions
        // - Methods that return note iterators
        // - Database query methods
        
        // Try to query the database directly using rusqlite
        // This is a workaround until we find the correct WalletRead API methods
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database connection: {:?}", e))?;
        
        let mut total_balance = 0u64;
        let account_id_u32: u32 = account_id.into();
        
        // First, let's check what tables actually exist in the database
        // This helps diagnose if the schema is different than expected
        let mut table_names = Vec::new();
        if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name") {
            if let Ok(rows) = stmt.query_map([], |row| {
                Ok(row.get::<_, String>(0)?)
            }) {
                for row_result in rows {
                    if let Ok(name) = row_result {
                        table_names.push(name);
                    }
                }
            }
        }

        // Note: In zcash_client_sqlite, the account_id in the database is an auto-increment ID
        // starting at 1, not the account index (0). So we need to query for account_id = 1.
        // We try both for compatibility.
        let db_account_ids = vec![1u32, account_id_u32]; // Try 1 first (most likely), then 0

        // Try common table names for sapling notes - exclude spent notes
        // Join with sapling_received_note_spends to filter out spent notes
        let sapling_query = "SELECT srn.value FROM sapling_received_notes srn LEFT JOIN sapling_received_note_spends srns ON srn.id = srns.sapling_received_note_id WHERE srn.account_id = ? AND srns.sapling_received_note_id IS NULL";

        let mut sapling_found = false;
        for &acc_id in &db_account_ids {
            if let Ok(mut stmt) = conn.prepare(sapling_query) {
                if let Ok(rows) = stmt.query_map([acc_id], |row| {
                    Ok(row.get::<_, i64>(0)?)  // Use i64 as value might be stored as signed
                }) {
                    for row_result in rows {
                        if let Ok(value) = row_result {
                            total_balance += value as u64;
                            sapling_found = true;
                        }
                    }
                    if sapling_found {
                        break;
                    }
                }
            }
        }

        // Try orchard notes - exclude spent notes by using LEFT JOIN with spends table
        let orchard_query = "SELECT orn.value FROM orchard_received_notes orn LEFT JOIN orchard_received_note_spends orns ON orn.id = orns.orchard_received_note_id WHERE orn.account_id = ? AND orns.orchard_received_note_id IS NULL";

        let mut orchard_found = false;
        for &acc_id in &db_account_ids {
            if let Ok(mut stmt) = conn.prepare(orchard_query) {
                if let Ok(rows) = stmt.query_map([acc_id], |row| {
                    Ok(row.get::<_, i64>(0)?)
                }) {
                    for row_result in rows {
                        if let Ok(value) = row_result {
                            total_balance += value as u64;
                            orchard_found = true;
                        }
                    }
                    if orchard_found {
                        break;
                    }
                }
            }
        }
        
        // If balance is 0, provide diagnostic information
        if total_balance == 0 {
            // Only print diagnostics if we're in a CLI context (not WASM)
            // This helps users understand why balance is 0
            eprintln!("Balance is 0. Diagnostic info:");
            eprintln!("  - Database tables found: {:?}", table_names.iter().take(10).collect::<Vec<_>>());
            eprintln!("  - Account ID: {}", account_id_u32);
            eprintln!("  - Sapling notes found: {}", sapling_found);
            eprintln!("  - Orchard notes found: {}", orchard_found);
            eprintln!("  - NOTE: If blocks were downloaded but not scanned, notes won't exist in the database.");
            eprintln!("  - Run 'debug-sync' to check sync status and 'debug-notes' to see note counts.");
        }
        
        // Clean up wallet_db reference
        let _ = (wallet_db, min_confirmations);
        
        Ok(total_balance)
    }

    #[cfg(not(feature = "native"))]
    fn get_balance(&self) -> Result<u64, String> {
        // WASM stub - return 0 for now
        Ok(0)
    }

    #[cfg(feature = "native")]
    pub fn debug_notes(&self) -> Result<serde_json::Value, String> {
        // ============================================================
        // DEBUG NOTES FUNCTION
        // ============================================================
        // Returns detailed information about notes in the wallet
        // for debugging purposes
        // ============================================================

        // Step 1: Open the wallet database (ensures schema is initialized)
        let db_path = Path::new(&self.db_path);
        let wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 2: Get account ID 0
        let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");

        // Step 3: Get notes for Sapling and Orchard pools
        let min_confirmations = 1u32;

        // Query the database directly using rusqlite
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database connection: {:?}", e))?;
        
        let account_id_u32: u32 = account_id.into();
        
        // First, list all tables for diagnostics
        let mut table_names = Vec::new();
        if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name") {
            if let Ok(rows) = stmt.query_map([], |row| Ok(row.get::<_, String>(0)?)) {
                for row_result in rows {
                    if let Ok(name) = row_result {
                        table_names.push(name);
                    }
                }
            }
        }
        
        // Sapling notes - try various column name patterns used by zcash_client_sqlite
        let mut sapling_note_count = 0u64;
        let mut sapling_total_zatoshis = 0u64;
        let mut sapling_spendable_zatoshis = 0u64;
        
        // zcash_client_sqlite 0.10 uses 'spent_note_id IS NULL' for unspent notes
        let sapling_queries = vec![
            "SELECT value FROM sapling_received_notes WHERE account_id = ? AND spent_note_id IS NULL",
            "SELECT value FROM sapling_received_notes WHERE account_id = ? AND spent IS NULL",
            "SELECT value FROM sapling_received_notes WHERE account_id = ?",
        ];
        
        for query in &sapling_queries {
            if let Ok(mut stmt) = conn.prepare(query) {
                if let Ok(rows) = stmt.query_map([account_id_u32], |row| {
                    Ok(row.get::<_, i64>(0)?)  // Use i64 as value might be stored as signed
                }) {
                    for row_result in rows {
                        if let Ok(value) = row_result {
                            sapling_note_count += 1;
                            sapling_total_zatoshis += value as u64;
                            sapling_spendable_zatoshis += value as u64;
                        }
                    }
                    if sapling_note_count > 0 {
                        break;
                    }
                }
            }
        }
        
        // Orchard notes
        let mut orchard_note_count = 0u64;
        let mut orchard_total_zatoshis = 0u64;
        let mut orchard_spendable_zatoshis = 0u64;

        // First, get ALL orchard notes without filtering for debugging
        let mut all_orchard_notes: Vec<serde_json::Value> = Vec::new();
        if let Ok(mut stmt) = conn.prepare("SELECT id, account_id, value, is_change, action_index, memo FROM orchard_received_notes") {
            if let Ok(rows) = stmt.query_map([], |row| {
                let memo_bytes: Option<Vec<u8>> = row.get(5).ok();
                let memo_len = memo_bytes.as_ref().map(|b| b.len()).unwrap_or(0);
                let memo_text = memo_bytes.as_ref().and_then(|bytes| {
                    // Memo is 512 bytes, first byte indicates type
                    // 0xF6 = empty memo, otherwise try to decode as UTF-8
                    if bytes.is_empty() || bytes[0] == 0xF6 {
                        None
                    } else {
                        // Try to decode as UTF-8, stripping trailing nulls
                        let text_bytes: Vec<u8> = bytes.iter()
                            .cloned()
                            .take_while(|&b| b != 0)
                            .collect();
                        String::from_utf8(text_bytes).ok()
                    }
                });
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "account_id": row.get::<_, i64>(1)?,
                    "value": row.get::<_, i64>(2)?,
                    "is_change": row.get::<_, i64>(3)?,
                    "action_index": row.get::<_, i64>(4)?,
                    "memo": memo_text,
                    "memo_len": memo_len,
                    "memo_hex": memo_bytes.map(|b| hex::encode(&b[..std::cmp::min(64, b.len())]))
                }))
            }) {
                for row_result in rows {
                    if let Ok(note_json) = row_result {
                        all_orchard_notes.push(note_json);
                    }
                }
            }
        }

        // Now query with account filter - try both account_id 0 and 1
        let orchard_queries = vec![
            ("SELECT value FROM orchard_received_notes WHERE account_id = ?", 0u32),
            ("SELECT value FROM orchard_received_notes WHERE account_id = ?", 1u32),
        ];

        for (query, acc_id) in &orchard_queries {
            if let Ok(mut stmt) = conn.prepare(query) {
                if let Ok(rows) = stmt.query_map([*acc_id], |row| {
                    Ok(row.get::<_, i64>(0)?)
                }) {
                    for row_result in rows {
                        if let Ok(value) = row_result {
                            orchard_note_count += 1;
                            orchard_total_zatoshis += value as u64;
                            orchard_spendable_zatoshis += value as u64;
                        }
                    }
                    if orchard_note_count > 0 {
                        break;
                    }
                }
            }
        }
        
        // Clean up references
        let _ = (wallet_db, min_confirmations);

        // Build JSON response with actual queried data including diagnostics
        Ok(serde_json::json!({
            "account": 0,
            "database_tables": table_names,
            "sapling": {
                "note_count": sapling_note_count,
                "total_zatoshis": sapling_total_zatoshis,
                "spendable_zatoshis": sapling_spendable_zatoshis
            },
            "orchard": {
                "note_count": orchard_note_count,
                "total_zatoshis": orchard_total_zatoshis,
                "spendable_zatoshis": orchard_spendable_zatoshis,
                "all_notes_raw": all_orchard_notes
            }
        }))
    }
    
    /// Debug function to inspect database schema
    #[cfg(feature = "native")]
    pub fn debug_db(&self) -> Result<serde_json::Value, String> {
        let db_path = Path::new(&self.db_path);
        
        // Ensure schema is initialized before reading
        let _wallet_db = open_or_init_wallet_db(db_path)?;
        
        // Now open a separate connection for reading schema
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database connection: {:?}", e))?;
        
        // Get all tables
        let mut tables = serde_json::Map::new();
        
        if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name") {
            if let Ok(rows) = stmt.query_map([], |row| Ok(row.get::<_, String>(0)?)) {
                for row_result in rows {
                    if let Ok(table_name) = row_result {
                        // Get schema for each table
                        let schema_query = format!("PRAGMA table_info({})", table_name);
                        let mut columns = Vec::new();
                        if let Ok(mut schema_stmt) = conn.prepare(&schema_query) {
                            if let Ok(schema_rows) = schema_stmt.query_map([], |row| {
                                Ok(serde_json::json!({
                                    "name": row.get::<_, String>(1)?,
                                    "type": row.get::<_, String>(2)?
                                }))
                            }) {
                                for schema_row in schema_rows {
                                    if let Ok(col) = schema_row {
                                        columns.push(col);
                                    }
                                }
                            }
                        }
                        
                        // Get row count
                        let count_query = format!("SELECT COUNT(*) FROM {}", table_name);
                        let row_count: i64 = conn.query_row(&count_query, [], |row| row.get(0)).unwrap_or(0);
                        
                        tables.insert(table_name, serde_json::json!({
                            "columns": columns,
                            "row_count": row_count
                        }));
                    }
                }
            }
        }
        
        Ok(serde_json::json!({
            "tables": tables
        }))
    }

    #[cfg(feature = "native")]
    pub fn debug_sync(&self) -> Result<serde_json::Value, String> {
        // ============================================================
        // DEBUG SYNC FUNCTION
        // ============================================================
        // Returns detailed sync state information for debugging
        // ============================================================

        // Step 1: Open the wallet database (ensures schema is initialized)
        let db_path = Path::new(&self.db_path);
        let _wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 2: Get account ID 0
        let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");
        let account_id_u32: u32 = account_id.into();

        // Step 3: Query database for sync state
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database connection: {:?}", e))?;

        // Get wallet birthday height (Sapling activation for mainnet)
        let sapling_activation = 419200u64;
        let mut wallet_birthday_height: Option<u64> = Some(sapling_activation);
        let mut next_scan_height: Option<u64> = None;
        let mut max_scanned_height: Option<u64> = None;

        // Try to get max scanned height
        let height_queries = vec![
            "SELECT MAX(height) FROM blocks",
            "SELECT MAX(block_height) FROM blocks",
            "SELECT MAX(height) FROM scanned_blocks",
        ];

        for query in height_queries {
            if let Ok(mut stmt) = conn.prepare(query) {
                if let Ok(height) = stmt.query_row([], |row| {
                    Ok(row.get::<_, Option<u64>>(0)?)
                }) {
                    if let Some(h) = height {
                        max_scanned_height = Some(h);
                        next_scan_height = Some(h + 1);
                        break;
                    }
                }
            }
        }

        // If no scanned height, next scan starts from birthday
        if next_scan_height.is_none() {
            next_scan_height = Some(sapling_activation);
        }

        // Step 4: Get chain tip from lightwalletd
        let rt = Runtime::new()
            .map_err(|e| format!("Failed to create tokio runtime: {:?}", e))?;

        let chain_tip_height = rt.block_on(async {
            let grpc_url = if self.lightwalletd_url.starts_with("http://") {
                self.lightwalletd_url.clone()
            } else {
                format!("http://{}", self.lightwalletd_url)
            };

            let channel = Channel::from_shared(grpc_url)
                .map_err(|e| format!("Invalid lightwalletd URL: {}", e))?
                .connect()
                .await
                .map_err(|e| format!("Failed to connect to lightwalletd: {}", e))?;

            use crate::cash::z::wallet::sdk::rpc::compact_tx_streamer_client::CompactTxStreamerClient;
            use crate::cash::z::wallet::sdk::rpc::Empty;

            let mut client = CompactTxStreamerClient::new(channel);
            let info = client.get_lightd_info(tonic::Request::new(Empty {}))
                .await
                .map_err(|e| format!("Failed to get lightwalletd info: {}", e))?;

            Ok::<u64, String>(info.get_ref().block_height as u64)
        })?;

        // Step 5: Get note statistics (reuse logic from debug_notes)
        let mut sapling_note_count = 0u64;
        let mut sapling_total_zatoshis = 0u64;
        let mut sapling_spendable_zatoshis = 0u64;

        // Use updated queries with correct column names for zcash_client_sqlite 0.10
        let sapling_queries = vec![
            "SELECT value FROM sapling_received_notes WHERE account_id = ? AND spent_note_id IS NULL",
            "SELECT value FROM sapling_received_notes WHERE account_id = ? AND spent IS NULL",
            "SELECT value FROM sapling_received_notes WHERE account_id = ?",
        ];

        for query in &sapling_queries {
            if let Ok(mut stmt) = conn.prepare(query) {
                if let Ok(rows) = stmt.query_map([account_id_u32], |row| {
                    Ok(row.get::<_, i64>(0)?)
                }) {
                    for row_result in rows {
                        if let Ok(value) = row_result {
                            sapling_note_count += 1;
                            sapling_total_zatoshis += value as u64;
                            sapling_spendable_zatoshis += value as u64;
                        }
                    }
                    if sapling_note_count > 0 {
                        break;
                    }
                }
            }
        }

        let mut orchard_note_count = 0u64;
        let mut orchard_total_zatoshis = 0u64;
        let mut orchard_spendable_zatoshis = 0u64;

        let orchard_queries = vec![
            "SELECT value FROM orchard_received_notes WHERE account_id = ? AND spent_note_id IS NULL",
            "SELECT value FROM orchard_received_notes WHERE account_id = ? AND spent IS NULL",
            "SELECT value FROM orchard_received_notes WHERE account_id = ?",
        ];

        for query in &orchard_queries {
            if let Ok(mut stmt) = conn.prepare(query) {
                if let Ok(rows) = stmt.query_map([account_id_u32], |row| {
                    Ok(row.get::<_, i64>(0)?)
                }) {
                    for row_result in rows {
                        if let Ok(value) = row_result {
                            orchard_note_count += 1;
                            orchard_total_zatoshis += value as u64;
                            orchard_spendable_zatoshis += value as u64;
                        }
                    }
                    if orchard_note_count > 0 {
                        break;
                    }
                }
            }
        }

        // Build JSON response
        Ok(serde_json::json!({
            "account": 0,
            "wallet_birthday_height": wallet_birthday_height,
            "next_scan_height": next_scan_height,
            "max_scanned_height": max_scanned_height,
            "chain_tip_height": chain_tip_height,
            "sapling": {
                "note_count": sapling_note_count,
                "spendable_zatoshis": sapling_spendable_zatoshis,
                "total_zatoshis": sapling_total_zatoshis
            },
            "orchard": {
                "note_count": orchard_note_count,
                "spendable_zatoshis": orchard_spendable_zatoshis,
                "total_zatoshis": orchard_total_zatoshis
            }
        }))
    }

    #[cfg(not(feature = "native"))]
    fn debug_notes(&self) -> Result<serde_json::Value, String> {
        // WASM stub
        Ok(serde_json::json!({
            "account": 0,
            "sapling": {"note_count": 0, "total_zatoshis": 0, "spendable_zatoshis": 0},
            "orchard": {"note_count": 0, "total_zatoshis": 0, "spendable_zatoshis": 0}
        }))
    }

    #[cfg(not(feature = "native"))]
    fn debug_sync(&self) -> Result<serde_json::Value, String> {
        // WASM stub
        Ok(serde_json::json!({
            "account": 0,
            "wallet_birthday_height": null,
            "next_scan_height": null,
            "max_scanned_height": null,
            "chain_tip_height": 0,
            "sapling": {"note_count": 0, "spendable_zatoshis": 0, "total_zatoshis": 0},
            "orchard": {"note_count": 0, "spendable_zatoshis": 0, "total_zatoshis": 0}
        }))
    }

    /// Convert proto CompactBlock from lightwalletd to zcash_client_backend format
    #[cfg(feature = "native")]
    fn convert_proto_block_to_backend(
        proto_block: &crate::cash::z::wallet::sdk::rpc::CompactBlock,
    ) -> Result<BackendCompactBlock, String> {
        use zcash_client_backend::proto::compact_formats::ChainMetadata as BackendChainMetadata;
        
        // Convert transactions
        let mut backend_vtx = Vec::new();
        
        // Convert all vtx transactions (header is now bytes, not CompactTx)
        for proto_tx in &proto_block.vtx {
            let backend_tx = Self::convert_proto_tx_to_backend(proto_tx)?;
            backend_vtx.push(backend_tx);
        }
        
        // Build backend proto CompactBlock
        // BackendCompactBlock is zcash_client_backend::proto::compact_formats::CompactBlock
        let mut backend_proto_block = BackendCompactBlock::default();
        backend_proto_block.proto_version = proto_block.proto_version;
        backend_proto_block.height = proto_block.height;
        backend_proto_block.hash = proto_block.hash.clone();
        backend_proto_block.prev_hash = proto_block.prev_hash.clone();
        backend_proto_block.time = proto_block.time;
        backend_proto_block.header = proto_block.header.clone();
        backend_proto_block.vtx = backend_vtx;
        
        // Copy chain_metadata if present (contains tree sizes needed for scanning)
        if let Some(ref meta) = proto_block.chain_metadata {
            backend_proto_block.chain_metadata = Some(BackendChainMetadata {
                sapling_commitment_tree_size: meta.sapling_commitment_tree_size,
                orchard_commitment_tree_size: meta.orchard_commitment_tree_size,
            });
        }
        
        Ok(backend_proto_block)
    }
    
    /// Convert proto CompactTx to backend format
    #[cfg(feature = "native")]
    fn convert_proto_tx_to_backend(
        proto_tx: &crate::cash::z::wallet::sdk::rpc::CompactTx,
    ) -> Result<zcash_client_backend::proto::compact_formats::CompactTx, String> {
        use zcash_client_backend::proto::compact_formats::{
            CompactTx as BackendCompactTx,
            CompactSaplingSpend as BackendSaplingSpend,
            CompactSaplingOutput as BackendSaplingOutput,
            CompactOrchardAction as BackendOrchardAction,
        };
        
        // Convert Sapling spends
        let backend_spends: Vec<BackendSaplingSpend> = proto_tx.spends
            .iter()
            .map(|s| BackendSaplingSpend {
                nf: s.nf.clone(),
            })
            .collect();
        
        // Convert Sapling outputs
        let backend_outputs: Vec<BackendSaplingOutput> = proto_tx.outputs
            .iter()
            .map(|o| BackendSaplingOutput {
                cmu: o.cmu.clone(),
                ephemeral_key: o.epk.clone(),
                ciphertext: o.ciphertext.clone(),
            })
            .collect();
        
        // Convert Orchard actions
        let backend_actions: Vec<BackendOrchardAction> = proto_tx.actions
            .iter()
            .map(|a| BackendOrchardAction {
                nullifier: a.nullifier.clone(),
                cmx: a.cmx.clone(),
                ephemeral_key: a.ephemeral_key.clone(),
                ciphertext: a.ciphertext.clone(),
            })
            .collect();
        
        Ok(BackendCompactTx {
            index: proto_tx.index,
            hash: proto_tx.hash.clone(),
            fee: proto_tx.fee,
            spends: backend_spends,
            outputs: backend_outputs,
            actions: backend_actions,
        })
    }

    #[cfg(feature = "native")]
    pub fn sync(&self) -> Result<u64, String> {
        // ============================================================
        // WALLET SYNC FUNCTION - Real implementation using proper chain state
        // ============================================================
        // Synchronizes the wallet with the Zcash blockchain via lightwalletd
        // Uses the scan_queue and proper chain state from the database
        // ============================================================

        // Step 1: Open the wallet database
        let db_path = Path::new(&self.db_path);
        let mut wallet_db = open_or_init_wallet_db(db_path)?;
        
        // Step 2: Check if we have an account registered - if not, wallet isn't initialized properly
        let account_ids: Vec<_> = wallet_db.get_account_ids()
            .map_err(|e| format!("Failed to get account IDs: {:?}", e))?;
        
        if account_ids.is_empty() {
            return Err("No accounts found. Please run init first to create a wallet.".to_string());
        }
        
        // Step 3: Get the wallet's scan progress
        // block_fully_scanned returns Option<BlockMetadata> with the highest fully-scanned block
        let fully_scanned = wallet_db.block_fully_scanned()
            .map_err(|e| format!("Failed to get fully scanned block: {:?}", e))?;
        
        let fully_scanned_height = fully_scanned
            .as_ref()
            .map(|meta| u64::from(meta.block_height()))
            .unwrap_or(0);
        
        eprintln!("Wallet fully scanned to height: {}", fully_scanned_height);

        // Step 4: Create tokio runtime for async gRPC calls
        let rt = Runtime::new()
            .map_err(|e| format!("Failed to create tokio runtime: {:?}", e))?;

        // Step 5: Connect to lightwalletd and sync blocks
        let synced_height = rt.block_on(async {
            let grpc_url = if self.lightwalletd_url.starts_with("http://") {
                self.lightwalletd_url.clone()
            } else if self.lightwalletd_url.starts_with("https://") {
                return Err("HTTPS/TLS not yet supported. Use http:// for now.".to_string());
            } else {
                format!("http://{}", self.lightwalletd_url)
            };

            let channel = Channel::from_shared(grpc_url)
                .map_err(|e| format!("Invalid lightwalletd URL: {}", e))?
                .connect()
                .await
                .map_err(|e| format!("Failed to connect to lightwalletd: {}", e))?;

            use crate::cash::z::wallet::sdk::rpc::compact_tx_streamer_client::CompactTxStreamerClient;
            use crate::cash::z::wallet::sdk::rpc::Empty;
            
            let mut client = CompactTxStreamerClient::new(channel);
            
            // Get chain tip height
            let info = client.get_lightd_info(tonic::Request::new(Empty {}))
                .await
                .map_err(|e| format!("Failed to get lightwalletd info: {}", e))?;
            
            let tip_height = info.get_ref().block_height;
            eprintln!("Chain tip height: {}", tip_height);
            
            // Update the chain tip in the wallet database
            use zcash_protocol::consensus::BlockHeight;
            wallet_db.update_chain_tip(BlockHeight::from_u32(tip_height as u32))
                .map_err(|e| format!("Failed to update chain tip: {:?}", e))?;
            
            // Step 6: Get suggested scan ranges from the wallet database
            use zcash_client_backend::data_api::scanning::ScanPriority;
            
            let scan_ranges = wallet_db.suggest_scan_ranges()
                .map_err(|e| format!("Failed to get scan ranges: {:?}", e))?;
            
            if scan_ranges.is_empty() {
                eprintln!("No scan ranges suggested - wallet is up to date");
                // Note: We still need to decrypt pending memos (this happens after the async block)
                return Ok::<u64, String>(tip_height);
            }
            
            eprintln!("Scan ranges to process: {}", scan_ranges.len());
            
            // Process scan ranges in priority order (highest priority first)
            let mut last_scanned_height = fully_scanned_height;
            
            for scan_range in scan_ranges {
                let range_start = u64::from(scan_range.block_range().start);
                let range_end = u64::from(scan_range.block_range().end);
                let priority = scan_range.priority();
                
                // Skip Ignored ranges
                if priority == ScanPriority::Ignored {
                    continue;
                }
                
                eprintln!("Processing scan range [{}, {}) with priority {:?}", range_start, range_end, priority);
                
                // Download blocks for this range
                let mut all_blocks: Vec<BackendCompactBlock> = Vec::new();
                let download_batch_size = 1000u64;
                let mut current_height = range_start;
                
                while current_height < range_end {
                    let batch_end = std::cmp::min(current_height + download_batch_size, range_end);
                    
                    use crate::cash::z::wallet::sdk::rpc::{BlockId, BlockRange};
                    
                    let block_range = BlockRange {
                        start: Some(BlockId {
                            height: current_height,
                            hash: vec![],
                        }),
                        end: Some(BlockId {
                            height: batch_end.saturating_sub(1), // end is exclusive in scan_range but inclusive in GetBlockRange
                            hash: vec![],
                        }),
                    };
                    
                    eprintln!("Downloading blocks [{}, {}]", current_height, batch_end.saturating_sub(1));
                    
                    let mut stream = client.get_block_range(tonic::Request::new(block_range))
                        .await
                        .map_err(|e| format!("Failed to get block range: {}", e))?
                        .into_inner();
                    
                    while let Some(block_result) = stream.message().await
                        .map_err(|e| format!("Failed to read block: {}", e))? {
                        if let Ok(backend_block) = Self::convert_proto_block_to_backend(&block_result) {
                            all_blocks.push(backend_block);
                        }
                    }
                    
                    current_height = batch_end;
                }
                
                if all_blocks.is_empty() {
                    eprintln!("No blocks downloaded for range [{}, {})", range_start, range_end);
                    continue;
                }
                
                eprintln!("Downloaded {} blocks, scanning...", all_blocks.len());
                
                // Sort blocks by height
                all_blocks.sort_by_key(|b| b.height);
                
                // Create BlockSource for scanning
                struct InMemoryBlockSource {
                    blocks: Vec<BackendCompactBlock>,
                }
                
                impl BlockSource for InMemoryBlockSource {
                    type Error = String;
                    
                    fn with_blocks<F, WalletErrT>(
                        &self,
                        from_height: Option<BlockHeight>,
                        limit: Option<usize>,
                        mut with_block: F,
                    ) -> Result<(), zcash_client_backend::data_api::chain::error::Error<WalletErrT, Self::Error>>
                    where
                        F: FnMut(BackendCompactBlock) -> Result<(), zcash_client_backend::data_api::chain::error::Error<WalletErrT, Self::Error>>,
                    {
                        let start = from_height.map(|h| u64::from(h)).unwrap_or(0u64);
                        let max = limit.unwrap_or(self.blocks.len());
                        let mut count = 0;
                        
                        for block in &self.blocks {
                            if block.height >= start && count < max {
                                with_block(block.clone())?;
                                count += 1;
                            }
                        }
                        Ok(())
                    }
                }
                
                let block_source = InMemoryBlockSource { blocks: all_blocks.clone() };

                // Get prior chain state from the database
                let scan_start = all_blocks.first().map(|b| b.height).unwrap();
                let scan_end = all_blocks.last().map(|b| b.height).unwrap();
                let prior_height = BlockHeight::from_u32((scan_start.saturating_sub(1)) as u32);

                // Build the ChainState by fetching tree state from lightwalletd.
                // We always need the actual tree state (with Sapling/Orchard frontiers) for scanning.
                // ChainState::empty() doesn't work because scan_cached_blocks needs the tree size info.
                eprintln!("Fetching tree state at height {} from lightwalletd", u64::from(prior_height));

                let tree_state = fetch_tree_state_async(&self.lightwalletd_url, u64::from(prior_height))
                    .await
                    .map_err(|e| format!("Failed to fetch tree state at height {}: {}", u64::from(prior_height), e))?;

                eprintln!("Fetched tree state at height {}: hash={}, sapling_tree_len={}, orchard_tree_len={}",
                    tree_state.height, tree_state.hash, tree_state.sapling_tree.len(), tree_state.orchard_tree.len());

                let chain_state = create_chain_state_from_treestate(&tree_state)?;
                
                eprintln!("Scanning blocks [{}..={}]", scan_start, scan_end);
                
                // Scan blocks
                let scan_result = scan_cached_blocks(
                    &network_protocol(),
                    &block_source,
                    &mut wallet_db,
                    BlockHeight::from_u32(scan_start as u32),
                    &chain_state,
                    all_blocks.len(),
                );
                
                match scan_result {
                    Ok(summary) => {
                        eprintln!("Scanned {} blocks successfully", all_blocks.len());
                        let range = summary.scanned_range();
                        eprintln!("Scanned range: {:?}", range);
                        last_scanned_height = scan_end;
                    }
                    Err(e) => {
                        eprintln!("Error scanning blocks [{}, {}]: {:?}", scan_start, scan_end, e);
                        return Err(format!("Scan failed: {:?}", e));
                    }
                }
            }
            
            Ok::<u64, String>(last_scanned_height)
        })?;

        // Step 7: Decrypt memos for received notes that don't have memos yet
        // Compact blocks don't include memo data, so we need to fetch full transactions
        // and decrypt the memos using the wallet's viewing key
        self.decrypt_pending_memos()?;

        Ok(synced_height)
    }

    /// Decrypts memos for received notes that have NULL memo fields.
    /// This fetches full transactions from lightwalletd and extracts memo data.
    #[cfg(feature = "native")]
    fn decrypt_pending_memos(&self) -> Result<(), String> {
        use rusqlite::params;

        eprintln!("Starting decrypt_pending_memos...");

        let db_path = Path::new(&self.db_path);

        // Step 1: Open the wallet database via WalletDb for account info
        let wallet_db = open_or_init_wallet_db(db_path)?;
        eprintln!("Opened wallet database at {:?}", db_path);

        // Step 2: Open a separate raw connection for direct SQL queries
        // This is necessary because WalletDb doesn't expose the raw connection directly
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database for memo queries: {:?}", e))?;

        // Step 3: Query for received notes without memos
        // Join with transactions table to get txid and block height
        // Column names: transaction_id (not tx_id), txid (not txid_blob), mined_height (not block_height)
        let mut stmt = conn.prepare(
            "SELECT orn.id, orn.transaction_id, t.txid, t.mined_height, orn.action_index
             FROM orchard_received_notes orn
             JOIN transactions t ON orn.transaction_id = t.id_tx
             WHERE orn.memo IS NULL AND t.txid IS NOT NULL"
        ).map_err(|e| format!("Failed to prepare statement: {:?}", e))?;

        let notes_without_memos: Vec<(i64, i64, Vec<u8>, u32, u32)> = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,  // note id
                row.get::<_, i64>(1)?,  // transaction_id
                row.get::<_, Vec<u8>>(2)?,  // txid
                row.get::<_, u32>(3)?,  // mined_height
                row.get::<_, u32>(4)?,  // action_index
            ))
        }).map_err(|e| format!("Failed to query notes: {:?}", e))?
        .filter_map(|r| r.ok())
        .collect();

        if notes_without_memos.is_empty() {
            eprintln!("No pending memos to decrypt");
            return Ok(());
        }

        eprintln!("Found {} notes without memos, fetching full transactions...", notes_without_memos.len());

        // Step 4: Get the UFVK for decryption
        // First get list of account IDs, then get the first account
        let account_ids: Vec<_> = wallet_db.get_account_ids()
            .map_err(|e| format!("Failed to get account IDs: {:?}", e))?;

        let account_uuid = account_ids.first()
            .ok_or("No accounts found")?;

        let account = wallet_db.get_account(*account_uuid)
            .map_err(|e| format!("Failed to get account: {:?}", e))?
            .ok_or("Account not found")?;

        let ufvk = account.ufvk()
            .ok_or("Account has no UFVK")?;

        // Use AccountUuid for the HashMap key to match decrypt_transaction expectations
        let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");
        let mut ufvks = HashMap::new();
        ufvks.insert(account_id, ufvk.clone());

        // Step 4: Create tokio runtime for async calls
        let rt = Runtime::new()
            .map_err(|e| format!("Failed to create tokio runtime: {:?}", e))?;

        // Step 5: Process each note, fetching full tx and decrypting memo
        // Continue even if some txs fail (zebrad may not have old txs indexed)
        for (note_id, _tx_db_id, txid_blob, block_height, action_index) in notes_without_memos {
            // txid_blob is stored in internal byte order in the database
            // The lightwalletd GetTransaction expects the display format (reversed)
            // So we need to reverse for the display format that lightwalletd uses
            let mut txid_display = txid_blob.clone();
            txid_display.reverse();

            eprintln!("Fetching full tx {} at height {} for action {}",
                hex::encode(&txid_display), block_height, action_index);

            // Fetch full transaction from lightwalletd
            // Note: lightwalletd GetTransaction expects internal byte order (not display)
            let tx_data_result = rt.block_on(async {
                self.fetch_full_transaction(&txid_blob).await
            });

            let tx_data = match tx_data_result {
                Ok(data) => data,
                Err(e) => {
                    eprintln!("Warning: Could not fetch tx {} (may not be indexed): {}",
                        hex::encode(&txid_display), e);
                    continue; // Skip this note, try the next one
                }
            };

            // Parse transaction
            let tx = match Transaction::read(&tx_data[..], zcash_primitives::consensus::BranchId::Nu6) {
                Ok(tx) => tx,
                Err(e) => {
                    eprintln!("Warning: Could not parse tx {}: {:?}",
                        hex::encode(&txid_display), e);
                    continue;
                }
            };

            // Decrypt transaction outputs
            let decrypted = decrypt_transaction(
                &network_protocol(),
                Some(BlockHeight::from_u32(block_height)),
                None,
                &tx,
                &ufvks,
            );

            // Find the memo for our action index
            let orchard_outputs = decrypted.orchard_outputs();

            for output in orchard_outputs {
                if output.index() == action_index as usize {
                    let memo_bytes = output.memo();

                    // Update the memo in the database
                    if let Err(e) = conn.execute(
                        "UPDATE orchard_received_notes SET memo = ? WHERE id = ?",
                        params![memo_bytes.as_slice(), note_id],
                    ) {
                        eprintln!("Warning: Failed to update memo for note {}: {:?}", note_id, e);
                        continue;
                    }

                    let memo_str = String::from_utf8_lossy(memo_bytes.as_slice());
                    eprintln!("Decrypted memo for note {}: {:?}", note_id,
                        memo_str.chars().take(50).collect::<String>());

                    break;
                }
            }
        }

        eprintln!("Finished decrypting pending memos");
        Ok(())
    }

    /// Fetches the full transaction data from lightwalletd
    #[cfg(feature = "native")]
    async fn fetch_full_transaction(&self, txid: &[u8]) -> Result<Vec<u8>, String> {
        use crate::cash::z::wallet::sdk::rpc::compact_tx_streamer_client::CompactTxStreamerClient;
        use crate::cash::z::wallet::sdk::rpc::TxFilter;

        let grpc_url = if self.lightwalletd_url.starts_with("http://") {
            self.lightwalletd_url.clone()
        } else {
            format!("http://{}", self.lightwalletd_url)
        };

        let channel = Channel::from_shared(grpc_url)
            .map_err(|e| format!("Invalid lightwalletd URL: {}", e))?
            .connect()
            .await
            .map_err(|e| format!("Failed to connect to lightwalletd: {}", e))?;

        let mut client = CompactTxStreamerClient::new(channel);

        let tx_filter = TxFilter {
            block: None,
            index: 0,
            hash: txid.to_vec(),
        };

        let response = client.get_transaction(tonic::Request::new(tx_filter))
            .await
            .map_err(|e| format!("Failed to get transaction: {}", e))?;

        Ok(response.into_inner().data)
    }

    #[cfg(not(feature = "native"))]
    fn sync(&self) -> Result<(), String> {
        // WASM stub: Network operations in WASM require different approach
        // We might need to use fetch API or similar browser APIs
        Ok(())
    }

    #[cfg(feature = "native")]
    pub fn build_message_tx(&self, to_address: String, text: String) -> Result<(String, String), String> {
        // Use default minimal amount for message transactions
        self.build_message_tx_with_amount(to_address, text, 10_000u64)
    }

    #[cfg(feature = "native")]
    pub fn build_message_tx_with_amount(&self, to_address: String, text: String, amount: u64) -> Result<(String, String), String> {
        // ============================================================
        // BUILD MESSAGE TX FUNCTION
        // ============================================================
        // This function builds and signs a shielded Zcash transaction
        // with a message embedded in the memo field.
        // It returns the raw transaction bytes (hex) and txid (hex).
        // The backend will be responsible for broadcasting.
        // ============================================================

        // Step 1: Open the wallet database (ensures schema is initialized)
        let db_path = Path::new(&self.db_path);
        let mut wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 2: Get account ID 0 (the default account)
        let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");

        // Step 3: Read the seed to derive the spending key
        // We need the spending key to create and sign the transaction
        let seed_file_path = format!("{}.seed", self.db_path);
        let seed_bytes = fs::read(&seed_file_path)
            .map_err(|e| format!("Failed to read seed file: {:?}", e))?;

        if seed_bytes.len() != 32 {
            return Err("Invalid seed length".to_string());
        }

        let seed_array: [u8; 32] = seed_bytes.try_into()
            .map_err(|_| "Failed to convert seed to array".to_string())?;

        // Step 4: Derive the Unified Spending Key from the seed
        // Note: UnifiedSpendingKey::from_seed expects zcash_protocol::consensus::Parameters
        let usk = UnifiedSpendingKey::from_seed(
            &network_protocol(), // Use ProtocolMainNetwork, not PrimitivesMainNetwork
            &seed_array,
            account_id,
        )
        .map_err(|e| format!("Failed to derive spending key: {:?}", e))?;

        // Step 5: Parse the recipient address
        // Convert the string address to a Zcash unified address
        // Address::decode returns (Network, Address) tuple
        let (_net, recipient_address) = Address::decode(&to_address)
            .map_err(|e| format!("Invalid recipient address: {:?}", e))?;

        // Step 6: Construct the memo string with format: "ZMSGv2|<unix_timestamp>|<sender_address>|<text>"
        // ZMSGv2 includes sender's address so recipients can identify who sent the message
        // This enables proper conversation grouping in chat applications
        //
        // Get current Unix timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {:?}", e))?
            .as_secs();

        // Get our (sender's) address to include in the memo
        let our_address = self.get_primary_address()
            .map_err(|e| format!("Failed to get sender address: {:?}", e))?;

        // Construct the memo string with sender address
        // Format: ZMSGv2|<timestamp>|<sender_address>|<text>
        let memo_string = format!("ZMSGv2|{}|{}|{}", timestamp, our_address, text);

        // Step 7: Convert memo string to MemoBytes
        // MemoBytes can hold up to 512 bytes, but we need to ensure it fits
        let memo_bytes = memo_string.as_bytes();
        if memo_bytes.len() > 512 {
            return Err(format!("Memo too long: {} bytes (max 512)", memo_bytes.len()));
        }

        // Create MemoBytes from the memo string
        // Note: MemoBytes expects exactly 512 bytes, so we need to pad if necessary
        let mut memo_array = [0u8; 512];
        memo_array[..memo_bytes.len()].copy_from_slice(memo_bytes);
        let memo = MemoBytes::from_bytes(&memo_array)
            .map_err(|e| format!("Failed to create memo: {:?}", e))?;

        // Step 8: Use the provided amount (must be at least 10,000 zatoshis for shielded transactions)
        if amount < 10_000u64 {
            return Err("Amount must be at least 10,000 zatoshis (0.0001 ZEC) for shielded transactions".to_string());
        }

        // Step 9: Convert zcash_address::Address to zcash_client_backend::address::UnifiedAddress
        // The Address from zcash_address is a struct, not an enum
        use zcash_client_backend::address::UnifiedAddress as BackendUnifiedAddress;
        use zcash_client_backend::encoding::AddressCodec;
        use zcash_address::Network as AddressNetwork;
        
        // recipient_address is already a unified::Address struct
        // Re-encode to string using zcash_address::Network
        // zcash_address::Network has Mainnet and Testnet variants
        let address_network = AddressNetwork::Main;
        let addr_str = recipient_address.encode(&address_network);
        // Decode using backend's UnifiedAddress via AddressCodec trait
        // Note: decode expects zcash_protocol::consensus::Parameters
        let _recipient_ua: BackendUnifiedAddress = BackendUnifiedAddress::decode(&network_protocol(), &addr_str)
            .map_err(|e| format!("Failed to decode unified address for backend: {:?}", e))?;

        // Step 10: Create the transaction using proposal-based workflow
        // First, create the proposal
        use zcash_primitives::transaction::components::amount::NonNegativeAmount;
        use std::num::NonZeroU32;

        // Convert amount to NonNegativeAmount
        let send_amount = NonNegativeAmount::from_u64(amount)
            .map_err(|_| "Invalid amount".to_string())?;

        // Get the recipient address as zcash_client_backend::address::Address
        use zcash_client_backend::address::Address as BackendAddress;
        let recipient_addr = BackendAddress::decode(&network_protocol(), &addr_str)
            .ok_or_else(|| "Failed to decode recipient address".to_string())?;

        // Get account ID for database (uses 0 as index, but DB stores as 1)
        let db_account_id = wallet_db.get_account_for_ufvk(&usk.to_unified_full_viewing_key())
            .map_err(|e| format!("Failed to get account from database: {:?}", e))?
            .ok_or_else(|| "Account not found in database".to_string())?;

        // Use minimum confirmations policy for faster transactions
        let confirmations = ConfirmationsPolicy::MIN;

        // Create the proposal
        let proposal = propose_standard_transfer_to_address::<_, _, ()>(
            &mut wallet_db,
            &network_protocol(),
            StandardFeeRule::Zip317,
            db_account_id.id(),
            confirmations,
            &recipient_addr,
            send_amount,
            Some(memo.clone()),
            None, // no change memo
            ShieldedProtocol::Orchard, // prefer Orchard for change
        )
        .map_err(|e| format!("Failed to create transaction proposal: {:?}", e))?;

        // Step 11: Get the prover for creating proofs
        let prover = LocalTxProver::with_default_location()
            .ok_or_else(|| {
                "Zcash proving parameters not found. Please run 'zcash-fetch-params' or download sapling-spend.params and sapling-output.params to ~/.zcash-params/".to_string()
            })?;

        // Step 12: Create the transaction(s) from the proposal
        // Create SpendingKeys from the UnifiedSpendingKey
        let spending_keys = SpendingKeys::from_unified_spending_key(usk.clone());

        // Call create_proposed_transactions
        // Use explicit turbofish for type inference with Infallible for unused error types
        use std::convert::Infallible;
        use zcash_client_sqlite::ReceivedNoteId;

        let txids: NonEmpty<TxId> = create_proposed_transactions::<_, _, Infallible, _, Infallible, ReceivedNoteId>(
            &mut wallet_db,
            &network_protocol(),
            &prover,
            &prover,
            &spending_keys,
            OvkPolicy::Sender,
            &proposal,
        )
        .map_err(|e| format!("Failed to create transaction: {:?}", e))?;

        // Step 13: Get the first transaction ID
        let txid = txids.first();
        let txid_hex = format!("{}", txid);

        // Step 14: Retrieve the raw transaction from the database
        // The transaction was stored in the database by create_proposed_transactions
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {:?}", e))?;

        let tx_hex: String = conn.query_row(
            "SELECT hex(raw) FROM transactions WHERE txid = ?",
            [txid.as_ref()],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to retrieve transaction: {:?}", e))?;

        Ok((tx_hex, txid_hex))
    }

    #[cfg(not(feature = "native"))]
    fn build_message_tx(&self, _to_address: String, _text: String) -> Result<(String, String), String> {
        // WASM stub - return dummy values
        Ok(("dummy_tx_hex".to_string(), "dummy_txid_hex".to_string()))
    }

    /// Build a transaction to an address with a custom amount and memo
    /// Returns both the transaction hex (for broadcasting) and txid
    #[cfg(feature = "native")]
    pub fn build_transaction(&self, to: &str, amount: u64, memo: &str) -> Result<(String, String), String> {
        // Use build_message_tx_with_amount to support custom amounts
        self.build_message_tx_with_amount(to.to_string(), memo.to_string(), amount)
    }

    /// Send a transaction to an address with a custom amount and memo
    /// This is a wrapper around build_transaction that returns just the txid
    /// Returns the transaction ID (txid) as hex string
    #[cfg(feature = "native")]
    pub fn send_to_address(&self, to: &str, amount: u64, memo: &str) -> Result<String, String> {
        let (_tx_hex, txid_hex) = self.build_transaction(to, amount, memo)?;
        Ok(txid_hex)
    }

    #[cfg(not(feature = "native"))]
    pub fn send_to_address(&self, _to: &str, _amount: u64, _memo: &str) -> Result<String, String> {
        // WASM stub
        Ok("dummy_txid".to_string())
    }

    /// Get primary address - alias for get_primary_address for CLI compatibility
    #[cfg(feature = "native")]
    pub fn primary_address(&self) -> Result<String, String> {
        self.get_primary_address()
    }

    #[cfg(not(feature = "native"))]
    pub fn primary_address(&self) -> Result<String, String> {
        self.get_primary_address()
    }

    /// Get 24-word backup phrase - alias for get_backup_phrase for CLI compatibility
    #[cfg(feature = "native")]
    pub fn backup_phrase(&self) -> Result<String, String> {
        self.get_backup_phrase()
    }

    #[cfg(not(feature = "native"))]
    pub fn backup_phrase(&self) -> Result<String, String> {
        self.get_backup_phrase()
    }

    /// Get balance in zatoshis - alias for get_balance for CLI compatibility
    #[cfg(feature = "native")]
    pub fn balance_zat(&self) -> Result<u64, String> {
        self.get_balance()
    }

    #[cfg(not(feature = "native"))]
    pub fn balance_zat(&self) -> Result<u64, String> {
        self.get_balance()
    }

    #[cfg(feature = "native")]
    pub fn list_messages(&self, since_height: Option<u32>) -> Result<Vec<ChatMessage>, String> {
        // ============================================================
        // LIST MESSAGES FUNCTION
        // ============================================================
        // This function scans all transactions in the wallet database,
        // finds memos that contain messages (starting with "ZMSGv1|"),
        // parses them, and returns a list of Message structs.
        //
        // Message format in memo: "ZMSGv1|<timestamp>|<id>|<text>"
        // ============================================================

        // Step 1: Open the wallet database (ensures schema is initialized)
        // We need to access the database to read transaction history
        let db_path = Path::new(&self.db_path);
        let _wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 2: Get our primary address to determine if messages are to/from us
        // This helps us figure out the direction of each message
        let our_address = self.get_primary_address()
            .map_err(|e| format!("Failed to get primary address: {}", e))?;

        // Step 3: Create a vector to store all the messages we find
        let messages: Vec<ChatMessage> = Vec::new();
        
        // Filter by since_height if provided
        let _min_height = since_height.unwrap_or(0);

        // Step 4: Iterate over all transactions in the wallet database
        // We need to look through every transaction we've received or sent
        // and check if any of them have memos with our message format
        //
        // NOTE: The exact API may vary - this is a conceptual implementation
        // The actual implementation would use WalletRead trait methods to:
        //   - Get all transactions: wallet_db.get_transactions()? or similar
        //   - For each transaction, iterate over outputs
        //   - Check each output for a memo field

        // Example implementation (once WalletRead API methods are available):
        // let transactions = wallet_db.get_transactions()?;
        // for tx in transactions {
        //     // Get memo from transaction outputs
        //     for output in tx.outputs() {
        //         if let Some(memo_bytes) = output.memo() {
        //             // Step 5: Decode memo as UTF-8
        //             // Memos are stored as bytes, but our messages are text
        //             // We need to convert the bytes to a string
        //             if let Ok(memo_str) = String::from_utf8(memo_bytes.to_vec()) {
        //                 // Step 6: Remove null padding
        //                 // Memos are always 512 bytes, but our text is shorter
        //                 // The rest is filled with null bytes (\0), which we need to remove
        //                 let memo_str = memo_str.trim_end_matches('\0');
        //                 
        //                 // Step 7: Check if memo starts with "ZROTv1|" (rotation message)
        //                 if memo_str.starts_with(ROTATE_MEMO_PREFIX) {
        //                     // Parse rotation memo format: "ZROTv1|<new_address>|<timestamp>"
        //                     let parts: Vec<&str> = memo_str.splitn(3, '|').collect();
        //                     
        //                     if parts.len() == 3 && parts[0] == ROTATE_MEMO_PREFIX {
        //                         let new_address = parts[1].to_string();
        //                         if let Ok(timestamp) = parts[2].parse::<u64>() {
        //                             let txid = hex::encode(tx.txid().as_ref());
        //                             
        //                             let (from_address, to_address) = if tx.is_received() {
        //                                 (tx.sender_address().map(|a| a.to_string()), our_address.clone())
        //                             } else {
        //                                 (None, output.address().to_string())
        //                             };
        //                             
        //                             // Create rotation message
        //                             messages.push(Message {
        //                                 id: format!("rot-{}", txid), // Use txid as ID for rotation messages
        //                                 txid,
        //                                 from_address,
        //                                 to_address,
        //                                 timestamp,
        //                                 text: format!("Address rotation: new address is {}", new_address),
        //                                 message_type: Some("rotation".to_string()),
        //                                 new_address: Some(new_address),
        //                             });
        //                         }
        //                     }
        //                 }
        //                 // Step 8: Check if memo starts with "ZMSGv1|" (regular message)
        //                 else if memo_str.starts_with("ZMSGv1|") {
        //                     // Step 9: Parse the memo format: "ZMSGv1|<timestamp>|<id>|<text>"
        //                     // Split the string by '|' to get the parts
        //                     // splitn(4, '|') means: split into at most 4 parts, using '|' as delimiter
        //                     let parts: Vec<&str> = memo_str.splitn(4, '|').collect();
        //                     
        //                     // Step 10: Validate we have exactly 4 parts and the first is "ZMSGv1"
        //                     if parts.len() == 4 && parts[0] == "ZMSGv1" {
        //                         // Step 11: Parse the timestamp (second part)
        //                         // The timestamp is a Unix timestamp (seconds since 1970)
        //                         if let Ok(timestamp) = parts[1].parse::<u64>() {
        //                             // Step 12: Extract the message ID and text
        //                             let id = parts[2].to_string();  // Random ID for deduplication
        //                             let text = parts[3].to_string();  // The actual message text
        //                             
        //                             // Step 13: Get the transaction ID
        //                             // This is the unique identifier for this transaction on the blockchain
        //                             let txid = hex::encode(tx.txid().as_ref());
        //                             
        //                             // Step 14: Determine from/to addresses
        //                             // If this is a received transaction, we are the recipient
        //                             // If this is a sent transaction, we are the sender
        //                             let (from_address, to_address) = if tx.is_received() {
        //                                 // We received this message, so someone sent it to us
        //                                 (tx.sender_address().map(|a| a.to_string()), our_address.clone())
        //                             } else {
        //                                 // We sent this message, so we don't know the sender (it's us)
        //                                 (None, output.address().to_string())
        //                             };
        //                             
        //                             // Step 15: Create a Message struct and add it to our list
        //                             messages.push(Message {
        //                                 id,
        //                                 txid,
        //                                 from_address,
        //                                 to_address,
        //                                 timestamp,
        //                                 text,
        //                                 message_type: None, // Regular message
        //                                 new_address: None,
        //                             });
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }

        // Step 15: Return the list of messages
        // For now, return an empty vector since we need WalletRead API methods
        // TODO: Once WalletRead API methods are available, implement transaction iteration
        // and memo extraction to populate the messages vector
        
        // Query sent_notes table directly for messages we've sent
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database connection: {:?}", e))?;

        let mut messages: Vec<ChatMessage> = Vec::new();

        // Query sent notes with memos (these are messages we sent)
        let query = "SELECT sn.id, sn.transaction_id, sn.to_address, sn.value, sn.memo, t.block, t.mined_height
                     FROM sent_notes sn
                     LEFT JOIN transactions t ON sn.transaction_id = t.id_tx
                     WHERE sn.memo IS NOT NULL";

        if let Ok(mut stmt) = conn.prepare(query) {
            if let Ok(rows) = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,           // id
                    row.get::<_, i64>(1)?,           // transaction_id
                    row.get::<_, Option<String>>(2)?, // to_address
                    row.get::<_, i64>(3)?,           // value
                    row.get::<_, Option<Vec<u8>>>(4)?, // memo (blob)
                    row.get::<_, Option<i64>>(5)?,   // block
                    row.get::<_, Option<i64>>(6)?,   // mined_height
                ))
            }) {
                for row_result in rows {
                    if let Ok((id, _tx_id, to_addr, _value, memo_bytes, block, _mined_height)) = row_result {
                        // Skip if no memo
                        let memo_bytes = match memo_bytes {
                            Some(b) => b,
                            None => continue,
                        };

                        // Filter by height if specified
                        if let Some(min_h) = since_height {
                            if let Some(blk) = block {
                                if blk < min_h as i64 {
                                    continue;
                                }
                            }
                        }

                        // Decode memo as UTF-8 and trim null padding
                        let memo_str = match String::from_utf8(memo_bytes) {
                            Ok(s) => s.trim_end_matches('\0').to_string(),
                            Err(_) => continue,
                        };

                        // Parse ZMSGv2 format: "ZMSGv2|<timestamp>|<sender_address>|<text>"
                        // or ZMSGv1 format: "ZMSGv1|<timestamp>|<id>|<text>" (legacy)
                        if memo_str.starts_with("ZMSGv2|") {
                            let parts: Vec<&str> = memo_str.splitn(4, '|').collect();
                            if parts.len() == 4 {
                                if let Ok(timestamp) = parts[1].parse::<i64>() {
                                    // For ZMSGv2, parts[2] is sender address (us for outgoing)
                                    let text = parts[3].to_string();
                                    let blk_height = block.unwrap_or(0) as u32;

                                    messages.push(ChatMessage {
                                        txid: format!("sent-{}", id),
                                        height: blk_height,
                                        timestamp,
                                        incoming: false, // We sent it
                                        value_zatoshis: 0,
                                        memo: text,
                                        to_address: to_addr,
                                        from_address: Some(our_address.clone()), // We are the sender
                                    });
                                }
                            }
                        } else if memo_str.starts_with("ZMSGv1|") {
                            // Legacy format: ZMSGv1|<timestamp>|<random_id>|<text>
                            let parts: Vec<&str> = memo_str.splitn(4, '|').collect();
                            if parts.len() == 4 {
                                if let Ok(timestamp) = parts[1].parse::<i64>() {
                                    let text = parts[3].to_string();
                                    let blk_height = block.unwrap_or(0) as u32;

                                    messages.push(ChatMessage {
                                        txid: format!("sent-{}", id),
                                        height: blk_height,
                                        timestamp,
                                        incoming: false, // We sent it
                                        value_zatoshis: 0,
                                        memo: text,
                                        to_address: to_addr,
                                        from_address: Some(our_address.clone()), // We are the sender
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // ============================================================
        // QUERY INCOMING MESSAGES FROM orchard_received_notes
        // ============================================================
        // Now also query the orchard_received_notes table for incoming messages.
        // These are messages we've received from other people.
        // The memo field in received notes contains the message content.
        // Query ALL received notes that are NOT change (is_change = 0), then filter by memo content
        let incoming_query = "SELECT orn.id, orn.action_index, orn.value, orn.memo, t.block, t.mined_height, t.txid
                              FROM orchard_received_notes orn
                              LEFT JOIN transactions t ON orn.transaction_id = t.id_tx
                              WHERE orn.is_change = 0";

        if let Ok(mut stmt) = conn.prepare(incoming_query) {
            if let Ok(rows) = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,              // id
                    row.get::<_, i64>(1)?,              // action_index
                    row.get::<_, i64>(2)?,              // value
                    row.get::<_, Option<Vec<u8>>>(3)?,  // memo (blob)
                    row.get::<_, Option<i64>>(4)?,      // block
                    row.get::<_, Option<i64>>(5)?,      // mined_height
                    row.get::<_, Option<Vec<u8>>>(6)?,  // txid (blob)
                ))
            }) {
                for row_result in rows {
                    if let Ok((id, _action_idx, value, memo_bytes, block, _mined_height, txid_bytes)) = row_result {
                        // Skip if no memo
                        let memo_bytes = match memo_bytes {
                            Some(b) => b,
                            None => continue,
                        };

                        // Filter by height if specified
                        if let Some(min_h) = since_height {
                            if let Some(blk) = block {
                                if blk < min_h as i64 {
                                    continue;
                                }
                            }
                        }

                        // Decode memo as UTF-8 and trim null padding
                        let memo_str = match String::from_utf8(memo_bytes) {
                            Ok(s) => s.trim_end_matches('\0').to_string(),
                            Err(_) => continue,
                        };

                        // Skip empty memos
                        if memo_str.is_empty() {
                            continue;
                        }

                        // Generate txid string from bytes or use id
                        let txid_str = match txid_bytes {
                            Some(bytes) => hex::encode(bytes),
                            None => format!("recv-{}", id),
                        };

                        // Parse ZMSGv2 format: "ZMSGv2|<timestamp>|<sender_address>|<text>"
                        // or ZMSGv1 format: "ZMSGv1|<timestamp>|<id>|<text>" (legacy)
                        if memo_str.starts_with("ZMSGv2|") {
                            let parts: Vec<&str> = memo_str.splitn(4, '|').collect();
                            if parts.len() == 4 {
                                if let Ok(timestamp) = parts[1].parse::<i64>() {
                                    // For ZMSGv2, parts[2] is the sender's address
                                    let sender_address = parts[2].to_string();
                                    let text = parts[3].to_string();
                                    let blk_height = block.unwrap_or(0) as u32;

                                    messages.push(ChatMessage {
                                        txid: txid_str.clone(),
                                        height: blk_height,
                                        timestamp,
                                        incoming: true, // We received it
                                        value_zatoshis: value,
                                        memo: text,
                                        to_address: Some(our_address.clone()), // We are the recipient
                                        from_address: Some(sender_address), // Sender's address from memo
                                    });
                                }
                            }
                        } else if memo_str.starts_with("ZMSGv1|") {
                            // Legacy format: ZMSGv1|<timestamp>|<random_id>|<text>
                            // No sender address available in v1 format
                            let parts: Vec<&str> = memo_str.splitn(4, '|').collect();
                            if parts.len() == 4 {
                                if let Ok(timestamp) = parts[1].parse::<i64>() {
                                    let text = parts[3].to_string();
                                    let blk_height = block.unwrap_or(0) as u32;

                                    messages.push(ChatMessage {
                                        txid: txid_str.clone(),
                                        height: blk_height,
                                        timestamp,
                                        incoming: true, // We received it
                                        value_zatoshis: value,
                                        memo: text,
                                        to_address: Some(our_address.clone()), // We are the recipient
                                        from_address: None, // Unknown sender (legacy format)
                                    });
                                }
                            }
                        } else {
                            // Non-ZMSG format - could be plain text from other wallets like Zashi
                            // Include these as incoming messages too, using block height as timestamp
                            let blk_height = block.unwrap_or(0) as u32;
                            // Use block height as approximate timestamp (or 0 if unknown)
                            let timestamp = block.unwrap_or(0);

                            messages.push(ChatMessage {
                                txid: txid_str.clone(),
                                height: blk_height,
                                timestamp,
                                incoming: true, // We received it
                                value_zatoshis: value,
                                memo: memo_str, // Raw memo text
                                to_address: Some(our_address.clone()), // We are the recipient
                                from_address: None, // Unknown sender (non-ZMSG format)
                            });
                        }
                    }
                }
            }
        }

        // Sort by timestamp
        messages.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        Ok(messages)
    }

    #[cfg(not(feature = "native"))]
    fn list_messages(&self) -> Result<Vec<Message>, String> {
        // WASM stub - return empty vector
        // In WASM, we'd need to use IndexedDB or similar storage
        Ok(Vec::new())
    }

    #[allow(dead_code)]
    fn ensure_db_exists(&self) -> Result<(), String> {
        // This method is kept for compatibility but init_new_wallet handles everything
        Ok(())
    }

    #[cfg(feature = "native")]
    fn regenerate_wallet_quiet(&self) -> Result<(String, String), String> {
        // ============================================================
        // REGENERATE WALLET QUIET FUNCTION
        // ============================================================
        // This function wipes the existing wallet database and creates
        // a completely new wallet with a new seed and address.
        // It returns the mnemonic phrase and new address.
        // ============================================================
        use rand::RngCore;

        let db_path = Path::new(&self.db_path);
        let seed_file_path = format!("{}.seed", self.db_path);

        // Step 1: Delete the existing database file if it exists
        if db_path.exists() {
            fs::remove_file(db_path)
                .map_err(|e| format!("Failed to remove old database: {:?}", e))?;
        }

        // Step 2: Delete the existing seed file if it exists
        if Path::new(&seed_file_path).exists() {
            fs::remove_file(&seed_file_path)
                .map_err(|e| format!("Failed to remove old seed file: {:?}", e))?;
        }

        // Step 3: Generate a new random 32-byte seed
        let mut seed = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut seed);

        // Step 4: Store the new seed in a file
        fs::write(&seed_file_path, &seed)
            .map_err(|e| format!("Failed to store new seed: {:?}", e))?;

        // Step 5: Create account ID 0 (the default account)
            let account_id = AccountId::try_from(0u32).expect("Account 0 is always valid");

        // Step 6: Derive a Unified Spending Key from the new seed
        // Note: UnifiedSpendingKey::from_seed expects zcash_protocol::consensus::Parameters
        let usk = UnifiedSpendingKey::from_seed(
            &network_protocol(), // Use ProtocolMainNetwork, not PrimitivesMainNetwork
            &seed,
            account_id,
        )
        .map_err(|e| format!("Failed to generate spending key: {:?}", e))?;

        // Step 7: Initialize the new wallet database (ensures schema is created)
        let _wallet_db = open_or_init_wallet_db(db_path)?;

        // Step 8: Derive a Unified Address from the spending key
        // Use default_address which automatically finds a valid diversifier
        let ufvk = usk.to_unified_full_viewing_key();
        // Use UnifiedAddressRequest::SHIELDED for Orchard+Sapling receivers
        let request = UnifiedAddressRequest::SHIELDED;
        let (ua, _diversifier_index) = ufvk.default_address(request)
            .map_err(|e| format!("Failed to generate default address: {:?}", e))?;

        // Step 9: Convert the Unified Address to a string format
        let address_string = ua.encode(&network_protocol());

        // Step 10: Convert seed to mnemonic phrase
        let seed_array: [u8; 32] = seed;
        let mnemonic: Mnemonic<English> = Mnemonic::from_entropy(&seed_array)
            .map_err(|e| format!("Failed to create mnemonic from seed: {:?}", e))?;
        let mnemonic_string = mnemonic.phrase().to_string();

        // Step 11: Return mnemonic and address
        Ok((mnemonic_string, address_string))
    }

    #[cfg(not(feature = "native"))]
    fn regenerate_wallet_quiet(&self) -> Result<(String, String), String> {
        // WASM stub - return dummy values
        Ok(("word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12".to_string(), "u1dummyaddressfornow".to_string()))
    }

    fn build_rotation_memo(&self, new_address: String) -> Result<(String, String), String> {
        // ============================================================
        // BUILD ROTATION MEMO FUNCTION
        // ============================================================
        // This function constructs a rotation memo string with format:
        // "ZROTv1|<new_address>|<unix_timestamp>"
        // ============================================================

        // Get current Unix timestamp
        #[cfg(feature = "native")]
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {:?}", e))?
            .as_secs();

        #[cfg(not(feature = "native"))]
        let timestamp = 0u64; // WASM stub - use 0 for timestamp

        let timestamp_string = timestamp.to_string();

        // Construct the rotation memo string
        let memo_string = format!("{}|{}|{}", ROTATE_MEMO_PREFIX, new_address, timestamp_string);

        Ok((memo_string, timestamp_string))
    }
}

fn default_db_path() -> String {
    "zcash_wallet.db".to_string()
}

#[wasm_bindgen]
pub fn init_new_wallet() -> String {
    // Create a WalletCore instance with hard-coded lightwalletd URL
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Initialize the wallet (creates DB, generates seed, creates account, derives address)
    match wallet.init_new_wallet() {
        Ok(status) => status,
        Err(e) => format!("error: {}", e),
    }
}

#[wasm_bindgen]
pub fn get_backup_phrase() -> String {
    // Create a WalletCore instance with hard-coded lightwalletd URL
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Get the backup phrase from the wallet database
    match wallet.get_backup_phrase() {
        Ok(phrase) => phrase,
        Err(e) => format!("error: {}", e),
    }
}

#[wasm_bindgen]
pub fn send_message_dm(to_address: String, text: String) -> JsValue {
    // ============================================================
    // WASM-BINDGEN FUNCTION: send_message_dm()
    // ============================================================
    // This function builds and signs a shielded Zcash transaction
    // with a message in the memo field, and returns the raw transaction
    // as hex along with the txid. The backend will broadcast it.
    //
    // Returns JSON:
    //   Success: { "txHex": "<raw_hex>", "txid": "<txid_hex>" }
    //   Error: { "error": "<message>" }
    // ============================================================
    
    // Create a WalletCore instance with hard-coded lightwalletd URL
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Build the transaction (does not broadcast)
    match wallet.build_message_tx(to_address, text) {
        Ok((tx_hex, txid_hex)) => {
            // Success: return JSON object with txHex and txid
            let result = serde_json::json!({
                "txHex": tx_hex,
                "txid": txid_hex
            });
            let json_string = serde_json::to_string(&result)
                .unwrap_or_else(|_| r#"{"error":"Failed to serialize result"}"#.to_string());
            js_sys::JSON::parse(&json_string)
                .unwrap_or_else(|_| js_sys::JSON::parse(r#"{"error":"Failed to parse result"}"#).unwrap())
        }
        Err(e) => {
            // Error: return JSON object with error message
            let error_json = serde_json::json!({ "error": e });
            let json_string = serde_json::to_string(&error_json)
                .unwrap_or_else(|_| r#"{"error":"Failed to serialize error"}"#.to_string());
            js_sys::JSON::parse(&json_string)
                .unwrap_or_else(|_| js_sys::JSON::parse(r#"{"error":"Failed to parse error"}"#).unwrap())
        }
    }
}

#[wasm_bindgen]
pub fn get_primary_address() -> String {
    // Create a WalletCore instance with hard-coded lightwalletd URL
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Get the primary unified address from the wallet database
    match wallet.get_primary_address() {
        Ok(address) => address,
        Err(e) => format!("error: {}", e),
    }
}

#[wasm_bindgen]
pub fn get_balance() -> String {
    // ============================================================
    // WASM-BINDGEN FUNCTION: get_balance()
    // ============================================================
    // This function is exposed to JavaScript/TypeScript code
    // It returns the wallet's confirmed balance in zatoshis
    //
    // How to use from JavaScript:
    //   const balance = walletCore.get_balance();
    //   if (balance.startsWith("error:")) {
    //     console.error("Failed to get balance:", balance);
    //   } else {
    //     console.log("Balance:", balance, "zatoshis");
    //     // Convert to ZEC: balance / 100000000
    //   }
    // ============================================================
    
    // Step 1: Create a WalletCore instance
    // We use the same LIGHTWALLETD_URL constant that all other functions use
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Step 2: Call the internal get_balance() method
    // This opens the database and retrieves the balance for account 0
    match wallet.get_balance() {
        // Success case: convert the u64 balance to a decimal string
        // u64 is an unsigned 64-bit integer (can hold very large numbers)
        // We convert it to a string so JavaScript can handle it
        Ok(balance) => balance.to_string(),
        
        // Error case: return "error: <message>" so JavaScript can detect the error
        Err(e) => format!("error: {}", e),
    }
}

#[wasm_bindgen]
pub fn sync_wallet() -> String {
    // ============================================================
    // WASM-BINDGEN FUNCTION: sync_wallet()
    // ============================================================
    // This function is exposed to JavaScript/TypeScript code
    // It allows the frontend to trigger a wallet synchronization
    //
    // How to use from JavaScript:
    //   const result = walletCore.sync_wallet();
    //   if (result === "ok") {
    //     console.log("Sync successful!");
    //   } else {
    //     console.error("Sync failed:", result);
    //   }
    // ============================================================
    
    // Step 1: Create a WalletCore instance
    // We use the same LIGHTWALLETD_URL constant that all other functions use
    // This ensures consistency - all wallet operations use the same server
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Step 2: Call the internal sync() method
    // This does all the actual work: opening DB, connecting to server, downloading blocks, etc.
    // The sync() method returns Result<(), String>:
    //   - Ok(()) means success (the () means "no return value, just success")
    //   - Err(String) means failure, with an error message
    match wallet.sync() {
        // Success case: return "ok" so JavaScript knows it worked
        Ok(_) => "ok".to_string(),
        
        // Error case: return "error: <message>" so JavaScript can display the error
        // The format "error: ..." makes it easy to check if there was an error
        Err(e) => format!("error: {}", e),
    }
}

#[wasm_bindgen]
pub fn get_lightwalletd_url() -> String {
    LIGHTWALLETD_URL.to_string()
}

#[wasm_bindgen]
pub fn get_network_name() -> String {
    // Return "main" or "test" depending on the network.
    // For now, hard-code "main" since we are using mainnet parameters.
    "main".to_string()
}

#[wasm_bindgen]
pub fn list_messages() -> JsValue {
    // ============================================================
    // WASM-BINDGEN FUNCTION: list_messages()
    // ============================================================
    // This function is exposed to JavaScript/TypeScript code
    // It returns all messages found in transaction memos as a JSON array
    //
    // How to use from JavaScript:
    //   const messagesJson = walletCore.list_messages();
    //   const messages = JSON.parse(messagesJson);
    //   messages.forEach(msg => {
    //     console.log(`Message from ${msg.from_address}: ${msg.text}`);
    //   });
    // ============================================================
    
    // Step 1: Create a WalletCore instance
    // We use the same LIGHTWALLETD_URL constant that all other functions use
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Step 2: Call the internal list_messages() method
    // This scans all transactions, finds memos with "ZMSGv1|" format,
    // parses them, and returns a Vec<Message>
    match wallet.list_messages(None) {
        Ok(messages) => {
            // Step 3: Serialize Vec<Message> to JSON
            // serde_json::to_string() converts our Rust structs to a JSON string
            // This is needed because JavaScript can't directly understand Rust types
            match serde_json::to_string(&messages) {
                Ok(json_string) => {
                    // Step 4: Parse JSON string to JsValue
                    // js_sys::JSON::parse() converts the JSON string to a JavaScript value
                    // This is what JavaScript will receive when it calls this function
                    js_sys::JSON::parse(&json_string)
                        .unwrap_or_else(|_| {
                            // If parsing fails, return an empty array as fallback
                            js_sys::JSON::parse("[]").unwrap()
                        })
                }
                Err(e) => {
                    // Step 5: Handle serialization errors
                    // If we can't convert the messages to JSON, return an error object
                    let error_json = serde_json::json!({ "error": format!("Serialization error: {}", e) });
                    let json_string = serde_json::to_string(&error_json).unwrap();
                    js_sys::JSON::parse(&json_string).unwrap()
                }
            }
        }
        Err(e) => {
            // Step 6: Handle errors from list_messages()
            // If the function itself fails (e.g., database error), return an error object
            let error_json = serde_json::json!({ "error": e });
            let json_string = serde_json::to_string(&error_json).unwrap();
            js_sys::JSON::parse(&json_string).unwrap()
        }
    }
}

#[wasm_bindgen]
pub fn regenerate_wallet_quiet() -> JsValue {
    // ============================================================
    // WASM-BINDGEN FUNCTION: regenerate_wallet_quiet()
    // ============================================================
    // This function regenerates the wallet by wiping the existing
    // database and creating a new wallet with a new seed and address.
    // It returns the mnemonic phrase and new address as JSON.
    //
    // Returns JSON:
    //   Success: { "seed": "<mnemonic>", "address": "<new_ua>" }
    //   Error: { "error": "<message>" }
    // ============================================================
    
    // Create a WalletCore instance with hard-coded lightwalletd URL
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());
    
    // Regenerate the wallet (wipes old DB, creates new seed and address)
    match wallet.regenerate_wallet_quiet() {
        Ok((seed, address)) => {
            // Success: return JSON object with seed and address
            let result = serde_json::json!({
                "seed": seed,
                "address": address
            });
            let json_string = serde_json::to_string(&result)
                .unwrap_or_else(|_| r#"{"error":"Failed to serialize result"}"#.to_string());
            js_sys::JSON::parse(&json_string)
                .unwrap_or_else(|_| js_sys::JSON::parse(r#"{"error":"Failed to parse result"}"#).unwrap())
        }
        Err(e) => {
            // Error: return JSON object with error message
            let error_json = serde_json::json!({ "error": e });
            let json_string = serde_json::to_string(&error_json).unwrap();
            js_sys::JSON::parse(&json_string).unwrap()
        }
    }
}

#[wasm_bindgen]
pub fn build_rotation_memo(new_address: String) -> String {
    // ============================================================
    // WASM-BINDGEN FUNCTION: build_rotation_memo()
    // ============================================================
    // This function constructs a rotation memo string with format:
    // "ZROTv1|<new_address>|<unix_timestamp>"
    //
    // How to use from JavaScript:
    //   const memo = walletCore.build_rotation_memo("u1newaddress...");
    //   console.log("Rotation memo:", memo); // "ZROTv1|u1newaddress...|1234567890"
    // ============================================================

    // Create a WalletCore instance
    let wallet = WalletCore::new(LIGHTWALLETD_URL.to_string());

    // Build the rotation memo
    match wallet.build_rotation_memo(new_address) {
        Ok((memo_string, _timestamp_string)) => {
            // Return the memo string
            memo_string
        }
        Err(e) => {
            // Return error string
            format!("error: {}", e)
        }
    }
}

// ============================================================
// CLIENT-SIDE WALLET FUNCTIONS (Work in WASM - no network/file I/O)
// ============================================================

// Note: bip0039, zcash_keys, and zip32 imports are at the top of the file

/// Generate a new 24-word mnemonic phrase
/// This runs entirely in the browser - seed never leaves the client
#[wasm_bindgen]
pub fn generate_mnemonic() -> String {
    use rand::RngCore;

    // Generate 32 bytes (256 bits) of random entropy
    let mut entropy = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut entropy);

    // Create BIP39 mnemonic from entropy
    match Mnemonic::<English>::from_entropy(&entropy) {
        Ok(mnemonic) => mnemonic.phrase().to_string(),
        Err(e) => format!("error: Failed to generate mnemonic: {:?}", e),
    }
}

/// Derive a Zcash unified address from a mnemonic phrase
/// This runs entirely in the browser - seed never leaves the client
#[wasm_bindgen]
pub fn derive_address_from_mnemonic(mnemonic_phrase: String, account_index: u32) -> String {
    // Parse the mnemonic phrase
    let mnemonic: Mnemonic<English> = match Mnemonic::from_phrase(&mnemonic_phrase) {
        Ok(m) => m,
        Err(e) => return format!("error: Invalid mnemonic phrase: {:?}", e),
    };

    // Derive seed from mnemonic (no passphrase)
    let seed_bytes = mnemonic.to_seed("");
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&seed_bytes[..32]);

    // Create account ID
    let account_id = match AccountId::try_from(account_index) {
        Ok(id) => id,
        Err(e) => return format!("error: Invalid account index: {:?}", e),
    };

    // Derive Unified Spending Key from seed
    use zcash_protocol::consensus::MainNetwork;
    let usk = match UnifiedSpendingKey::from_seed(&MainNetwork, &seed, account_id) {
        Ok(key) => key,
        Err(e) => return format!("error: Failed to derive spending key: {:?}", e),
    };

    // Get the Unified Full Viewing Key
    let ufvk = usk.to_unified_full_viewing_key();

    // Generate default unified address (Orchard + Sapling receivers)
    let request = UnifiedAddressRequest::SHIELDED;
    match ufvk.default_address(request) {
        Ok((ua, _diversifier_index)) => {
            // Encode the address for mainnet
            ua.encode(&MainNetwork)
        }
        Err(e) => format!("error: Failed to generate address: {:?}", e),
    }
}

/// Validate a mnemonic phrase (check if it's valid BIP39)
#[wasm_bindgen]
pub fn validate_mnemonic(mnemonic_phrase: String) -> bool {
    Mnemonic::<English>::from_phrase(&mnemonic_phrase).is_ok()
}

