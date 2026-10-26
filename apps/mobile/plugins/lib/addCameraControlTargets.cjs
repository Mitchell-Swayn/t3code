"use strict";

const SOURCE_FILES = {
  intent: "T3CaptureIntent.swift",
  control: "T3CameraControl.swift",
  extension: "T3CameraCapture.swift",
};
const EMBED_PHASE_NAME = "Embed ExtensionKit Extensions";

function stripComments(map) {
  return Object.fromEntries(Object.entries(map ?? {}).filter(([key]) => !key.endsWith("_comment")));
}

function findByName(map, name) {
  const entry = Object.entries(stripComments(map)).find(
    ([, value]) => value?.name === name || value?.name === `"${name}"`,
  );
  return entry ? { uuid: entry[0], value: entry[1] } : null;
}

function addObject(proj, section, object, comment) {
  const objects = proj.hash.project.objects;
  const uuid = proj.generateUuid();
  objects[section] ??= {};
  objects[section][uuid] = object;
  objects[section][`${uuid}_comment`] = comment;
  return uuid;
}

function sourcesPhaseOf(proj, target, targetName) {
  const phases = proj.hash.project.objects.PBXSourcesBuildPhase ?? {};
  const ref = target.buildPhases?.find(({ value }) => phases[value]);
  if (!ref) {
    throw new Error(`addCameraControlTargets: ${targetName} has no Sources build phase.`);
  }
  return phases[ref.value];
}

function addBuildFile(proj, phase, fileRef, name, phaseName, settings) {
  const uuid = addObject(
    proj,
    "PBXBuildFile",
    { isa: "PBXBuildFile", fileRef, fileRef_comment: name, ...(settings ? { settings } : {}) },
    `${name} in ${phaseName}`,
  );
  phase.files.push({ value: uuid, comment: `${name} in ${phaseName}` });
}

function addPhase(proj, target, section, name, extra = {}) {
  const phase = {
    isa: section,
    buildActionMask: 2147483647,
    files: [],
    runOnlyForDeploymentPostprocessing: 0,
    ...extra,
  };
  const uuid = addObject(proj, section, phase, name);
  target.buildPhases.push({ value: uuid, comment: name });
  return phase;
}

/**
 * Adds the locked camera capture extension and wires the shared intent into the app and widget targets.
 * @param {import('xcode').XcodeProject} proj
 * @param {{ appTargetName: string, widgetTargetName: string, extensionTargetName: string,
 *   bundleIdentifier: string, displayName: string, cameraUsageDescription: string,
 *   marketingVersion: string, buildNumber: string, appleTeamId?: string }} opts
 */
