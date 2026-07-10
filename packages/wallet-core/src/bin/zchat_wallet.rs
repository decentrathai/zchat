use std::path::PathBuf;

use clap::{Parser, Subcommand};
use serde_json;

// Adjust this to the actual module name in src/lib.rs
use wallet_core::WalletCore;

#[derive(Parser)]
#[command(author, version, about)]
struct Cli {
    /// Path to wallet database directory
    #[arg(long)]
    db_path: PathBuf,

    /// Lightwalletd URL, e.g. http://127.0.0.1:9067
    #[arg(long)]
    lightwalletd: String,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize a new wallet and print the seed phrase
    Init {
        /// Optional birthday height (defaults to current chain tip)
        #[arg(long)]
        birthday: Option<u64>,
    },

    /// Import a wallet from a mnemonic seed phrase.
    /// Prefer `--from-stdin` — passing the mnemonic via --mnemonic leaks it through
    /// `ps -ef` / `/proc/<pid>/cmdline` to every other process on the host.
    Import {
        /// The 24-word BIP39 mnemonic seed phrase (INSECURE — visible to ps;
        /// use --from-stdin in production).
        #[arg(long, conflicts_with = "from_stdin")]
        mnemonic: Option<String>,
        /// Read the mnemonic from stdin instead of argv.
        #[arg(long, conflicts_with = "mnemonic")]
        from_stdin: bool,
        /// Optional birthday height (defaults to current chain tip)
        #[arg(long)]
        birthday: Option<u64>,
    },

    /// Print the primary Unified Address
    Address,

    /// Print the 24-word seed phrase (mnemonic)
    Seed,

    /// Print the balance in zatoshis
    Balance,

    /// Sync the wallet with lightwalletd
    Sync,

