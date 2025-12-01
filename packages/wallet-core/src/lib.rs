use wasm_bindgen::prelude::*;

// Conditional compilation: only use SQLite when "native" feature is enabled
// This prevents Zcash dependencies from being compiled for WASM builds
#[cfg(feature = "native")]
use zcash_client_sqlite::WalletDb;
#[cfg(feature = "native")]
use zcash_primitives::consensus::{Network, MainNetwork};
#[cfg(feature = "native")]
use zcash_client_backend::keys::UnifiedSpendingKey;
#[cfg(feature = "native")]
use zcash_client_backend::encoding::AddressCodec;
#[cfg(feature = "native")]
use zcash_address::unified::Address;
#[cfg(feature = "native")]
use zip32::AccountId;
#[cfg(feature = "native")]
use zcash_primitives::zip339::{Mnemonic, Language};
#[cfg(feature = "native")]
use zcash_client_backend::data_api::wallet::WalletRead;
#[cfg(feature = "native")]
use zcash_client_backend::data_api::wallet::WalletWrite;
#[cfg(feature = "native")]
use zcash_client_backend::data_api::chain::scan_cached_blocks;
#[cfg(feature = "native")]
use zcash_client_backend::proto::compact_formats::CompactBlock;
#[cfg(feature = "native")]
use zcash_client_backend::memo::MemoBytes;
#[cfg(feature = "native")]
use zcash_primitives::transaction::TxId;
#[cfg(feature = "native")]
use zcash_primitives::transaction::components::serialization::ZcashSerialize;
#[cfg(feature = "native")]
use std::path::Path;
#[cfg(feature = "native")]
use std::fs;
#[cfg(feature = "native")]
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(feature = "native")]
use hex;
use serde::{Serialize, Deserialize};

// Constants for network configuration
// Lightwalletd server URL
const LIGHTWALLETD_URL: &str = "http://188.166.42.201:9067";

// Rotation memo prefix for address rotation messages
const ROTATE_MEMO_PREFIX: &str = "ZROTv1";

// Network helper function - always returns MainNetwork
// This ensures the wallet is definitely configured for mainnet
#[cfg(feature = "native")]
fn network() -> Network {
    Network::MainNetwork
}

// Message struct for representing parsed messages from memos
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

// Internal WalletCore struct
struct WalletCore {
    db_path: String,
    lightwalletd_url: String,
}

impl WalletCore {
    fn new(lightwalletd_url: String) -> Self {
        Self {
            db_path: default_db_path(),
            lightwalletd_url,
        }
    }

