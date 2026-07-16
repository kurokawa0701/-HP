// ENPI Corporate Site
document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav
  const toggle = document.querySelector('.nav-toggle');
  const gnav = document.querySelector('.gnav');
  if (toggle && gnav) {
    toggle.addEventListener('click', () => gnav.classList.toggle('is-open'));
    gnav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => gnav.classList.remove('is-open')));
  }

  // Scroll reveal
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Tabs (recruit)
  document.querySelectorAll('[data-tabs]').forEach(root => {
    const btns = root.querySelectorAll('.tab-btn');
    const panels = root.querySelectorAll('.tab-panel');
    btns.forEach(btn => btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('is-active'));
      panels.forEach(p => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      root.querySelector('#' + btn.dataset.target).classList.add('is-active');
    }));
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0';
    });
  });

  // Forms (demo: show completion message)
  document.querySelectorAll('form[data-demo]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      if (msg) { msg.classList.add('is-visible'); }
      form.querySelectorAll('input,select,textarea').forEach(el => { el.value = ''; });
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
    });
  });
});