    /// Send a transaction with a memo
    Send {
        /// Recipient Unified Address
        to: String,
        /// Amount in zatoshis (1e-8 ZEC)
        amount: u64,
        /// Memo text (our chat message)
        memo: String,
    },
    /// List messages from transactions
    Messages {
        /// Optional: only show messages since this block height
        #[arg(long)]
        since_height: Option<u32>,
    },
    /// Debug command to introspect notes in the wallet
    DebugNotes,
    /// Debug command to show sync state and statistics
    DebugSync,
    /// Debug command to show database schema
    DebugDb,
    /// Truncate the wallet's scanned state back to a given height (chain-reorg recovery).
    /// Wipes all notes/blocks above this height so the next sync re-scans from there.
    TruncateTo {
        /// Height to truncate to (inclusive — blocks above this height are removed)
        height: u32,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let db_path = cli.db_path.to_string_lossy().to_string();

    // Create WalletCore instance with the provided paths
    let wallet = WalletCore::new_with_path(db_path.clone(), cli.lightwalletd);

    match cli.command {
        Command::Init { birthday } => {
            let result = wallet.init_new_wallet_at_height(birthday)
                .map_err(|e| anyhow::anyhow!("Failed to initialize wallet: {}", e))?;
            println!("{}", result);
        }
        Command::Import { mnemonic, from_stdin, birthday } => {
            // Resolve the mnemonic: either argv (legacy, leaks via ps) or stdin (preferred).
            let mnemonic = if from_stdin {
                use std::io::Read;
                let mut buf = String::new();
                std::io::stdin().read_to_string(&mut buf)
                    .map_err(|e| anyhow::anyhow!("Failed to read mnemonic from stdin: {}", e))?;
                buf
            } else {
                mnemonic.ok_or_else(|| anyhow::anyhow!("Must supply --mnemonic or --from-stdin"))?
            };
            // Write the mnemonic to the .mnemonic file so init can find it
            let mnemonic_file_path = format!("{}.mnemonic", db_path);

            // Check if wallet already exists
            if std::path::Path::new(&mnemonic_file_path).exists() {
                let output = serde_json::json!({
                    "error": "wallet-already-exists"
                });
                println!("{}", serde_json::to_string(&output).unwrap());
                return Ok(());
            }

            // 0600 perms — mnemonic on disk is wallet-equivalent secret.
            #[cfg(unix)]
            {
                use std::io::Write;
                use std::os::unix::fs::OpenOptionsExt;
                let mut f = std::fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .mode(0o600)
                    .open(&mnemonic_file_path)
                    .map_err(|e| anyhow::anyhow!("Failed to write mnemonic file: {}", e))?;
                f.write_all(mnemonic.trim().as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to write mnemonic file: {}", e))?;
                f.sync_all()
                    .map_err(|e| anyhow::anyhow!("Failed to flush mnemonic file: {}", e))?;
            }
            #[cfg(not(unix))]
            std::fs::write(&mnemonic_file_path, mnemonic.trim())
                .map_err(|e| anyhow::anyhow!("Failed to write mnemonic file: {}", e))?;

            // Now initialize the wallet - it will pick up the mnemonic file
            let result = wallet.init_new_wallet_at_height(birthday)
                .map_err(|e| anyhow::anyhow!("Failed to initialize wallet from mnemonic: {}", e))?;

            // Parse the result to get the address and return as JSON
            if result.starts_with("wallet-initialized:") {
                let address = result.strip_prefix("wallet-initialized:").unwrap().trim();
                let output = serde_json::json!({
                    "address": address
                });
                println!("{}", serde_json::to_string(&output).unwrap());
            } else {
                let output = serde_json::json!({
                    "error": result
                });
                println!("{}", serde_json::to_string(&output).unwrap());
            }
        }
        Command::Address => {
            let addr = wallet.primary_address()
                .map_err(|e| anyhow::anyhow!("Failed to get address: {}", e))?;
            println!("{}", addr);
        }
        Command::Seed => {
            let phrase = wallet.backup_phrase()
                .map_err(|e| anyhow::anyhow!("Failed to get seed phrase: {}", e))?;
            println!("{}", phrase);
        }
        Command::Balance => {
            let bal = wallet.balance_zat()
                .map_err(|e| anyhow::anyhow!("Failed to get balance: {}", e))?;
            // Output as JSON for easier parsing by backend
            let output = serde_json::json!({
                "balance_zatoshis": bal
            });
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Command::Sync => {
            // Sync returns Result<u64, String> with the synced height
            let synced_height = wallet.sync()
                .map_err(|e| anyhow::anyhow!("Failed to sync: {}", e))?;
            let output = serde_json::json!({
                "synced_to_height": synced_height
            });
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Command::Send { to, amount, memo } => {
            // Build transaction and output both txHex and txid as JSON for backend use
            let (tx_hex, txid) = wallet.build_transaction(&to, amount, &memo)
                .map_err(|e| anyhow::anyhow!("Failed to build transaction: {}", e))?;
            
            // Output as JSON for easier parsing by backend
            let output = serde_json::json!({
                "txHex": tx_hex,
                "txid": txid
            });
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Command::Messages { since_height } => {
            // List messages from transactions
            let messages = wallet.list_messages(since_height.map(|h| h as u32))
                .map_err(|e| anyhow::anyhow!("Failed to list messages: {}", e))?;
            
            // Output as JSON array
            let output = serde_json::json!({
                "messages": messages
            });
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Command::DebugNotes => {
            // Debug command to introspect notes
            let notes_info = wallet.debug_notes()
                .map_err(|e| anyhow::anyhow!("Failed to get notes info: {}", e))?;
            
            // Output as JSON
            println!("{}", serde_json::to_string(&notes_info).unwrap());
        }
        Command::DebugSync => {
            // Debug command to show sync state
            let sync_info = wallet.debug_sync()
                .map_err(|e| anyhow::anyhow!("Failed to get sync info: {}", e))?;
            
            // Output as JSON
            println!("{}", serde_json::to_string(&sync_info).unwrap());
        }
        Command::DebugDb => {
            // Debug command to show database schema
            let db_info = wallet.debug_db()
                .map_err(|e| anyhow::anyhow!("Failed to get database info: {}", e))?;

            // Output as JSON (pretty print for readability)
            println!("{}", serde_json::to_string_pretty(&db_info).unwrap());
        }
        Command::TruncateTo { height } => {
            let truncated_to = wallet.truncate_to_height(height)
                .map_err(|e| anyhow::anyhow!("Failed to truncate wallet: {}", e))?;
            let output = serde_json::json!({
                "truncated_to_height": truncated_to
            });
            println!("{}", serde_json::to_string(&output).unwrap());
        }
    }

    Ok(())
}
