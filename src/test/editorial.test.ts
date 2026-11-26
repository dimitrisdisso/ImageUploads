import { describe, expect, it } from 'vitest';
import { publicationError, upcomingEvents, subscriptionData, publicationCategories, requirePhotoCredit, commentsAreEnabled } from '@/lib/editorial';

describe('Editorial requirements', () => {
  it.each(['post','announcement','event','author','category'])('allows an incomplete %s draft', kind => {
    expect(publicationError(kind, {}, 'draft')).toBe('');
    expect(publicationError(kind, {}, 'published')).not.toBe('');
  });
  it('publishes a completed announcement', () => {
    expect(publicationError('announcement', { title: 'Νέα', slug: 'nea-anakoinosi', date: '2026-10-26', html: '<p>Ανακοίνωση</p>' }, 'published')).toBe('');
  });
  it('requires explicit newsletter consent', () => {
    expect(() => subscriptionData('reader@example.org', false)).toThrow();
    expect(subscriptionData(' Reader@example.org ', true)).toEqual({ email: 'reader@example.org', consent: true, consentVersion: 'newsletter-v1' });
  });
  it('removes past events from the homepage but leaves the source list intact', () => {
    const base={title:'Event',time:'12:00',place:'Square',type:'Meet',description:''};
    const events=[{...base,date:'2026-10-25'},{...base,date:'2026-10-26'},{...base,date:'2026-10-27'}];
    expect(upcomingEvents(events,'2026-10-26').map(e=>e.date)).toEqual(['2026-10-26','2026-10-27']);
    expect(events).toHaveLength(3);
  });
  it('retains custom category homepage visibility', () => {
    expect(publicationCategories([{slug:'new-tab',name:'New',description:'',showOnHome:false}])['new-tab']?.showOnHome).toBe(false);
  });
  it('requires a source for every new photo', () => {
    expect(()=>requirePhotoCredit(' ')).toThrow();
    expect(requirePhotoCredit(' Photographer ')).toBe('Photographer');
  });
  it('disables comments individually while preserving legacy defaults', () => {
    expect(commentsAreEnabled({ commentsEnabled: false })).toBe(false);
    expect(commentsAreEnabled({ commentsEnabled: true })).toBe(true);
    expect(commentsAreEnabled({})).toBe(true);
  });
});
import { sortEventsNewestFirst as sortNewest, publicationCategories as pubCats, unseenCount as unseen } from '@/lib/editorial';
describe('admin requests', () => {
  it('sorts events with the oldest last', () => {
    expect(sortNewest([{date:'2026-01-01'},{date:'2026-05-01'},{date:'2025-12-01'}]).map(e=>e.date)).toEqual(['2026-05-01','2026-01-01','2025-12-01']);
  });
  it('removes a hidden built-in section', () => {
    expect(pubCats([{slug:'nea',name:'Νέα',description:'',showOnHome:true,hidden:true}])['nea']).toBeUndefined();
  });
  it('counts only messages newer than last visit', () => {
    expect(unseen([{kind:'comment',created_at:'2026-01-02'},{kind:'comment',created_at:'2025-12-31'},{kind:'tip',created_at:'2026-02-01'}],'comment','2026-01-01')).toBe(1);
  });
});