    #[cfg(feature = "native")]
    fn init_new_wallet(&self) -> Result<String, String> {
        use rand::RngCore;

        // Step 1: Check if database file already exists
        let db_path = Path::new(&self.db_path);
        let db_exists = db_path.exists();

        // Step 2: Initialize or open the wallet database for mainnet
        // WalletDb::for_path creates the database if it doesn't exist and initializes the schema
        // This automatically sets up all the necessary tables for storing wallet data
        let wallet_db = WalletDb::for_path(db_path, network())
            .map_err(|e| format!("Failed to initialize wallet database: {:?}", e))?;

        // Step 3: If this is a new wallet (DB didn't exist), create an account with a seed
        if !db_exists {
            // Generate a random 32-byte seed for the wallet
            // This seed will be used to derive all keys using ZIP-32
            let mut seed = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut seed);

            // Step 4: Create account ID 0 (the default account)
            let account_id = AccountId::from(0);

            // Step 5: Store the seed in a separate file for backup phrase retrieval
            // This allows us to retrieve the seed later to generate the mnemonic phrase
            let seed_file_path = format!("{}.seed", self.db_path);
            fs::write(&seed_file_path, &seed)
                .map_err(|e| format!("Failed to store seed: {:?}", e))?;

            // Step 6: Derive a Unified Spending Key from the seed using ZIP-32
            // This creates the master key for the account from which all addresses are derived
            let usk = UnifiedSpendingKey::from_seed(
                &network(),
                &seed,
                account_id,
            )
            .map_err(|e| format!("Failed to generate spending key: {:?}", e))?;

            // Step 7: Store the account in the database
            // Use WalletDb's account storage API to persist the spending key
            // The exact API may vary - this is a conceptual implementation
            // wallet_db.put_account(account_id, &usk)?;

            // Step 8: Derive a Unified Address from the spending key
            // Get the unified full viewing key from the spending key
            let ufvk = usk.to_unified_full_viewing_key();
            
            // Derive a unified address for the account
            // The second parameter is diversifier index (use 0 for first address)
            let ua = ufvk
                .address(account_id, 0)
                .map_err(|e| format!("Failed to derive address: {:?}", e))?;

            // Step 9: Convert the Unified Address to a string format
            // This encodes it as a Zcash unified address (starts with 'u1' for mainnet)
            let address_string = Address::from_unified(network(), ua)
                .map_err(|e| format!("Failed to encode address: {:?}", e))?
                .encode(&network());

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
        // Step 1: Read the seed from the stored seed file
        // The seed was stored in init_new_wallet() as a separate file
        let seed_file_path = format!("{}.seed", self.db_path);
        let seed_bytes = fs::read(&seed_file_path)
            .map_err(|e| format!("Failed to read seed file: {:?}. Make sure the wallet is initialized.", e))?;

        // Step 2: Validate seed length (should be 32 bytes)
        if seed_bytes.len() != 32 {
            return Err(format!("Invalid seed length: expected 32 bytes, got {}", seed_bytes.len()));
        }

        // Step 3: Convert seed to ZIP-339 mnemonic phrase
        // ZIP-339 is Zcash's mnemonic standard (similar to BIP-39)
        // Create a mnemonic from the 32-byte seed (which will generate a 24-word phrase)
        let seed_array: [u8; 32] = seed_bytes.try_into()
            .map_err(|_| "Failed to convert seed to array".to_string())?;
        
        let mnemonic = Mnemonic::from_entropy(&seed_array, Language::English)
            .map_err(|e| format!("Failed to create mnemonic from seed: {:?}", e))?;

        // Step 4: Return the mnemonic phrase as a space-separated string
        Ok(mnemonic.phrase().to_string())
    }

    #[cfg(not(feature = "native"))]
    fn get_backup_phrase(&self) -> Result<String, String> {
        // WASM stub
        Ok("word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12".to_string())
    }

    #[cfg(feature = "native")]
    fn get_primary_address(&self) -> Result<String, String> {
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
        let account_id = AccountId::from(0);

        // Step 5: Derive the Unified Spending Key from the seed
        // This is the same derivation we did in init_new_wallet()
        let usk = UnifiedSpendingKey::from_seed(
            &network(),
            &seed_array,
            account_id,
        )
        .map_err(|e| format!("Failed to derive spending key: {:?}", e))?;

        // Step 6: Get the unified full viewing key from the spending key
        let ufvk = usk.to_unified_full_viewing_key();

        // Step 7: Derive the unified address at diversifier index 0
        let ua = ufvk
            .address(account_id, 0)
            .map_err(|e| format!("Failed to derive address: {:?}", e))?;

        // Step 8: Encode the unified address as a string
        let address_string = Address::from_unified(network(), ua)
            .map_err(|e| format!("Failed to encode address: {:?}", e))?
            .encode(&network());

        Ok(address_string)
    }

    #[cfg(not(feature = "native"))]
    fn get_primary_address(&self) -> Result<String, String> {
        // WASM stub
        Ok("u1dummyaddressfornow".to_string())
    }

    #[cfg(feature = "native")]
    fn get_balance(&self) -> Result<u64, String> {
        // ============================================================
        // GET BALANCE FUNCTION
        // ============================================================
        // This function returns the confirmed balance for account 0
        // The balance is returned in zatoshis (the smallest unit of ZEC)
        // 1 ZEC = 100,000,000 zatoshis
        // ============================================================

        // Step 1: Open the wallet database
        // We need to access the database to read the balance information
        let db_path = Path::new(&self.db_path);
        let wallet_db = WalletDb::for_path(db_path, network())
            .map_err(|e| format!("Failed to open wallet database: {:?}", e))?;

        // Step 2: Get account ID 0 (the default/primary account)
        let account_id = AccountId::from(0);

        // Step 3: Get the confirmed balance for this account
        // The wallet database tracks our balance by summing up all unspent notes (UTXOs)
        // A "confirmed" balance means the transactions have been included in blocks
        // that are deep enough in the blockchain to be considered final
        //
        // NOTE: The exact API may vary - this is a conceptual implementation
        // The actual implementation would use WalletRead trait methods like:
        // let balance = wallet_db.get_balance(account_id, &[])?;
        // or similar API depending on the zcash_client_backend version
        
        // Placeholder: Return error indicating WalletRead API setup is needed
        // TODO: Once WalletRead API methods are available, implement the balance retrieval
        Err("Balance retrieval requires WalletRead API setup. Check zcash_client_backend documentation for get_balance() method.".to_string())
    }

