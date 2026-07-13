package com.bidwar.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.view.WindowCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Production Capacitor host.
 * - Loads BuildConfig shell URL (staging debug / production release)
 * - Custom offline page (never Android WebView chrome errors)
 * - Google OAuth must leave the WebView (disallowed_useragent) → Custom Tabs
 * - Deep link bidwar://oauth-complete returns the handoff into the WebView
 * - WebView crash recovery via renderer priority + reload
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "BidWarMain";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    /** BidWar hosts only — Google must NOT stay in WebView (Error 403: disallowed_useragent). */
    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(Arrays.asList(
            "bidwar.in",
            "www.bidwar.in",
            "bidwar-staging.onrender.com"
    ));

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        if (bridge == null) {
            Log.e(TAG, "Capacitor bridge missing");
            return;
        }

        WebView webView = bridge.getWebView();
        WebView.setWebContentsDebuggingEnabled(BuildConfig.ENABLE_WEBVIEW_DEBUG);
        try {
            webView.getSettings().setDomStorageEnabled(true);
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        } catch (Exception e) {
            Log.w(TAG, "WebView tuning failed", e);
        }

        webView.setWebViewClient(new BidWarWebViewClient(bridge));

        if (!handleOAuthDeepLink(getIntent())) {
            String shell = BuildConfig.MOBILE_SHELL_URL;
            String current = webView.getUrl();
            boolean needsShell =
                    current == null
                            || current.isEmpty()
                            || (current.startsWith("http") && !current.startsWith(trimSlash(shell)));
            if (needsShell) {
                Log.i(TAG, "Loading mobile shell: " + shell);
                webView.loadUrl(shell);
            }
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv != null) {
                    String url = wv.getUrl() != null ? wv.getUrl() : "";
                    if (url.startsWith("file:///android_asset/offline")) {
                        wv.loadUrl(BuildConfig.MOBILE_SHELL_URL);
                        return;
                    }
                    if (wv.canGoBack()) {
                        wv.goBack();
                        return;
                    }
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOAuthDeepLink(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        Bridge bridge = getBridge();
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            String url = webView != null ? webView.getUrl() : null;
            if (webView != null && (url == null || url.isEmpty())) {
                Log.w(TAG, "WebView empty on resume — reloading shell");
                webView.loadUrl(BuildConfig.MOBILE_SHELL_URL);
            }
        }
    }

    /**
     * @return true if the intent was an OAuth deep link and was consumed
     */
    private boolean handleOAuthDeepLink(@Nullable Intent intent) {
        if (intent == null) return false;
        Uri uri = intent.getData();
        if (uri == null) return false;
        if (!"bidwar".equalsIgnoreCase(uri.getScheme())) return false;
        if (!"oauth-complete".equalsIgnoreCase(uri.getHost())) return false;

        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return false;

        String shell = BuildConfig.MOBILE_SHELL_URL;
        if (!shell.endsWith("/")) shell = shell + "/";
        String handoff = uri.getQueryParameter("handoff");
        String error = uri.getQueryParameter("error");
        String target;
        if (handoff != null && !handoff.isEmpty()) {
            target = shell + "organizer/login?google_handoff=" + Uri.encode(handoff);
        } else if (error != null && !error.isEmpty()) {
            target = shell + "organizer/login?error=" + Uri.encode(error);
        } else {
            target = shell + "organizer/login";
        }
        Log.i(TAG, "OAuth deep link → " + target);
        webView.loadUrl(target);
        return true;
    }

    private static String trimSlash(String url) {
        if (url == null) return "";
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private boolean isBidWarHost(@Nullable String host) {
        if (host == null) return false;
        return ALLOWED_HOSTS.contains(host.toLowerCase());
    }

    private boolean isGoogleOAuthStartPath(@Nullable String path) {
        if (path == null) return false;
        return path.equals("/api/auth/google") || path.equals("/api/auth/google/");
    }

    private boolean isGoogleOAuthHost(@Nullable String host) {
        if (host == null) return false;
        String h = host.toLowerCase();
        return h.equals("accounts.google.com")
                || h.equals("oauth2.googleapis.com")
                || h.equals("accounts.youtube.com")
                || h.endsWith(".google.com")
                || h.endsWith(".googleapis.com")
                || h.endsWith(".gstatic.com")
                || h.endsWith(".googleusercontent.com");
    }

    private void openCustomTab(String url) {
        try {
            CustomTabsIntent tabs = new CustomTabsIntent.Builder().setShowTitle(true).build();
            tabs.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            tabs.launchUrl(this, Uri.parse(url));
        } catch (Exception e) {
            Log.w(TAG, "Custom Tabs failed — falling back to ACTION_VIEW", e);
            openExternal(url);
        }
    }

    private void openExternal(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open external URL: " + url, e);
        }
    }

    private class BidWarWebViewClient extends BridgeWebViewClient {
        BidWarWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) return false;
            String scheme = uri.getScheme() != null ? uri.getScheme() : "";
            if (scheme.equals("bidwar")) {
                handleOAuthDeepLink(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
            if (!scheme.equals("http") && !scheme.equals("https")) {
                openExternal(uri.toString());
                return true;
            }
            // Defense in depth: never keep Google OAuth inside the WebView.
            if (isGoogleOAuthHost(uri.getHost())) {
                openCustomTab(uri.toString());
                return true;
            }
            // Start Google OAuth in Custom Tabs so cookies + handoff stay consistent
            // (WebView cookie jar is separate from Chrome — native_app triggers deep-link return).
            if (isBidWarHost(uri.getHost()) && isGoogleOAuthStartPath(uri.getPath())) {
                Uri.Builder b = uri.buildUpon().clearQuery();
                Set<String> names = uri.getQueryParameterNames();
                for (String name : names) {
                    if ("native_app".equals(name)) continue;
                    for (String value : uri.getQueryParameters(name)) {
                        b.appendQueryParameter(name, value);
                    }
                }
                b.appendQueryParameter("native_app", "android");
                openCustomTab(b.build().toString());
                return true;
            }
            if (!isBidWarHost(uri.getHost())) {
                openExternal(uri.toString());
                return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) {
                Log.w(TAG, "Main-frame error — showing offline page");
                view.loadUrl(OFFLINE_URL + "?shell=" + Uri.encode(BuildConfig.MOBILE_SHELL_URL));
                return;
            }
            super.onReceivedError(view, request, error);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            Log.e(TAG, "WebView renderer gone — recovering");
            runOnUiThread(() -> {
                try {
                    recreate();
                } catch (Exception e) {
                    Log.e(TAG, "recreate failed", e);
                }
            });
            return true;
        }
    }
}
