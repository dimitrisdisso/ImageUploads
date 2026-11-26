export function shareLinks(url: string, title: string) {
  const link = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${link}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${link}&text=${text}` },
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: 'Viber', href: `viber://forward?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
  ];
}