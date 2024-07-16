package mozilla.components.feature.cades.plugin

import android.content.Context
import androidx.annotation.VisibleForTesting
import mozilla.components.feature.cades.plugin.wrapper.JniWrapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.distinctUntilChangedBy
import kotlinx.coroutines.flow.mapNotNull
import mozilla.components.browser.state.selector.findCustomTabOrSelectedTab
import mozilla.components.browser.state.store.BrowserStore
import mozilla.components.concept.engine.webextension.MessageHandler
import mozilla.components.concept.engine.webextension.Port
import mozilla.components.concept.engine.webextension.WebExtensionRuntime
import mozilla.components.lib.state.ext.flowScoped
import mozilla.components.support.base.feature.LifecycleAwareFeature
import mozilla.components.support.base.log.logger.Logger
import mozilla.components.support.webextensions.WebExtensionController
import org.json.JSONObject
import ru.CryptoPro.JCSP.NCSPConfig

class CAdESPluginFeature(
    context: Context,
    private val customTabSessionId: String?,
    private val runtime: WebExtensionRuntime,
    private val store: BrowserStore,
) : LifecycleAwareFeature {

    init {
        var error = NCSPConfig.init(context)
        if (error == NCSPConfig.CSP_INIT_OK) {
            main = MainThread(context.applicationInfo.dataDir)
            main.start()
            error = JniWrapper.license(CAdES_OCSP_LICENSE, CAdES_TSP_LICENSE)
            if (error != 0) {
                logger.info("Licenses not set, failed with error $error")
            }
            else {
                logger.info("CAdES Plug-in web extension has been installed successfully.")
            }
        }
        else {
            logger.error("CSP initiating failed with error $error")
        }
    }

    private var scope: CoroutineScope? = null

    @VisibleForTesting
    // This is an internal var to make it mutable for unit testing purposes only
    internal var extensionController = WebExtensionController(
        CAdES_PLUGIN_EXTENSION_ID,
        CAdES_PLUGIN_EXTENSION_URL,
        CAdES_PLUGIN_MESSAGING_ID,
    )

    override fun start() {
        val messageHandler = CAdESPluginMessageHandler()
        extensionController.registerBackgroundMessageHandler(messageHandler, CAdES_PLUGIN_CONTENT_BACKGROUND_ID)

        extensionController.install(runtime)

        scope = store.flowScoped { flow ->
            flow.mapNotNull { state -> state.findCustomTabOrSelectedTab(customTabSessionId) }
                .distinctUntilChangedBy { it.engineState.engineSession }
                .collect {
                    it.engineState.engineSession?.let { engineSession ->
                        extensionController.registerContentMessageHandler(engineSession, messageHandler, CAdES_PLUGIN_MESSAGING_ID)
                    }
                }
        }
    }

    override fun stop() {
        scope?.cancel()
    }

    companion object {
        internal const val PRODUCT_NAME = "cades-plugin"
        private val logger = Logger(PRODUCT_NAME)
        internal const val CAdES_OCSP_LICENSE = "0A202-U0030-00ECW-RRLMF-UU2WK"
        internal const val CAdES_TSP_LICENSE = "TA200-G0030-00ECW-RRLNE-BTDVV"
        internal const val CAdES_PLUGIN_EXTENSION_ID = "ru.cryptopro.nmcades@cryptopro.ru"
        internal const val CAdES_PLUGIN_EXTENSION_URL = "resource://android/assets/extensions/cades-plugin/"
        internal const val CAdES_PLUGIN_MESSAGING_ID = "ru.cryptopro.nmcades.content"
        internal const val CAdES_PLUGIN_CONTENT_BACKGROUND_ID = "ru.cryptopro.nmcades"
        lateinit var main: Thread
        lateinit var reader: Thread
    }

    class MainThread(val applicationPath: String): Thread() {
        override fun run() {
            logger.info("Starting main thread...")
            JniWrapper.main(applicationPath)
        }
    }

    private class CAdESPluginMessageHandler(
        private val productName: String = PRODUCT_NAME,
    ) : MessageHandler {
        override fun onPortConnected(port: Port) {
            logger.info(JSONObject().put("productName", productName).toString())
            reader = Thread {
                logger.info("Starting reader thread...")
                while (true) {
                    val e = JniWrapper.read();
                    logger.info("read: $e")
                    port.postMessage(JSONObject(e))
                }
            }
            reader.start()
        }
        override fun onPortMessage(message: Any, port: Port) {
            val e = message.toString();
            logger.info("write: $e");
            if (JniWrapper.write(e, 0) != 0) {
                logger.error("write: $e failed.");
            }
        }
    }

}