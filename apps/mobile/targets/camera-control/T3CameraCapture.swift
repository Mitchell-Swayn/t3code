import AVFoundation
import AVKit
import LockedCameraCapture
import SwiftUI

// Unlocked, iOS opens the app directly. Locked, it runs this extension instead.
@main
struct T3CameraCaptureExtension: LockedCameraCaptureExtension {
  var body: some LockedCameraCaptureExtensionScene {
    LockedCameraCaptureUIScene { session in
      T3CameraCaptureView(session: session)
    }
  }
}

// iOS ends the extension without a live viewfinder, so show one and unlock into the app on a press.
struct T3CameraCaptureView: View {
  let session: LockedCameraCaptureSession
  @State private var camera = T3CameraPreviewSession()

  var body: some View {
    ZStack(alignment: .bottom) {
      T3CameraPreview(session: camera.captureSession)
        .ignoresSafeArea()
      Button("Open T3 Code", systemImage: "lock.open") {
        openApp()
      }
      .buttonStyle(.borderedProminent)
      .padding(.bottom, 48)
    }
    .onCameraCaptureEvent { event in
      if event.phase == .ended {
        openApp()
      }
    }
    .onAppear { camera.start() }
    .onDisappear { camera.stop() }
  }

  private func openApp() {
    Task {
      try? await session.openApplication(
        for: NSUserActivity(activityType: NSUserActivityTypeLockedCameraCapture)
      )
    }
  }
}

final class T3CameraPreviewSession {
  let captureSession = AVCaptureSession()
  private let queue = DispatchQueue(label: "T3CameraCapture.session")

  func start() {
    queue.async { [captureSession] in
      if captureSession.inputs.isEmpty,
        let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
        let input = try? AVCaptureDeviceInput(device: device),
        captureSession.canAddInput(input)
      {
        captureSession.addInput(input)
      }
      captureSession.startRunning()
    }
  }

  func stop() {
    queue.async { [captureSession] in
      captureSession.stopRunning()
    }
  }
}

struct T3CameraPreview: UIViewRepresentable {
  let session: AVCaptureSession

  func makeUIView(context: Context) -> PreviewView {
    let view = PreviewView()
    view.previewLayer.session = session
    view.previewLayer.videoGravity = .resizeAspectFill
    return view
  }

  func updateUIView(_ uiView: PreviewView, context: Context) {}

  final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }

    var previewLayer: AVCaptureVideoPreviewLayer {
      layer as! AVCaptureVideoPreviewLayer
    }
  }
}
