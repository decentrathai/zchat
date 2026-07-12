// Central site constants for the ZCHAT landing page.
// Direct, frictionless APK distribution — no email, no account, no waitlist.

/** Direct download of the latest signed release APK from GitHub. */
export const APK_DOWNLOAD_URL =
  "https://github.com/decentrathai/zchat-android/releases/latest/download/ZChat.apk"

/** Landing page for the latest GitHub release (all assets + per-release checksums). */
export const GITHUB_RELEASES_URL =
  "https://github.com/decentrathai/zchat-android/releases/latest"

/** Current shipped APK version. */
export const APK_VERSION = "2.12.4"

/**
 * Permanent SHA-256 fingerprint of ZCHAT's dedicated release signing certificate.
 * This value never changes between versions — verify it before installing.
 */
export const SIGNING_CERT_SHA256 =
  "F1:7A:F1:28:23:CA:20:8B:63:2E:29:81:38:B7:89:13:74:F6:65:17:C8:9D:BF:BE:12:FC:3A:C3:65:01:C8:06"

/** Command to verify the APK signature and print its certificate digests. */
export const APKSIGNER_VERIFY_CMD = "apksigner verify --print-certs -v ZChat.apk"
