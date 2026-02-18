import { postToDiscord, buildAnnouncementEmbed } from '../lib/discord.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { type, payload } = req.body;

    if (type === 'deployment.succeeded' || type === 'deployment') {
      const deployment = payload?.deployment || payload || {};
      const meta = deployment.meta || {};

      const embed = buildAnnouncementEmbed({
        title: 'New Deployment Live 🚀',
        description: 'Stratify has been updated and deployed successfully.',
        features: [
          `Commit: \`${meta.githubCommitSha?.slice(0, 7) || 'unknown'}\``,
          `Message: ${meta.githubCommitMessage || 'No commit message'}`,
          `Branch: ${meta.githubCommitRef || 'main'}`,
        ],
        url: deployment.url ? `https://${deployment.url}` : 'https://stratify-eight.vercel.app',
      });

      await postToDiscord('announcements', { embeds: [embed] });
      return res.status(200).json({ success: true, posted: 'announcements' });
    }

    return res.status(200).json({ skipped: true, reason: `Event type: ${type}` });
  } catch (err) {
    console.error('Deploy hook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