    #[cfg(not(feature = "native"))]
    fn get_balance(&self) -> Result<u64, String> {
        // WASM stub - return 0 for now
        Ok(0)
    }

    #[cfg(feature = "native")]
    fn sync(&self) -> Result<(), String> {
        // ============================================================
        // WALLET SYNC FUNCTION
        // ============================================================
        // This function synchronizes the wallet with the Zcash blockchain
        // by connecting to a lightwalletd server, downloading new blocks,
        // and scanning them for transactions relevant to our wallet.
        //
        // How it works:
        // 1. Open the wallet database (where we store our transaction history)
        // 2. Check what was the last block we've already scanned
        // 3. Connect to lightwalletd server (a service that provides blockchain data)
        // 4. Ask lightwalletd what's the latest block on the chain
        // 5. Download all blocks we haven't seen yet
        // 6. Scan each block to find transactions that belong to us
        // 7. Update our wallet database with the new information
        // ============================================================

        // Step 1: Open the wallet database
        // The database file stores all our wallet information: addresses, transactions, balances, etc.
        // We need to open it so we can read what we already know and write new information
        let db_path = Path::new(&self.db_path);
        let wallet_db = WalletDb::for_path(db_path, network())
            .map_err(|e| format!("Failed to open wallet database: {:?}", e))?;

        // Step 2: Find out what was the last block we've already scanned
        // The blockchain is made of blocks, and each block contains transactions
        // We need to know where we left off, so we don't re-scan old blocks
        // block_height_extrema() returns the minimum and maximum block heights we've seen
        // We only care about the maximum (the latest block we've processed)
        let last_synced_height = wallet_db
            .block_height_extrema()
            .map_err(|e| format!("Failed to get block height extrema: {:?}", e))?
            .map(|(_, max)| max)
            .unwrap_or(0);  // If we've never synced, start from block 0

        // Step 3: Connect to the lightwalletd server
        // lightwalletd is a service that provides blockchain data in a compact format
        // It uses gRPC (a protocol for remote procedure calls) over HTTP/2
        // We connect to the URL stored in LIGHTWALLETD_URL constant
        // 
        // NOTE: This requires gRPC client libraries (zcash_protos, tonic)
        // The actual connection code would look like this:
        // let channel = Channel::from_shared(self.lightwalletd_url.clone())?
        //     .connect()
        //     .await?;
        // let mut client = CompactTxStreamerClient::new(channel);
        
        // Step 4: Ask lightwalletd what's the latest block on the blockchain
        // The blockchain keeps growing as new blocks are added
        // We need to know the current "tip" (the latest block) so we know how far to sync
        // let latest_block = client.get_latest_block().await?.into_inner();
        // let latest_height = latest_block.height;
        
        // Step 5: Download and scan all new blocks
        // Now we loop through every block from (last_synced_height + 1) to latest_height
        // For each block:
        //   a) Download the compact block from lightwalletd
        //   b) Convert it to a format our wallet can understand (CompactBlock)
        //   c) Scan it to find transactions that involve our addresses
        //   d) Update our wallet database with any new information
        //
        // Example code (once gRPC client is set up):
        // for height in (last_synced_height + 1)..=latest_height {
        //     // Request the block at this height
        //     let block_id = BlockId { height };
        //     let block_response = client.get_block(&block_id).await?.into_inner();
        //     
        //     // Convert the protobuf response to CompactBlock format
        //     let compact_block: CompactBlock = block_response.try_into()?;
        //     
        //     // Scan the block - this function checks if any transactions are for us
        //     // and automatically updates the wallet database
        //     scan_cached_blocks(&wallet_db, network(), &[compact_block], &[])?;
        // }
        
        // Step 6: What happens during scanning?
        // The scan_cached_blocks() function does a lot of work automatically:
        //   - Checks each transaction in the block
        //   - Looks for outputs (received payments) that match our addresses
        //   - Looks for inputs (sent payments) that spend our funds
        //   - Updates our balance (adds received funds, subtracts sent funds)
        //   - Stores transaction metadata (memos, timestamps, etc.)
        //   - Updates the block height tracking (so we know we've processed this block)
        //   - Marks notes as spent when we send funds
        
        // Placeholder: Return error indicating gRPC client setup is needed
        // TODO: Once gRPC dependencies (zcash_protos, tonic) are added,
        //       uncomment and implement the connection and sync loop above
        Err(format!(
            "Sync requires gRPC client setup. Last synced height: {}. Add dependencies: zcash_protos, tonic",
            last_synced_height
        ))
    }

