package expo.modules.sunmiprinter

import android.content.Context
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Wrap máy in nhiệt tích hợp Sunmi (V2s…) qua Sunmi inner printer service (AIDL).
// JS lo layout (text 32 cột cho 58mm); native chỉ bind + printText/QR/feed + status.
class SunmiPrinterModule : Module() {
  private var service: SunmiPrinterService? = null
  private var binding = false

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context không sẵn sàng" }

  private val printerCallback = object : InnerPrinterCallback() {
    override fun onConnected(s: SunmiPrinterService) {
      service = s
      binding = false
      try {
        s.printerInit(null)
      } catch (_: Exception) {
      }
    }

    override fun onDisconnected() {
      service = null
      binding = false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SunmiPrinter")

    // Thiết bị có Sunmi printer service không (dùng để fallback stub trên máy thường).
    Function("isDeviceSupported") {
      isSunmiServiceAvailable()
    }

    Function("isConnected") {
      service != null
    }

    // Bind service. Resolve ngay; onConnected set service bất đồng bộ.
    AsyncFunction("connect") { promise: Promise ->
      if (service != null) {
        promise.resolve(true); return@AsyncFunction
      }
      try {
        binding = true
        val ok = InnerPrinterManager.getInstance().bindService(context, printerCallback)
        promise.resolve(ok)
      } catch (e: InnerPrinterException) {
        binding = false
        promise.reject(CodedException("ERR_SUNMI_BIND", e.message ?: "bindService lỗi", e))
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try {
        InnerPrinterManager.getInstance().unBindService(context, printerCallback)
      } catch (_: Exception) {
      }
      service = null
      promise.resolve(true)
    }

    // updatePrinterState: 1=ok, 2=chuẩn bị, 3=lỗi giao tiếp, 4=hết giấy, 5=quá nhiệt, 6=mở nắp...
    AsyncFunction("getStatus") { promise: Promise ->
      val s = service ?: run { promise.resolve("disconnected"); return@AsyncFunction }
      val code = try {
        s.updatePrinterState()
      } catch (_: Exception) {
        -1
      }
      promise.resolve(statusLabel(code))
    }

    AsyncFunction("printText") { text: String, promise: Promise ->
      withService(promise) { s, cb -> s.printText(text, cb) }
    }

    AsyncFunction("printQRCode") { data: String, moduleSize: Int, errorLevel: Int, promise: Promise ->
      withService(promise) { s, cb ->
        s.setAlignment(1, null)
        s.printQRCode(data, moduleSize, errorLevel, cb)
        s.setAlignment(0, null)
      }
    }

    AsyncFunction("lineWrap") { lines: Int, promise: Promise ->
      withService(promise) { s, cb -> s.lineWrap(lines, cb) }
    }

    // V2s không có dao cắt; gọi vẫn an toàn (bắt ngoại lệ).
    AsyncFunction("cutPaper") { promise: Promise ->
      val s = service
      if (s == null) { promise.resolve(false); return@AsyncFunction }
      try { s.cutPaper(null) } catch (_: Exception) {}
      promise.resolve(true)
    }
  }

  private inline fun withService(promise: Promise, block: (SunmiPrinterService, InnerResultCallback) -> Unit) {
    val s = service
    if (s == null) {
      promise.reject(CodedException("ERR_SUNMI_NOT_CONNECTED", "Máy in Sunmi chưa kết nối", null))
      return
    }
    val cb = object : InnerResultCallback() {
      override fun onRunResult(isSuccess: Boolean) { promise.resolve(isSuccess) }
      override fun onReturnString(result: String?) {}
      override fun onRaiseException(code: Int, msg: String?) {
        promise.reject(CodedException("ERR_SUNMI_PRINT", "In lỗi ($code): ${msg ?: ""}", null))
      }
      override fun onPrintResult(code: Int, msg: String?) {}
    }
    try {
      block(s, cb)
    } catch (e: Exception) {
      promise.reject(CodedException("ERR_SUNMI_PRINT", e.message ?: "In lỗi", e))
    }
  }

  private fun isSunmiServiceAvailable(): Boolean {
    return try {
      context.packageManager.getPackageInfo("woyou.aidlservice.jiuiv5", 0)
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun statusLabel(code: Int): String = when (code) {
    1 -> "ready"
    2 -> "preparing"
    3 -> "comm_error"
    4 -> "out_of_paper"
    5 -> "overheated"
    6 -> "cover_open"
    7 -> "cutter_error"
    8 -> "cutter_recovered"
    9 -> "no_black_mark"
    505 -> "no_printer"
    else -> "unknown"
  }
}
