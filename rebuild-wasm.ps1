# Script to rebuild WASM and copy to web app
# Run this from the zcash-chat root directory

Write-Host "Building WASM module..." -ForegroundColor Green
Set-Location "packages\wallet-core"
$env:CARGO_TARGET_DIR="C:\temp\rust-build"
wasm-pack build --target web --out-dir pkg
if ($LASTEXITCODE -ne 0) {
    Write-Host "WASM build failed!" -ForegroundColor Red
    Set-Location ..\..
    exit 1
}

Write-Host "Copying WASM files to web app..." -ForegroundColor Green
Set-Location ..\..
Copy-Item -Path "packages\wallet-core\pkg\*" -Destination "apps\web\public\wallet-core\pkg\" -Recurse -Force

Write-Host "Done! WASM files updated." -ForegroundColor Green

