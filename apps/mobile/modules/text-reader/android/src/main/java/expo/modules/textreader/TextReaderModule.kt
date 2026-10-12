package expo.modules.textreader

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** On-device text recognition with Google ML Kit (bundled model). Nothing is uploaded. */
class TextReaderModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "No React context" }

  override fun definition() = ModuleDefinition {
    Name("TextReader")

    AsyncFunction("readImage") { uri: String ->
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        throw CodedException("ERR_IMAGE", "The image could not be opened.", e)
      }
      recognize(image)
    }

    AsyncFunction("readPdf") { uri: String, maxPages: Int ->
      val descriptor: ParcelFileDescriptor = try {
        context.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
          ?: throw IllegalStateException("no descriptor")
      } catch (e: Exception) {
        throw CodedException("ERR_PDF", "The PDF could not be opened.", e)
      }
      val lines = mutableListOf<String>()
      descriptor.use { fd ->
        PdfRenderer(fd).use { renderer ->
          val pages = minOf(renderer.pageCount, maxOf(1, maxPages))
          for (index in 0 until pages) {
            renderer.openPage(index).use { page ->
              // Android has no built-in PDF text extraction, so every page is
              // rendered and read; that also covers scanned PDFs.
              val scale = 2000f / maxOf(page.width, page.height, 1)
              val bitmap = Bitmap.createBitmap((page.width * scale).toInt(), (page.height * scale).toInt(), Bitmap.Config.ARGB_8888)
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              lines += recognize(InputImage.fromBitmap(bitmap, 0))
              bitmap.recycle()
            }
          }
        }
      }
      lines
    }
  }

  private fun recognize(image: InputImage): List<String> {
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    try {
      val result = Tasks.await(recognizer.process(image))
      return result.textBlocks
        .sortedBy { it.boundingBox?.top ?: 0 }
        .flatMap { block -> block.lines.map { it.text } }
    } finally {
      recognizer.close()
    }
  }
}
