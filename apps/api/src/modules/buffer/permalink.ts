/** The shortcode in an Instagram post URL (`/p/<code>`, `/reel/<code>`…), or null. */
export function instagramShortcode(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i.exec(url);
  return match?.[1] ?? null;
}
