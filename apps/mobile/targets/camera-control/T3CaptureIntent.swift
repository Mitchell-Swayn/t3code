import AppIntents

// iOS only discovers this intent when it compiles into the app, the widget extension, and the capture extension.
@available(iOS 18.0, *)
struct T3CaptureIntent: CameraCaptureIntent {
  struct AppContext: Codable, Sendable {}

  static let title: LocalizedStringResource = "Open T3 Code"
  static let description = IntentDescription("Opens T3 Code.")

  @MainActor
  func perform() async throws -> some IntentResult {
    .result()
  }
}
