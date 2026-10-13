const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/**
 * Round user avatar: the profile photo when there is one, otherwise the initials on a role-coloured circle.
 * Pass `role` for the role colour, or `tone` (e.g. "avatar-blue") to force a class. `size` is in pixels.
 */
export default function Avatar({ name, role, photo, tone, size }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.36) } : undefined;
  if (photo) return <img className="avatar avatar-photo" src={photo} alt="" style={style} />;
  return <span className={`avatar ${tone || (role ? `avatar-tone-${role}` : 'avatar-blue')}`} style={style}>{initials(name)}</span>;
}
