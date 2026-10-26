import AppIntents
import SwiftUI
import WidgetKit

// A control that runs a CameraCaptureIntent is what lists T3 Code under Settings > Camera > Camera Control.
@available(iOS 18.0, *)
struct T3CameraControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "T3CameraControl") {
      ControlWidgetButton(action: T3CaptureIntent()) {
        Label("T3 Code", systemImage: "terminal")
      }
    }
    .displayName("Open T3 Code")
    .description("Opens T3 Code.")
  }
}
