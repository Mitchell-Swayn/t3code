"use strict";

// Camera Control lists apps that ship a locked camera capture extension and a CameraCaptureIntent control.
// Precede expo-widgets so its reverse-ordered mods create and wipe the widget target before we extend it.

const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");
const { addCameraControlTargets, SOURCE_FILES } = require("./lib/addCameraControlTargets.cjs");

const EXTENSION_TARGET = "T3CameraCapture";
const WIDGET_TARGET = "ExpoWidgetsTarget";
const WIDGET_BUNDLE_ANCHOR = "WidgetLiveActivity()";
const CAMERA_USAGE =
  "Allow T3 Code to show the camera on the Lock Screen so Camera Control can open the app.";

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>EXAppExtensionAttributes</key>
  <dict>
    <key>EXExtensionPointIdentifier</key>
    <string>com.apple.securecapture</string>
  </dict>
</dict>
</plist>
`;

function withSourceFiles(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      const sourceDir = path.join(projectRoot, "targets", "camera-control");
      const targetDir = path.join(platformProjectRoot, EXTENSION_TARGET);
      fs.mkdirSync(targetDir, { recursive: true });
      for (const name of Object.values(SOURCE_FILES)) {
        fs.copyFileSync(path.join(sourceDir, name), path.join(targetDir, name));
      }
      fs.writeFileSync(path.join(targetDir, "Info.plist"), INFO_PLIST);

      const bundlePath = path.join(platformProjectRoot, WIDGET_TARGET, "index.swift");
      const bundle = fs.readFileSync(bundlePath, "utf8");
      if (!bundle.includes("T3CameraControl()")) {
        if (bundle.split(WIDGET_BUNDLE_ANCHOR).length !== 2) {
          throw new Error(
            `withCameraControl: expected one ${WIDGET_BUNDLE_ANCHOR} in ${bundlePath}.`,
          );
        }
        fs.writeFileSync(
          bundlePath,
          bundle.replace(
            WIDGET_BUNDLE_ANCHOR,
            `${WIDGET_BUNDLE_ANCHOR}\n    if #available(iOS 18.0, *) {\n      T3CameraControl()\n    }`,
          ),
        );
      }
      return cfg;
    },
  ]);
}

function withTargets(config, bundleIdentifier) {
  return withXcodeProject(config, (cfg) => {
    addCameraControlTargets(cfg.modResults, {
      appTargetName: cfg.modRequest.projectName,
      widgetTargetName: WIDGET_TARGET,
      extensionTargetName: EXTENSION_TARGET,
      bundleIdentifier,
      displayName: cfg.name,
      cameraUsageDescription: CAMERA_USAGE,
      marketingVersion: cfg.ios?.version ?? cfg.version ?? "1.0",
      buildNumber: cfg.ios?.buildNumber ?? "1",
      appleTeamId: cfg.ios?.appleTeamId,
    });
    return cfg;
  });
}

// EAS only provisions extension bundle identifiers it is told about.
function withEasAppExtension(config, bundleIdentifier) {
  const ios = config.extra?.eas?.build?.experimental?.ios ?? {};
  const appExtensions = (ios.appExtensions ?? []).filter(
    (extension) => extension.targetName !== EXTENSION_TARGET,
  );
  config.extra = {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...ios,
            appExtensions: [...appExtensions, { targetName: EXTENSION_TARGET, bundleIdentifier }],
          },
        },
      },
    },
  };
  return config;
}

module.exports = function withCameraControl(config) {
  const bundleIdentifier = `${config.ios.bundleIdentifier}.camera-capture`;
  return withTargets(
    withSourceFiles(withEasAppExtension(config, bundleIdentifier)),
    bundleIdentifier,
  );
};
