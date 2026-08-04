import { useCallback, useEffect, useState } from "react";

const RELEASES_API_URL =
    'https://api.github.com/repos/Blake-Ballew/Celestial-Wayfinder/releases?per_page=30';

// GitHub serves release assets from a host that sends no CORS headers, so the
// PWA can't fetch a .bin straight off a release. The project's GitHub Pages
// site mirrors each release's assets at <base>/<tag>/<asset name> and does
// send `Access-Control-Allow-Origin: *`, which is what makes a one-click
// install possible. Releases published before the mirror existed aren't there,
// hence the fallback in Firmware's handleInstallRelease.
const FIRMWARE_MIRROR_BASE = 'https://wyrdwyrks.com/Celestial-Wayfinder';

// Release assets are named e.g. "firmware-hardware-v3-3.7.0.bin"; the captured
// group is the hardware version the firmware is built for.
const FIRMWARE_ASSET_REGEX = /^firmware-hardware-v(\d+)-.+\.bin$/i;

// How many compatible releases to show.
const MAX_RELEASES = 5;

export type FirmwareRelease = {
    version: string;
    date: string;
    description: string;
    hwVersion: number;
    mirrorUrl: string; // CORS-enabled copy on GitHub Pages; fetchable from here
    downloadUrl: string; // GitHub's own asset URL; only usable as a browser download
    htmlUrl: string;
    assetName: string;
};

// Compare firmware version strings ignoring a leading "v" (tags are "v3.7.0"
// while the device reports e.g. "3.7.0").
export function versionsMatch(a: string, b: string): boolean {
    return a.replace(/^v/i, '') === b.replace(/^v/i, '');
}

// Fetch the most recent releases that ship a firmware asset for the given
// hardware version. Throws on network/HTTP/parse failures so callers can
// surface a friendly error.
async function fetchCompatibleFirmware(
    hardwareVersion: number,
    signal: AbortSignal,
): Promise<FirmwareRelease[]> {
    const response = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        signal,
    });
    if (!response.ok) {
        throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
        throw new Error('Unexpected response from the GitHub releases API');
    }

    const compatible: FirmwareRelease[] = [];
    // GitHub returns releases newest-first, so the first matches are the latest.
    for (const release of releases) {
        if (compatible.length >= MAX_RELEASES) break;
        if (release.draft || release.prerelease) continue;

        const asset = (release.assets ?? []).find((a: { name?: string }) => {
            const match = a.name ? FIRMWARE_ASSET_REGEX.exec(a.name) : null;
            return match !== null && Number(match[1]) === hardwareVersion;
        });
        if (!asset) continue;

        compatible.push({
            version: release.tag_name,
            date: (release.published_at ?? '').slice(0, 10),
            description: (release.body ?? '').trim() || release.name || 'No release notes provided.',
            hwVersion: hardwareVersion,
            mirrorUrl: `${FIRMWARE_MIRROR_BASE}/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset.name)}`,
            downloadUrl: asset.browser_download_url,
            htmlUrl: release.html_url,
            assetName: asset.name,
        });
    }

    return compatible;
}

// Fetches (and re-fetches on demand) the compatible firmware releases for a
// hardware version. Lifted out of the Firmware tab so the update badge can
// know about a new release without that tab ever being opened.
export function useFirmwareReleases(hardwareVersion?: number) {
    const [releases, setReleases] = useState<FirmwareRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Bumping this re-runs the fetch effect (used by the "Retry" button).
    const [reloadCount, setReloadCount] = useState(0);

    useEffect(() => {
        if (hardwareVersion === undefined) {
            setReleases([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetchCompatibleFirmware(hardwareVersion, controller.signal)
            .then((result) => {
                setReleases(result);
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setReleases([]);
                setError(err instanceof Error ? err.message : 'Failed to load firmware releases.');
                setLoading(false);
            });

        return () => controller.abort();
    }, [hardwareVersion, reloadCount]);

    const reload = useCallback(() => setReloadCount((c) => c + 1), []);

    return { releases, loading, error, reload };
}
