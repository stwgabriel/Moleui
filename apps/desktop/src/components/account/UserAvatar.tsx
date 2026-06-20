import { useUser } from '@clerk/clerk-react';

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function gradientSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue} 84% 62%), hsl(${(hue + 54) % 360} 86% 48%))`;
}

export function UserAvatar({ className = 'h-10 w-10', showImage = true }: { className?: string; showImage?: boolean }) {
  const { user } = useUser();
  const label = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Moleui user';

  if (showImage && user?.imageUrl) {
    return <img src={user.imageUrl} alt="Account" className={`${className} rounded-full object-cover shadow-[0_10px_28px_rgba(88,70,220,0.14)]`} draggable={false} />;
  }

  return (
    <span
      className={`${className} inline-flex items-center justify-center rounded-full text-sm font-black text-white shadow-[0_10px_28px_rgba(88,70,220,0.14)]`}
      style={{ background: gradientSeed(label) }}
      aria-hidden="true"
    >
      {initials(label)}
    </span>
  );
}
