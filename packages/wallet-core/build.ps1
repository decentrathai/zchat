# PowerShell script to build WASM with workaround for paths with special characters
$env:CARGO_TARGET_DIR="C:\temp\rust-build"
wasm-pack build --target web --out-dir pkg

