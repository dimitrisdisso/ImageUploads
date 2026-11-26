import street from '@/assets/street.jpg';
import meeting from '@/assets/meeting.jpg';
import walls from '@/assets/walls.jpg';
import culture from '@/assets/culture.jpg';
import { createContext, useContext } from 'react';
import type { Article, Author, Event } from './content';
import { publicationCategories, type PublicationCategory } from './editorial';
import { resolveSettings } from './site-settings';

export type ContentBundle = { articles: Article[]; authors: Record<string, Author>; events: Event[]; announcements: (Article & { id: string })[]; categories?: PublicationCategory[]; settings: Record<string,string> };
export const ContentContext = createContext<ContentBundle>({articles:[],authors:{},events:[],announcements:[],settings:{}});
export const useContent = () => useContext(ContentContext);
export const useCategories = () => publicationCategories(useContent().categories);
export const useSiteSettings = () => resolveSettings(useContent().settings);
export const bundledImages: Record<string,string> = {'asset:street.jpg':street,'asset:meeting.jpg':meeting,'asset:walls.jpg':walls,'asset:culture.jpg':culture};
export function canManage(roles: string[]) { return roles.includes('admin'); }