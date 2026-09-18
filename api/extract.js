export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tmdb_id, type = 'movie', season, episode } = req.query;
  if (!tmdb_id) return res.status(400).json({ success: false, error: 'tmdb_id required' });

  const results = {};

  // Working vidsrc domains (updated)
  const domains = [
    'https://vidsrc.rip',
    'https://vidsrc.to',
    'https://vidsrc.cc',
    'https://vidsrc.net',
    'https://vidsrc.pm'
  ];

  for (const domain of domains) {
    try {
      let embedUrl;
      if (type === 'tv') {
        embedUrl = `${domain}/embed/tv/${tmdb_id}/${season || 1}/${episode || 1}`;
      } else {
        embedUrl = `${domain}/embed/movie/${tmdb_id}`;
      }

      // Use proper headers to avoid blocking
      const r = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': domain,
          'Origin': domain
        },
        redirect: 'follow'
      });

      if (!r.ok) {
        results[domain] = { hls_url: null, subtitles: [], error: `HTTP ${r.status}` };
        continue;
      }

      const html = await r.text();

      // Multiple M3U8 patterns
      const patterns = [
        /"file"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/i,
        /'file'\s*:\s*'(https?:\/\/[^']+\.m3u8[^']*)'/i,
        /file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
        /source:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
        /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
        /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i
      ];

      let m3u8Url = null;
      for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1]) { m3u8Url = m[1]; break; }
      }

      // Subtitles
      let subtitles = [];
      const subMatch = html.match(/["'](https?:\/\/[^"']+\.(vtt|srt))["']/gi);
      if (subMatch) subtitles = subMatch.map(s => s.replace(/["']/g, ''));

      results[domain] = {
        hls_url: m3u8Url,
        subtitles: subtitles,
        error: m3u8Url ? null : 'No M3U8 found'
      };
    } catch (err) {
      results[domain] = { hls_url: null, subtitles: [], error: err.message };
    }
  }

  // Return the first working stream
  const working = Object.entries(results).find(([_, v]) => v.hls_url);
  
  return res.status(200).json({
    success: true,
    results,
    best: working ? { domain: working[0], ...working[1] } : null
  });
}
