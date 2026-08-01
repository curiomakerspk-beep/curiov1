// ── Global Backend Server Configuration ─────────────────────────────────────
window.ENV = {
    // Your Backend Convert Server URL (Update this IP whenever your network changes)
    CONVERT_SERVER: "https://cm-convert-backend-347233988269.us-central1.run.app",

    // Helper function: Returns Cloudflare Tunnel URL if present, otherwise CONVERT_SERVER
    getBackendUrl: function() {
        const origin = window.location.origin;
        if (origin.includes('trycloudflare.com')) {
            return origin;
        }
        return this.CONVERT_SERVER;
    }
};
