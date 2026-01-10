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

### Add Screenshot/Recording Protection

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
        
        // Add FLAG_SECURE to block screenshots and screen recording
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
```

This single flag accomplishes:
- ✅ Blocks screenshots
- ✅ Blocks screen recording
- ✅ Shows blank in recent apps preview

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

### Add Security Plugin

1. Create `ios/App/App/SecurityPlugin.swift`:

```swift
import Foundation
import Capacitor
import UIKit

@objc(SecurityPlugin)
public class SecurityPlugin: CAPPlugin {
    
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
    }
    
    @objc func screenshotTaken() {
        notifyListeners("screenshotTaken", data: [:])
    }
    
    @objc func screenRecordingChanged() {
        let isRecording = UIScreen.main.isCaptured
        notifyListeners("screenRecordingChanged", data: ["recording": isRecording])
    }
    
    @objc func isScreenRecording(_ call: CAPPluginCall) {
        let isRecording = UIScreen.main.isCaptured
        call.resolve(["recording": isRecording])
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

3. Register the plugin in `ios/App/App/AppDelegate.swift`:

Add import and registration if needed (Capacitor auto-discovers plugins in most cases).

### Build IPA

```bash
# Debug build
npx cap run ios

# Production build (via Xcode)
npx cap open ios
# In Xcode: Product → Archive → Distribute App
```

---

## Security Features Summary

| Feature | Android | iOS |
|---------|---------|-----|
| Block screenshots | ✅ FLAG_SECURE | ❌ Not possible |
| Block screen recording | ✅ FLAG_SECURE | ❌ Not possible |
| Detect screenshots | N/A (blocked) | ✅ Plugin |
| Detect recording | N/A (blocked) | ✅ Plugin |
| Hide in recent apps | ✅ FLAG_SECURE | ❌ Not possible |
| Dynamic watermark | ✅ JS | ✅ JS |
| Session validation | ✅ Edge function | ✅ Edge function |

---

## Troubleshooting

### Android: FLAG_SECURE not working
- Ensure you're testing on a real device or emulator with Google Play Services
- Some screen recording apps bypass FLAG_SECURE on rooted devices

### iOS: Plugin not loading
- Run `npx cap sync ios` after adding the plugin files
- Check that the plugin files are in the correct Xcode target

### Build fails
- Clear caches: `npx cap clean`
- Rebuild: `npm run build && npx cap sync`