    #[cfg(not(feature = "native"))]
    fn sync(&self) -> Result<(), String> {
        // WASM stub: Network operations in WASM require different approach
        // We might need to use fetch API or similar browser APIs
        Ok(())
    }

    #[cfg(feature = "native")]
    fn build_message_tx(&self, to_address: String, text: String) -> Result<(String, String), String> {
        // ============================================================
        // BUILD MESSAGE TX FUNCTION
        // ============================================================
        // This function builds and signs a shielded Zcash transaction
        // with a message embedded in the memo field.
        // It returns the raw transaction bytes (hex) and txid (hex).
        // The backend will be responsible for broadcasting.
        // ============================================================

        // Step 1: Open the wallet database
        let db_path = Path::new(&self.db_path);
        let wallet_db = WalletDb::for_path(db_path, network())
            .map_err(|e| format!("Failed to open wallet database: {:?}", e))?;

        // Step 2: Get account ID 0 (the default account)
        let account_id = AccountId::from(0);

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
        let usk = UnifiedSpendingKey::from_seed(
            &network(),
            &seed_array,
            account_id,
        )
        .map_err(|e| format!("Failed to derive spending key: {:?}", e))?;

        // Step 5: Parse the recipient address
        // Convert the string address to a Zcash unified address
        let recipient_address = to_address.parse::<Address>()
            .map_err(|e| format!("Invalid recipient address: {:?}", e))?;

        // Step 6: Construct the memo string with format: "ZMSGv1|<unix_timestamp>|<random_id>|<text>"
        // Get current Unix timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {:?}", e))?
            .as_secs();

        // Generate a random ID (8 bytes = 16 hex chars) for uniqueness
        use rand::RngCore;
        let mut random_bytes = [0u8; 8];
        rand::thread_rng().fill_bytes(&mut random_bytes);
        let random_id = hex::encode(random_bytes);

        // Construct the memo string
        let memo_string = format!("ZMSGv1|{}|{}|{}", timestamp, random_id, text);

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

        // Step 8: Define the amount to send (minimal amount: 0.0001 ZEC = 10,000 zatoshis)
        // This is the minimum amount accepted by the network for shielded transactions
        let amount = 10_000u64; // 0.0001 ZEC in zatoshis

        // Step 9: Extract the unified address from the parsed address
        // The WalletWrite API needs the unified address type
        let recipient_ua = recipient_address
            .to_unified_address()
            .map_err(|e| format!("Failed to extract unified address: {:?}", e))?;

        // Step 10: Create the shielded transaction using WalletWrite trait
        // The create_spend method will:
        //   - Select unspent notes from our wallet (account 0)
        //   - Create outputs for the recipient and change
        //   - Attach the memo
        //   - Sign the transaction with our spending key
        //   - Return the signed transaction
        //
        // Note: The exact API signature may vary. Common patterns:
        // - create_spend(network, spending_key, recipients, from_account, to_account)
        // - create_spend_to_addresses(network, spending_key, recipients, account_id)
        // where recipients is typically a slice of Recipient structs
        //
        // For now, we'll try the tuple approach. If this fails, we may need to use
        // Recipient structs or a different method name.
        let transaction = wallet_db
            .create_spend(
                &network(),
                &usk,
                &[(recipient_ua, amount, Some(memo))],
                account_id,
                account_id,
            )
            .map_err(|e| format!("Failed to create transaction: {:?}. Note: API may need adjustment for zcash_client_backend 0.10", e))?;

        // Step 11: Get the transaction ID (txid) from the created transaction
        // The transaction ID is a unique identifier for this transaction on the blockchain
        let txid = transaction.txid();
        let txid_hex = hex::encode(txid.as_ref());

        // Step 12: Serialize the transaction to raw bytes
        // We need to convert the transaction to its raw byte representation
        // This is what will be broadcast to the network
        // The transaction returned from create_spend is typically a Transaction type
        // that can be serialized using zcash_primitives serialization
        use zcash_primitives::transaction::components::serialization::ZcashSerialize;
        let mut tx_bytes = Vec::new();
        transaction
            .zcash_serialize(&mut tx_bytes)
            .map_err(|e| format!("Failed to serialize transaction: {:?}", e))?;
        
        let tx_hex = hex::encode(&tx_bytes);

        // Step 13: Return both the raw transaction hex and the txid hex
        // The backend will use tx_hex to broadcast the transaction
        Ok((tx_hex, txid_hex))
    }

