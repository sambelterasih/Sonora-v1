package com.chordsasy.musiclab

import android.Manifest
import android.app.Activity
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.getcapacitor.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "InternalAudioCapture",
    permissions = [Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")]
)
class InternalAudioCapturePlugin : Plugin() {
    private val executor = Executors.newSingleThreadExecutor()

    @PluginMethod
    fun capture(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Audio internal memerlukan Android 10 atau lebih baru.")
            return
        }
        val seconds = (call.getInt("durationSeconds") ?: 12).coerceIn(8, 15)
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "handleAudioPermission")
        } else {
            requestProjection(call)
        }
    }

    @PermissionCallback
    private fun handleAudioPermission(call: PluginCall) {
        if (getPermissionState("microphone") == com.getcapacitor.PermissionState.GRANTED) {
            requestProjection(call)
        } else {
            call.reject("Izin Android yang diperlukan untuk Audio Playback Capture tidak diberikan.")
        }
    }

    private fun requestProjection(call: PluginCall) {
        val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(call, manager.createScreenCaptureIntent(), "handleProjectionResult")
    }

    @ActivityCallback
    private fun handleProjectionResult(result: ActivityResult, call: PluginCall?) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.reject("Izin Audio Capture dibatalkan.")
            return
        }
        val seconds = (call.getInt("durationSeconds") ?: 12).coerceIn(8, 15)
        val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = manager.getMediaProjection(result.resultCode, result.data!!)
        if (projection == null) {
            call.reject("Android tidak memberikan sesi Audio Capture.")
            return
        }
        executor.execute {
            try {
                val wav = capturePcm(projection, seconds)
                val ret = JSObject()
                ret.put("audioBase64", Base64.encodeToString(wav, Base64.NO_WRAP))
                ret.put("mimeType", "audio/wav")
                ret.put("durationSeconds", seconds)
                ret.put("sampleRate", SAMPLE_RATE)
                Handler(Looper.getMainLooper()).post { call.resolve(ret) }
            } catch (e: Exception) {
                Handler(Looper.getMainLooper()).post { call.reject(e.message ?: "Gagal menangkap audio internal.") }
            } finally {
                try { projection.stop() } catch (_: Exception) { }
            }
        }
    }

    private fun capturePcm(projection: MediaProjection, seconds: Int): ByteArray {
        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
            .build()
        val config = android.media.AudioPlaybackCaptureConfiguration.Builder(projection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .build()
        val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (minBuffer <= 0) throw IllegalStateException("Format audio internal tidak didukung perangkat ini.")
        val bufferSize = maxOf(minBuffer * 2, SAMPLE_RATE / 2)
        val recorder = AudioRecord.Builder()
            .setAudioFormat(format)
            .setBufferSizeInBytes(bufferSize)
            .setAudioPlaybackCaptureConfig(config)
            .build()
        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            throw IllegalStateException("Perekam Audio Playback tidak dapat diinisialisasi.")
        }
        val targetBytes = SAMPLE_RATE * 2 * seconds
        val output = ByteArrayOutputStream(targetBytes)
        val buffer = ByteArray(bufferSize)
        try {
            // Give the user a moment to switch from CHORD SASY to the music app.
            Thread.sleep(2500)
            recorder.startRecording()
            val start = System.currentTimeMillis()
            while (output.size() < targetBytes && System.currentTimeMillis() - start < seconds * 1000L + 2500L) {
                val read = recorder.read(buffer, 0, minOf(buffer.size, targetBytes - output.size()))
                if (read > 0) output.write(buffer, 0, read)
                else if (read < 0) throw IllegalStateException("Gagal membaca audio internal (kode $read).")
            }
        } finally {
            try { recorder.stop() } catch (_: Exception) { }
            recorder.release()
        }
        val pcm = output.toByteArray()
        if (pcm.size < SAMPLE_RATE * 2 * 5) throw IllegalStateException("Audio yang tertangkap terlalu singkat. Pastikan lagu sedang diputar dan aplikasi sumber mengizinkan audio capture.")
        return toWav(pcm, SAMPLE_RATE, 1, 16)
    }

    private fun toWav(pcm: ByteArray, sampleRate: Int, channels: Int, bits: Int): ByteArray {
        val dataSize = pcm.size
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray(Charsets.US_ASCII)); header.putInt(36 + dataSize)
        header.put("WAVE".toByteArray(Charsets.US_ASCII)); header.put("fmt ".toByteArray(Charsets.US_ASCII))
        header.putInt(16); header.putShort(1.toShort()); header.putShort(channels.toShort())
        header.putInt(sampleRate); header.putInt(sampleRate * channels * bits / 8)
        header.putShort((channels * bits / 8).toShort()); header.putShort(bits.toShort())
        header.put("data".toByteArray(Charsets.US_ASCII)); header.putInt(dataSize)
        return header.array() + pcm
    }

    override fun handleOnDestroy() {
        executor.shutdownNow()
        super.handleOnDestroy()
    }

    companion object { private const val SAMPLE_RATE = 32000 }
}
