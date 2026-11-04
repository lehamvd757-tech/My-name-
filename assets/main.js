document.documentElement.classList.add('js');

const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && revealItems.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.14,
    rootMargin: '0px 0px -8% 0px'
  });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const header = document.querySelector('.site-header');
const hero = document.querySelector('.hero');

if (header && hero && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    header.classList.toggle('on-hero', entry.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);
}

const backToTop = document.querySelector('#back-to-top');

if (backToTop) {
  backToTop.addEventListener('click', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

    if (window.location.hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  });
}
