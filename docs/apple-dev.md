# Apple Developer Account & macOS Code Signing

This guide covers enrolling in the Apple Developer Program, creating a
Developer ID certificate, and extending the GitHub Actions workflow so that
release builds are signed and notarized — removing the Gatekeeper warning for
anyone who downloads the binary.

---

## 1. Enroll in the Apple Developer Program

The Developer ID certificate that silences Gatekeeper requires a paid
**Apple Developer Program** membership.

1. Go to <https://developer.apple.com/programs/enroll/> and sign in with your
   Apple ID (create one first at appleid.apple.com if needed).
2. Choose **Enroll as an Individual** (personal projects) or **Organization**
   (company name appears in Gatekeeper dialogs, requires a DUNS number).
3. Complete the identity verification and pay the **USD 99/year** fee.
4. Membership is approved immediately for individuals; organizations may take
   a few days for the DUNS check.

> You only need one membership regardless of how many apps or tools you
> distribute — the certificate covers everything under your Apple ID.

---

## 2. Create a Developer ID Application Certificate

A *Developer ID Application* certificate is the type used for signing
command-line tools and apps distributed outside the Mac App Store.

### In Xcode (easiest)

1. Open **Xcode → Settings → Accounts**.
2. Select your Apple ID and click **Manage Certificates…**.
3. Click **+** → **Developer ID Application**.
4. Xcode generates a key pair, sends a CSR to Apple, and installs the signed
   certificate into your login Keychain automatically.

### On developer.apple.com (without Xcode)

1. Go to <https://developer.apple.com/account/resources/certificates/list>.
2. Click **+**, choose **Developer ID Application**, and follow the CSR
   instructions (Keychain Access → Certificate Assistant → Request a
   Certificate From a Certificate Authority…).
3. Upload the `.certSigningRequest` file, download the issued certificate, and
   double-click it to install into Keychain.

---

## 3. Export the Certificate as a .p12 File

CI runners have no access to your Keychain, so you export the certificate and
its private key as a password-protected `.p12` bundle.

1. Open **Keychain Access** → **My Certificates**.
2. Find **Developer ID Application: Your Name (TEAMID)**.
3. Expand the row — confirm it shows the private key below it.
4. Right-click the certificate (not the key) → **Export…**
5. Choose format **Personal Information Exchange (.p12)**, save as
   `DeveloperIDApplication.p12`.
6. Set a strong export password — you'll need it in the next step.

Base64-encode the file for storage as a GitHub secret:

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy   # copies to clipboard (macOS)
```

---

## 4. Create an App-Specific Password for Notarization

Notarization uses `xcrun notarytool`, which authenticates with your Apple ID.
You cannot use your Apple ID password directly in CI — create an
app-specific password instead.

1. Go to <https://appleid.apple.com/account/manage> → **Sign-In and Security →
   App-Specific Passwords**.
2. Click **+**, name it something like `tiki100-ci`, and note the generated
   password (format: `xxxx-xxxx-xxxx-xxxx`).

---

## 5. Find Your Team ID

Your 10-character Team ID appears in the Developer portal:

- <https://developer.apple.com/account> → scroll to **Membership details** →
  **Team ID** (e.g. `ABCDE12345`).

---

## 6. Add GitHub Secrets

In your repository go to **Settings → Secrets and variables → Actions → New
repository secret** and add:

| Secret name | Value |
|-------------|-------|
| `APPLE_CERTIFICATE_P12_BASE64` | Base64-encoded `.p12` content (from step 3) |
| `APPLE_CERTIFICATE_PASSWORD` | Export password you set in step 3 |
| `APPLE_ID` | Your Apple ID email address |
| `APPLE_ID_PASSWORD` | App-specific password from step 4 |
| `APPLE_TEAM_ID` | 10-character Team ID from step 5 |

---

## 7. Extended macOS Build Job

Replace the `build-macos` job in `.github/workflows/release.yml` with the
version below. The new steps import the certificate, sign the binary, submit it
for notarization, and wait for Apple to approve it before packaging.

```yaml
build-macos:
  name: Build macOS ${{ matrix.arch }}
  runs-on: ${{ matrix.runner }}
  strategy:
    fail-fast: false
    matrix:
      include:
        - arch: arm64
          runner: macos-latest    # Apple Silicon (any M-series)
        - arch: x64
          runner: macos-13        # Intel

  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Install SDL2
      run: brew install sdl2

    - name: Build release binary
      run: make release

    # ── Signing & notarization ──────────────────────────────────────────────
    - name: Import Developer ID certificate
      env:
        P12_BASE64:  ${{ secrets.APPLE_CERTIFICATE_P12_BASE64 }}
        P12_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
      run: |
        # Write the .p12 to a temp file
        echo "$P12_BASE64" | base64 --decode -o /tmp/cert.p12

        # Create a temporary keychain so the cert doesn't pollute the login one
        KEYCHAIN_PASSWORD=$(uuidgen)
        security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
        security set-keychain-settings -lut 21600 build.keychain
        security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain

        # Import the cert + private key
        security import /tmp/cert.p12 \
          -k build.keychain \
          -P "$P12_PASSWORD" \
          -T /usr/bin/codesign \
          -T /usr/bin/security
        security set-key-partition-list \
          -S apple-tool:,apple: \
          -s -k "$KEYCHAIN_PASSWORD" build.keychain

        # Make this the default search keychain so codesign finds it
        security list-keychains -d user -s build.keychain "$(security list-keychains -d user | sed s/\"//g)"
        rm /tmp/cert.p12

    - name: Sign binary
      env:
        APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      run: |
        codesign \
          --sign "Developer ID Application: $APPLE_TEAM_ID" \
          --options runtime \
          --timestamp \
          --force \
          build_release/bin/tiki100

    - name: Notarize binary
      env:
        APPLE_ID:          ${{ secrets.APPLE_ID }}
        APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
        APPLE_TEAM_ID:     ${{ secrets.APPLE_TEAM_ID }}
      run: |
        # Notarytool requires a zip or dmg — not a bare binary
        ditto -c -k --keepParent build_release/bin/tiki100 /tmp/tiki100-notarize.zip

        xcrun notarytool submit /tmp/tiki100-notarize.zip \
          --apple-id    "$APPLE_ID" \
          --password    "$APPLE_ID_PASSWORD" \
          --team-id     "$APPLE_TEAM_ID" \
          --wait

        rm /tmp/tiki100-notarize.zip

    # ── Package ──────────────────────────────────────────────────────────────
    - name: Stage release artifacts
      run: |
        set -e
        STAGE="dist/tiki100-macos-${{ matrix.arch }}"
        mkdir -p "$STAGE"
        cp build_release/bin/tiki100 "$STAGE/"
        mkdir -p "$STAGE/rom"
        cp rom/tikirom-*   "$STAGE/rom/"  2>/dev/null || true
        cp rom/roms.json   "$STAGE/rom/"  2>/dev/null || true
        mkdir -p "$STAGE/disks/boot"
        cp -r disks/boot/. "$STAGE/disks/boot/" 2>/dev/null || true
        cp README.md       "$STAGE/"      2>/dev/null || true

    - name: Create archive
      run: |
        cd dist
        tar czf "tiki100-macos-${{ matrix.arch }}.tar.gz" \
          "tiki100-macos-${{ matrix.arch }}"

    - name: Upload artifact
      uses: actions/upload-artifact@v4
      with:
        name: tiki100-macos-${{ matrix.arch }}
        path: dist/tiki100-macos-${{ matrix.arch }}.tar.gz
        if-no-files-found: error
