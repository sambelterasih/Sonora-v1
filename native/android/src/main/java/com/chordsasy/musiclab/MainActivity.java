package com.chordsasy.musiclab;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InternalAudioCapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
