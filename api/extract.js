export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tmdb_id, type = 'movie', season, episode } = req.query;
  if (!tmdb_id) return res.status(400).json({ success: false, error: 'tmdb_id required' });

  const domains = [
    'https://vidsrc.net',
    'https://vidsrc.xyz',
    'https://vidsrc.in',
    'https://vidsrc.pm'
  ];

  const results = {};

  for (const domain of domains) {
    try {
      let embedUrl;
      if (type === 'tv') {
        embedUrl = `${domain}/embed/tv?tmdb=${tmdb_id}&season=${season || 1}&episode=${episode || 1}`;
      } else {
        embedUrl = `${domain}/embed/movie?tmdb=${tmdb_id}`;
      }

      const embedRes = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': domain
        }
      });

      if (!embedRes.ok) continue;
      const html = await embedRes.text();

      const patterns = [
        /file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
        /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
        /source:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i
      ];

      let m3u8Url = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) { m3u8Url = match[1]; break; }
      }

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

  return res.status(200).json({ success: true, results });
}
