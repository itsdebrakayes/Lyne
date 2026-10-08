import ExpoModulesCore
import Vision
import PDFKit
import UIKit

/// On-device text recognition with Apple Vision. Nothing is uploaded.
public class TextReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextReader")

    AsyncFunction("readImage") { (uri: String) -> [String] in
      guard let url = Self.fileURL(uri), let image = UIImage(contentsOfFile: url.path), let cg = image.cgImage else {
        throw Exception(name: "ERR_IMAGE", description: "The image could not be opened.")
      }
      return try Self.recognize(cg, orientation: Self.cgOrientation(image.imageOrientation))
    }

    AsyncFunction("readPdf") { (uri: String, maxPages: Int) -> [String] in
      guard let url = Self.fileURL(uri), let doc = PDFDocument(url: url) else {
        throw Exception(name: "ERR_PDF", description: "The PDF could not be opened.")
      }
      var lines: [String] = []
      for index in 0..<min(doc.pageCount, max(1, maxPages)) {
        guard let page = doc.page(at: index) else { continue }
        // A PDF made from a document carries its text; use it as written.
        let embedded = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if embedded.count >= 9 {
          lines += embedded.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
          continue
        }
        // A scanned PDF is a picture inside a PDF: render it and read it.
        let bounds = page.bounds(for: .mediaBox)
        let scale: CGFloat = 2000 / max(bounds.width, bounds.height, 1)
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        let rendered = page.thumbnail(of: size, for: .mediaBox)
        if let cg = rendered.cgImage { lines += try Self.recognize(cg, orientation: .up) }
      }
      return lines
    }
  }

  private static func fileURL(_ uri: String) -> URL? {
    if let url = URL(string: uri), url.isFileURL { return url }
    return URL(fileURLWithPath: uri)
  }

  private static func recognize(_ image: CGImage, orientation: CGImagePropertyOrientation) throws -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // Correction "fixes" digit runs into words; a TRN is nine digits, not prose.
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:]).perform([request])
    let observations = request.results ?? []
    // Top to bottom: Vision's origin is bottom-left.
    return observations
      .sorted { $0.boundingBox.minY > $1.boundingBox.minY }
      .compactMap { $0.topCandidates(1).first?.string }
  }

  private static func cgOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
