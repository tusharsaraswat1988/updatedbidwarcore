package com.bidwar.app.fcm;

import android.util.Log;
import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * FCM infrastructure stub — receives tokens/messages but performs no product logic yet.
 * Replace google-services.json with a real Firebase Android app config before enabling pushes.
 */
public class BidWarFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BidWarFCM";

    @Override
    public void onNewToken(@NonNull String token) {
        Log.i(TAG, "New FCM token (infra only): " + token.substring(0, Math.min(12, token.length())) + "…");
        // Phase 2+: forward token to backend when notification product is implemented.
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Log.i(TAG, "FCM message received (ignored — no business logic yet): " + message.getMessageId());
    }
}