function addCameraControlTargets(proj, opts) {
  const objects = proj.hash.project.objects;
  if (findByName(objects.PBXNativeTarget, opts.extensionTargetName)) return false;

  const appTarget = findByName(objects.PBXNativeTarget, opts.appTargetName);
  const widgetTarget = findByName(objects.PBXNativeTarget, opts.widgetTargetName);
  if (!appTarget || !widgetTarget) {
    throw new Error(
      `addCameraControlTargets: missing ${appTarget ? opts.widgetTargetName : opts.appTargetName} target. ` +
        "Register withCameraControl before expo-widgets so its mods run after the widget target exists.",
    );
  }

  const fileRefs = {};
  for (const [key, name] of Object.entries(SOURCE_FILES)) {
    fileRefs[key] = addObject(
      proj,
      "PBXFileReference",
      {
        isa: "PBXFileReference",
        lastKnownFileType: "sourcecode.swift",
        path: name,
        sourceTree: '"<group>"',
      },
      name,
    );
  }
  const infoPlistRef = addObject(
    proj,
    "PBXFileReference",
    {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.xml",
      path: "Info.plist",
      sourceTree: '"<group>"',
    },
    "Info.plist",
  );
  const groupUuid = addObject(
    proj,
    "PBXGroup",
    {
      isa: "PBXGroup",
      children: [
        ...Object.entries(SOURCE_FILES).map(([key, name]) => ({
          value: fileRefs[key],
          comment: name,
        })),
        { value: infoPlistRef, comment: "Info.plist" },
      ],
      path: opts.extensionTargetName,
      sourceTree: '"<group>"',
    },
    opts.extensionTargetName,
  );
  const mainGroup = objects.PBXGroup[proj.getFirstProject().firstProject.mainGroup];
  mainGroup.children.push({ value: groupUuid, comment: opts.extensionTargetName });

  const productName = `${opts.extensionTargetName}.appex`;
  const productRef = addObject(
    proj,
    "PBXFileReference",
    {
      isa: "PBXFileReference",
      explicitFileType: '"wrapper.extensionkit-extension"',
      includeInIndex: 0,
      path: productName,
      sourceTree: "BUILT_PRODUCTS_DIR",
    },
    productName,
  );
  const productsGroup = findByName(objects.PBXGroup, "Products");
  productsGroup?.value.children.push({ value: productRef, comment: productName });

  const buildSettings = {
    APPLICATION_EXTENSION_API_ONLY: "YES",
    CODE_SIGN_STYLE: "Automatic",
    CURRENT_PROJECT_VERSION: `"${opts.buildNumber}"`,
    ...(opts.appleTeamId ? { DEVELOPMENT_TEAM: opts.appleTeamId } : {}),
    GENERATE_INFOPLIST_FILE: "YES",
    INFOPLIST_FILE: `${opts.extensionTargetName}/Info.plist`,
    INFOPLIST_KEY_CFBundleDisplayName: `"${opts.displayName}"`,
    INFOPLIST_KEY_NSCameraUsageDescription: `"${opts.cameraUsageDescription}"`,
    IPHONEOS_DEPLOYMENT_TARGET: "18.0",
    LD_RUNPATH_SEARCH_PATHS: [
      '"$(inherited)"',
      '"@executable_path/Frameworks"',
      '"@executable_path/../../Frameworks"',
    ],
    MARKETING_VERSION: `"${opts.marketingVersion}"`,
    PRODUCT_BUNDLE_IDENTIFIER: `"${opts.bundleIdentifier}"`,
    PRODUCT_NAME: '"$(TARGET_NAME)"',
    SDKROOT: "iphoneos",
    SKIP_INSTALL: "YES",
    SWIFT_VERSION: "5.0",
    TARGETED_DEVICE_FAMILY: '"1,2"',
  };
  const { uuid: configurationListUuid } = proj.addXCConfigurationList(
    ["Debug", "Release"].map((name) => ({
      name,
      isa: "XCBuildConfiguration",
      buildSettings: { ...buildSettings },
    })),
    "Release",
    `Build configuration list for PBXNativeTarget "${opts.extensionTargetName}"`,
  );

  const extensionTarget = {
    isa: "PBXNativeTarget",
    buildConfigurationList: configurationListUuid,
    buildPhases: [],
    buildRules: [],
    dependencies: [],
    name: opts.extensionTargetName,
    productName: opts.extensionTargetName,
    productReference: productRef,
    productType: '"com.apple.product-type.extensionkit-extension"',
  };
  const extensionTargetUuid = addObject(
    proj,
    "PBXNativeTarget",
    extensionTarget,
    opts.extensionTargetName,
  );
  const extensionSources = addPhase(proj, extensionTarget, "PBXSourcesBuildPhase", "Sources");
  addPhase(proj, extensionTarget, "PBXFrameworksBuildPhase", "Frameworks");
  addPhase(proj, extensionTarget, "PBXResourcesBuildPhase", "Resources");
  addBuildFile(proj, extensionSources, fileRefs.extension, SOURCE_FILES.extension, "Sources");
  addBuildFile(proj, extensionSources, fileRefs.intent, SOURCE_FILES.intent, "Sources");

  proj.addToPbxProjectSection({ uuid: extensionTargetUuid, pbxNativeTarget: extensionTarget });
  // addTargetDependency silently does nothing unless both sections exist.
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  proj.addTargetDependency(appTarget.uuid, [extensionTargetUuid]);

  const embedPhase = addPhase(proj, appTarget.value, "PBXCopyFilesBuildPhase", EMBED_PHASE_NAME, {
    dstPath: '"$(EXTENSIONS_FOLDER_PATH)"',
    dstSubfolderSpec: 16,
    name: `"${EMBED_PHASE_NAME}"`,
  });
  addBuildFile(proj, embedPhase, productRef, productName, EMBED_PHASE_NAME, {
    ATTRIBUTES: ["RemoveHeadersOnCopy"],
  });

  const appSources = sourcesPhaseOf(proj, appTarget.value, opts.appTargetName);
  addBuildFile(proj, appSources, fileRefs.intent, SOURCE_FILES.intent, "Sources");
  const widgetSources = sourcesPhaseOf(proj, widgetTarget.value, opts.widgetTargetName);
  addBuildFile(proj, widgetSources, fileRefs.intent, SOURCE_FILES.intent, "Sources");
  addBuildFile(proj, widgetSources, fileRefs.control, SOURCE_FILES.control, "Sources");
  return true;
}

module.exports = { addCameraControlTargets, SOURCE_FILES };
