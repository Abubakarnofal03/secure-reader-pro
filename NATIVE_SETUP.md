# Native Mobile Setup Guide

This document provides instructions for building the SecureReader app for Android and iOS with full security features.

## Prerequisites

- Node.js 18+
- Android Studio (for Android builds)
- Xcode 15+ (for iOS builds, macOS only)

## Initial Setup

1. Clone the repository from GitHub
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the web app:
   ```bash
   npm run build
   ```

4. Add native platforms:
   ```bash
   npx cap add android
   npx cap add ios
   npx cap sync
   ```

---

## Android Setup

### Screenshot/Recording Protection (FLAG_SECURE)

Android's `FLAG_SECURE` **completely blocks** screenshots and screen recording. This is the most secure option available on any mobile platform.

Edit `android/app/src/main/java/com/securereader/app/MainActivity.java`:

```java
package com.securereader.app;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // FLAG_SECURE blocks ALL screenshots and screen recording
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        // Re-apply FLAG_SECURE when app returns to foreground
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
```

**What FLAG_SECURE does:**
- ✅ **Blocks ALL screenshots** - Screenshot attempts show blank/black screen
- ✅ **Blocks ALL screen recording** - Recorded video shows blank/black for the app
- ✅ **Hides in recent apps** - App preview in task switcher is blank
- ✅ **Blocks screen mirroring** - Cast/mirror shows blank screen
- ✅ **Works system-wide** - No app can capture the screen content

**Note:** This is enforced at the OS level and cannot be bypassed on non-rooted devices.

### Build APK/AAB

```bash
# Debug build
npx cap run android

# Production build (via Android Studio)
npx cap open android
# In Android Studio: Build → Generate Signed Bundle/APK
```

---

## iOS Setup

### Important: iOS Cannot Block Screenshots

Unlike Android, **iOS does not allow apps to block screenshots or screen recording**. This is an Apple policy.

**What we CAN do on iOS:**
- ✅ Detect when a screenshot is taken
- ✅ Detect when screen recording starts/stops
- ✅ Show a warning overlay when recording
- ✅ Apply watermarks to identify the source
- ✅ Hide content in app switcher (via Privacy Screen plugin)

### Security Plugin for Detection

1. Create `ios/App/App/SecurityPlugin.swift`:

```swift
import Foundation
import Capacitor
import UIKit

@objc(SecurityPlugin)
public class SecurityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecurityPlugin"
    public let jsName = "Security"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isScreenRecording", returnType: CAPPluginReturnPromise)
    ]
    
    private var securityOverlay: UIView?
    
    override public func load() {
        // Listen for screenshots
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenshotTaken),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )
        
        // Listen for screen recording changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenRecordingChanged),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )
        
        // Check initial recording state
        if UIScreen.main.isCaptured {
            showSecurityOverlay()
        }
    }
    
    @objc func screenshotTaken() {
        notifyListeners("screenshotTaken", data: [:])
    }
    
    @objc func screenRecordingChanged() {
        let isRecording = UIScreen.main.isCaptured
        notifyListeners("screenRecordingChanged", data: ["recording": isRecording])
        
        // Show/hide overlay based on recording state
        if isRecording {
            showSecurityOverlay()
        } else {
            hideSecurityOverlay()
        }
    }
    
    @objc func isScreenRecording(_ call: CAPPluginCall) {
        let isRecording = UIScreen.main.isCaptured
        call.resolve(["recording": isRecording])
    }
    
    private func showSecurityOverlay() {
        DispatchQueue.main.async { [weak self] in
            guard self?.securityOverlay == nil else { return }
            
            if let window = UIApplication.shared.windows.first {
                let overlay = UIView(frame: window.bounds)
                overlay.backgroundColor = UIColor.systemBackground
                overlay.tag = 999
                
                // Create warning label
                let label = UILabel()
                label.text = "Screen Recording Detected\n\nContent is hidden while recording is active."
                label.numberOfLines = 0
                label.textAlignment = .center
                label.textColor = .systemRed
                label.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
                label.translatesAutoresizingMaskIntoConstraints = false
                
                // Create icon
                let imageView = UIImageView(image: UIImage(systemName: "video.slash.fill"))
                imageView.tintColor = .systemRed
                imageView.translatesAutoresizingMaskIntoConstraints = false
                imageView.contentMode = .scaleAspectFit
                
                overlay.addSubview(imageView)
                overlay.addSubview(label)
                
                NSLayoutConstraint.activate([
                    imageView.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
                    imageView.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -50),
                    imageView.widthAnchor.constraint(equalToConstant: 60),
                    imageView.heightAnchor.constraint(equalToConstant: 60),
                    
                    label.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 20),
                    label.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 40),
                    label.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -40)
                ])
                
                window.addSubview(overlay)
                self?.securityOverlay = overlay
            }
        }
    }
    
    private func hideSecurityOverlay() {
        DispatchQueue.main.async { [weak self] in
            self?.securityOverlay?.removeFromSuperview()
            self?.securityOverlay = nil
        }
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
```

