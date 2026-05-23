package com.katuu.app;

import android.Manifest;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Habilita edge-to-edge — permite que o app desenhe atrás das barras do sistema
        // Os insets são tratados via CSS com env(safe-area-inset-*)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        requestPermissions(new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        }, 1001);
    }
}
