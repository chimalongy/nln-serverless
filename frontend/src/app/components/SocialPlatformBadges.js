const platformConfig = {
  facebook: {
    label: 'Facebook',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  instagram: {
    label: 'Instagram',
    className: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
};

function getSuccessfulPlatforms(socialPosts) {
  if (!socialPosts || typeof socialPosts !== 'object') {
    return [];
  }

  return Object.entries(socialPosts)
    .filter(([, entry]) => entry?.success === true)
    .map(([platform]) => platform);
}

export function SocialPlatformBadges({ socialPosts }) {
  const platforms = getSuccessfulPlatforms(socialPosts);

  if (platforms.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-xs text-slate-500 mr-0.5">Posted to:</span>
      {platforms.map((platform) => {
        const config = platformConfig[platform];

        return (
          <span
            key={platform}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
              config?.className || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
            }`}
            title={`Posted to ${config?.label || platform}`}
          >
            {config?.label || platform}
          </span>
        );
      })}
    </div>
  );
}