2. Create `ios/App/App/SecurityPlugin.m`:

```objc
#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SecurityPlugin, "Security",
    CAP_PLUGIN_METHOD(isScreenRecording, CAPPluginReturnPromise);
)
```

### Privacy Screen Plugin

The app uses `@capacitor/privacy-screen` which:
- Blurs/hides content in the iOS app switcher
- Provides additional privacy when switching apps

This is enabled in the reader screen via `usePrivacyScreen(true)`.

### Build IPA

```bash
# Debug build
npx cap run ios

# Production build (via Xcode)
npx cap open ios
# In Xcode: Product → Archive → Distribute App
```

---

## Security Features Comparison

| Feature | Android | iOS | Notes |
|---------|---------|-----|-------|
| **Block screenshots** | ✅ Complete | ❌ Not possible | Android uses FLAG_SECURE |
| **Block screen recording** | ✅ Complete | ❌ Not possible | Apple policy prevents this |
| **Detect screenshots** | N/A (blocked) | ✅ Plugin | Can log/warn user |
| **Detect recording** | N/A (blocked) | ✅ Plugin | Can show overlay |
| **Hide content when recording** | ✅ Automatic | ✅ Native overlay | Swift plugin shows warning |
| **Hide in recent apps** | ✅ FLAG_SECURE | ✅ Privacy Screen | Uses different mechanisms |
| **Dynamic watermark** | ✅ React | ✅ React | Identifies user on leaked content |
| **Session validation** | ✅ Edge function | ✅ Edge function | Single-device enforcement |

---

## Testing Security Features

### Android Testing

1. Install the app on a device
2. Open the reader with a PDF
3. Try to take a screenshot → Should show black/blank
4. Try screen recording → Recorded video should show blank for the app
5. Check recent apps → App preview should be blank

### iOS Testing

1. Install the app on a device
2. Open the reader with a PDF
3. Take a screenshot → Warning notification appears, screenshot shows watermarked content
4. Start screen recording → Full-screen overlay hides content
5. Stop recording → Content reappears
6. Check app switcher → Content should be blurred/hidden

---

## Troubleshooting

### Android: FLAG_SECURE not working
- Ensure you're testing on a **real device** (some emulators may not respect FLAG_SECURE)
- Check that MainActivity.java has the correct package name
- Verify the flag is applied in both `onCreate` AND `onResume`
- On rooted devices, some apps may bypass FLAG_SECURE

### iOS: Security plugin not loading
1. Run `npx cap sync ios` after adding the plugin files
2. In Xcode, verify the Swift files are in the correct target
3. Clean build: Product → Clean Build Folder
4. Check Console.app for any plugin loading errors

### iOS: Overlay not showing
- Ensure the plugin's `load()` method is called
- Check that the overlay is added to the correct window
- Verify `UIScreen.main.isCaptured` returns `true` when recording

### Login not persisting on mobile
- The app uses `@capacitor/preferences` for persistent storage
- After updating, run `npx cap sync` to ensure the plugin is properly installed
- Clear app data and try again if issues persist

### Build fails
1. Clear caches:
   ```bash
   npx cap clean
   rm -rf node_modules
   npm install
   ```
2. Rebuild:
   ```bash
   npm run build
   npx cap sync
   ```
3. For iOS, also try:
   ```bash
   cd ios/App
   pod install --repo-update
   cd ../..
   ```
