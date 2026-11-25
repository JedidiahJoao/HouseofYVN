const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelectorAll('.site-nav a');
const year = document.querySelector('[data-year]');

const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 40);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuButton.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
});

navLinks.forEach((link) => link.addEventListener('click', () => {
  document.body.classList.remove('menu-open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const caseTabs = [...document.querySelectorAll('[role="tab"]')];
const selectCase = (tab) => {
  caseTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
};

caseTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectCase(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % caseTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + caseTabs.length) % caseTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = caseTabs.length - 1;
    else return;
    event.preventDefault();
    caseTabs[nextIndex].focus();
    selectCase(caseTabs[nextIndex]);
  });
});

year.textContent = new Date().getFullYear();