```

### What each new step does

| Step | What it does |
|------|-------------|
| **Import Developer ID certificate** | Decodes the `.p12`, creates a temporary keychain for this CI run, and imports the cert+key so `codesign` can find it. The temporary keychain is discarded when the runner is cleaned up. |
| **Sign binary** | Runs `codesign` with `--options runtime` (required for notarization) and `--timestamp` (embeds an Apple-issued timestamp so the signature remains valid after the certificate expires). |
| **Notarize binary** | Zips the binary, submits it to Apple's notarization service, and waits (usually 1–5 minutes) for approval. `--wait` blocks the step until Apple responds; a failure here means the binary was rejected (commonly because it wasn't signed with `--options runtime`). |
| **Stage / archive** | Same as before — the signed binary ends up in the `.tar.gz`. |

---

## 8. Verifying Locally Before CI

After building, you can confirm signing looks correct:

```bash
# Check signature and hardened runtime flag
codesign --display --verbose=4 build_release/bin/tiki100

# Simulate what Gatekeeper does
spctl --assess --type execute --verbose build_release/bin/tiki100
# Expected: "source=Developer ID" or "accepted"
```

To test notarization status of a downloaded binary:

```bash
spctl --assess --type execute --verbose /path/to/downloaded/tiki100
# After successful notarization: "source=Notarized Developer ID"
```

---

## 9. FAQ

**Do I need to sign to distribute at all?**
No. Users can always bypass Gatekeeper with `xattr -d com.apple.quarantine tiki100` or
right-click → Open. Signing just removes that friction.

**Does the $99/year membership renew automatically?**
Yes. Cancel auto-renewal at appleid.apple.com if you want it to lapse.

**What if my certificate expires?**
Binaries signed with `--timestamp` remain valid even after the certificate
expires — the embedded timestamp proves the binary was signed while the cert
was still valid. Renew the certificate and re-sign/re-notarize for new releases.

**Can I use a free Apple ID without the developer program?**
You can sign ad-hoc (`codesign --sign -`), which passes `codesign --verify` locally,
but Gatekeeper will still block downloaded binaries unless they're notarized — and
notarization requires a paid membership.

**Is a `.dmg` better than a `.tar.gz` for distribution?**
A `.dmg` is more familiar for desktop apps and allows stapling the notarization
ticket (so Gatekeeper works offline). For a command-line emulator, a `.tar.gz`
is fine — Gatekeeper does an online check the first time the binary is run.
