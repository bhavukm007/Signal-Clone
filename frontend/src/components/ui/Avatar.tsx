import Image from 'next/image';
import { initials } from '@/lib/formatters';
import { useMediaObjectUrl } from '@/hooks/useMediaObjectUrl';
import type { User } from '@/types/models';

interface AvatarProps {
  name: string;
  color?: string;
  imageUrl?: string | null;
  size?: 'tiny' | 'small' | 'normal';
  online?: boolean;
}

export function Avatar({
  name,
  color = '#8298c9',
  imageUrl,
  size = 'normal',
  online = false,
}: AvatarProps) {
  const image = useMediaObjectUrl(imageUrl);
  return (
    <span
      className={`avatar ${size}`}
      style={{ backgroundColor: color }}
      role="img"
      aria-label={name}
    >
      {image ? (
        <Image className="avatar-image" src={image} alt="" width={48} height={48} unoptimized />
      ) : (
        initials(name)
      )}
      {online && <i className="online-dot" aria-label="Online" />}
    </span>
  );
}

export function UserAvatar({
  user,
  size = 'normal',
  online,
}: {
  user: User;
  size?: AvatarProps['size'];
  online?: boolean;
}) {
  return (
    <Avatar
      name={user.display_name}
      color={user.avatar_color}
      imageUrl={user.avatar_url}
      size={size}
      online={online}
    />
  );
}