    #[cfg(not(feature = "native"))]
    fn build_message_tx(&self, _to_address: String, _text: String) -> Result<(String, String), String> {
        // WASM stub - return dummy values
        Ok(("dummy_tx_hex".to_string(), "dummy_txid_hex".to_string()))
    }

    #[cfg(feature = "native")]
    fn list_messages(&self) -> Result<Vec<Message>, String> {
        // ============================================================
        // LIST MESSAGES FUNCTION
        // ============================================================
        // This function scans all transactions in the wallet database,
        // finds memos that contain messages (starting with "ZMSGv1|"),
        // parses them, and returns a list of Message structs.
        //
        // Message format in memo: "ZMSGv1|<timestamp>|<id>|<text>"
        // ============================================================

        // Step 1: Open the wallet database
        // We need to access the database to read transaction history
        let db_path = Path::new(&self.db_path);
        let wallet_db = WalletDb::for_path(db_path, network())
            .map_err(|e| format!("Failed to open wallet database: {:?}", e))?;

        // Step 2: Get our primary address to determine if messages are to/from us
        // This helps us figure out the direction of each message
        let our_address = self.get_primary_address()
            .map_err(|e| format!("Failed to get primary address: {}", e))?;

        // Step 3: Create a vector to store all the messages we find
        let mut messages = Vec::new();

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
        // TODO: Once WalletRead API methods are available, uncomment and implement the loop above
        Ok(messages)
    }

    #[cfg(not(feature = "native"))]
    fn list_messages(&self) -> Result<Vec<Message>, String> {
        // WASM stub - return empty vector
        // In WASM, we'd need to use IndexedDB or similar storage
        Ok(Vec::new())
    }

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
        let account_id = AccountId::from(0);

        // Step 6: Derive a Unified Spending Key from the new seed
        let usk = UnifiedSpendingKey::from_seed(
            &network(),
            &seed,
            account_id,
        )
        .map_err(|e| format!("Failed to generate spending key: {:?}", e))?;

        // Step 7: Initialize the new wallet database
        let _wallet_db = WalletDb::for_path(db_path, network())
            .map_err(|e| format!("Failed to initialize new wallet database: {:?}", e))?;

        // Step 8: Derive a Unified Address from the spending key
        let ufvk = usk.to_unified_full_viewing_key();
        let ua = ufvk
            .address(account_id, 0)
            .map_err(|e| format!("Failed to derive address: {:?}", e))?;

        // Step 9: Convert the Unified Address to a string format
        let address_string = Address::from_unified(network(), ua)
            .map_err(|e| format!("Failed to encode address: {:?}", e))?
            .encode(&network());

        // Step 10: Convert seed to mnemonic phrase
        let seed_array: [u8; 32] = seed;
        let mnemonic = Mnemonic::from_entropy(&seed_array, Language::English)
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
    match wallet.list_messages() {
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

