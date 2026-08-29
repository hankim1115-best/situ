import { mount } from './ui.js';
import { route, startRouter } from './router.js';
import { homeView } from './views/home.js';
import { resultView } from './views/result.js';
import { libraryView } from './views/library.js';
import { setDetailView } from './views/setDetail.js';
import { reviewView, resetReviewSession } from './views/review.js';
import { practiceView, resetPracticeSession } from './views/practice.js';
import { keywordsView, resetKeywordsView } from './views/keywords.js';
import { settingsView } from './views/settings.js';

route('/', () => mount(homeView()));
route('/keywords', () => {
  resetKeywordsView();
  mount(keywordsView());
});
route('/result', () => mount(resultView()));
route('/library', () => mount(libraryView()));
route('/set/:id', (ctx) => mount(setDetailView(ctx)));
route('/review', (ctx) => {
  resetReviewSession();
  mount(reviewView(ctx));
});
route('/practice/:id', (ctx) => {
  resetPracticeSession();
  mount(practiceView(ctx));
});
route('/settings', () => mount(settingsView()));

startRouter();

// Register the service worker (offline shell). Ignored on file:// or if unsupported.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e));
  });
}
