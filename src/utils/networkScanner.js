import NetInfo from '@react-native-community/netinfo';

// Network scanner using WebSocket for React Native
// Enhanced with better logging and error handling

export const scanNetworkForServer = async (port = 5000, onDeviceFound) => {
    try {
        // Get current IP using NetInfo
        const netState = await NetInfo.fetch();

        console.log('[Scanner] Full network state:', JSON.stringify(netState, null, 2));

        // Check if we're on WiFi
        if (netState.type === 'cellular') {
            console.warn('[Scanner] ⚠️ WARNING: You are on CELLULAR network, not WiFi!');
            console.warn('[Scanner] Please connect to WiFi or enable hotspot on this phone.');
            console.warn('[Scanner] Scanning will likely fail unless server is accessible via mobile network.');
        }

        // NetInfo returns different structures on different platforms
        let ip = null;

        if (netState.details) {
            // Android/iOS specific
            ip = netState.details.ipAddress ||
                netState.details.ipv4Address ||
                netState.details.subnet;
        }

        console.log('[Scanner] Detected IP:', ip);
        console.log('[Scanner] Network type:', netState.type);
        console.log('[Scanner] Network details:', netState.details);

        if (!ip || ip === '0.0.0.0') {
            console.log("[Scanner] No valid IP detected. Using common subnets...");
            ip = '192.168.1.100'; // Dummy IP to extract subnet
        }

        const currentSubnet = ip.substring(0, ip.lastIndexOf('.'));
        console.log('[Scanner] Current subnet:', currentSubnet);

        const subnetsToScan = new Set([
            currentSubnet,
            '192.168.1',    // Common home network
            '192.168.0',    // Common home network
            '192.168.43',   // Android hotspot
            '172.20.10',    // iOS hotspot
            '10.0.0'        // Some routers
        ]);

        const fullScanOrder = [];

        // Helper to generate IPs for a subnet
        const generateIPs = (subnet) => {
            const priority = Array.from({ length: 10 }, (_, i) => i + 1); // .1 to .10
            const dhcpPool = Array.from({ length: 20 }, (_, i) => i + 100); // .100 to .119

            return [...priority, ...dhcpPool].map(suffix => `${subnet}.${suffix}`);
        };

        subnetsToScan.forEach(subnet => {
            if (!subnet) return;
            const ips = generateIPs(subnet);
            fullScanOrder.push(...ips);
        });

        const promises = [];
        const uniqueIPs = [...new Set(fullScanOrder)];

        console.log(`[Scanner] 🔍 Scanning ${uniqueIPs.length} IPs across ${subnetsToScan.size} subnets`);
        console.log(`[Scanner] Subnets: ${Array.from(subnetsToScan).join(', ')}`);

        for (const targetIp of uniqueIPs) {
            if (targetIp === ip) continue;
            promises.push(() => checkWebSocketPort(targetIp, port, onDeviceFound));
        }

        // Batch execution
        const CHUNK_SIZE = 10;
        let scannedCount = 0;

        for (let i = 0; i < promises.length; i += CHUNK_SIZE) {
            const chunk = promises.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(p => p()));

            scannedCount += chunk.length;
            if (scannedCount % 50 === 0) {
                console.log(`[Scanner] Progress: ${scannedCount}/${promises.length} IPs scanned...`);
            }

            // Small delay to prevent overwhelming the network stack
            await new Promise(r => setTimeout(r, 100));
        }

        console.log('[Scanner] ✅ Scan complete');
    } catch (e) {
        console.error("[Scanner] ❌ Scan failed:", e);
    }
};

const checkWebSocketPort = (ip, port, onDeviceFound) => {
    return new Promise((resolve) => {
        const url = `ws://${ip}:${port}`;
        let ws = null;
        let resolved = false;

        const cleanup = () => {
            if (ws) {
                try {
                    ws.onopen = null;
                    ws.onerror = null;
                    ws.onclose = null;
                    ws.close();
                } catch (e) {
                    // Ignore cleanup errors
                }
                ws = null;
            }
            if (!resolved) {
                resolved = true;
                resolve();
            }
        };

        try {
            ws = new WebSocket(url);

            // Set a timeout
            const timer = setTimeout(() => {
                cleanup();
            }, 400); // 400ms timeout per IP

            ws.onopen = () => {
                // Found it!
                console.log(`[Scanner] ✅✅✅ SERVER FOUND at ${ip}:${port} ✅✅✅`);
                clearTimeout(timer);
                onDeviceFound({ ip: ip, name: `Server ${ip}` });
                cleanup();
            };

            ws.onerror = (error) => {
                // Most IPs will error - this is expected
                clearTimeout(timer);
                cleanup();
            };

            ws.onclose = () => {
                clearTimeout(timer);
                cleanup();
            };

        } catch (err) {
            cleanup();
        }
    });
};

/**
 * Get local IP address
 * @returns {Promise<string|null>}
 */
export const getLocalIP = async () => {
    try {
        const netState = await NetInfo.fetch();

        if (netState.details) {
            return netState.details.ipAddress ||
                netState.details.ipv4Address ||
                null;
        }

        return null;
    } catch (e) {
        console.error('[Scanner] Failed to get local IP:', e);
        return null;
    }
};

/**
 * Check if device is on WiFi
 */
export const isOnWiFi = async () => {
    try {
        const netState = await NetInfo.fetch();
        return netState.type === 'wifi';
    } catch (e) {
        return false;
    }
};
