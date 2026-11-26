import { useSiteSettings } from '@/lib/cms';
import { safeSocialUrl } from '@/lib/site-settings';

export function SettingsText({ name }: { name: string }) {
  const settings = useSiteSettings();
  const url = safeSocialUrl(settings[`${name}Link`]);
  return url ? <a href={url} className="hover:underline focus-visible:underline underline-offset-4">{settings[name]}</a> : <>{settings[name]}</>;
}