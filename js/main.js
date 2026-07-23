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
    const tabsEl = root.querySelector('.tabs');

    // モバイル用のプルダウン（タブから自動生成）
    const sel = document.createElement('select');
    sel.className = 'tab-select';
    btns.forEach(btn => {
      const opt = document.createElement('option');
      opt.value = btn.dataset.target;
      opt.textContent = btn.textContent;
      if (btn.classList.contains('is-active')) opt.selected = true;
      sel.appendChild(opt);
    });
    if (tabsEl) {
      const label = document.createElement('span');
      label.className = 'tab-select-label';
      label.textContent = '職種を選択（全' + btns.length + '種）';
      tabsEl.parentNode.insertBefore(label, tabsEl);
      tabsEl.parentNode.insertBefore(sel, tabsEl);
    }

    const activate = target => {
      btns.forEach(b => b.classList.toggle('is-active', b.dataset.target === target));
      panels.forEach(p => p.classList.toggle('is-active', p.id === target));
      sel.value = target;
    };
    btns.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.target)));
    sel.addEventListener('change', () => activate(sel.value));
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

  // Forms (実送信: Cloudflare Pages Function /api/submit へ POST)
  document.querySelectorAll('form[data-ajax]').forEach(form => {
    const msg = form.querySelector('.form-msg');
    const successText = msg ? msg.textContent : '送信を受け付けました。';
    const errorText = '送信に失敗しました。時間をおいて再度お試しいただくか、お電話でご連絡ください。';

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const btn = form.querySelector('button[type=submit]');
      const btnText = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '送信中…'; }

      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
        let out = {};
        try { out = await res.json(); } catch (_) { out = { ok: res.ok }; }

        if (res.ok && out.ok) {
          if (msg) {
            msg.textContent = successText;
            msg.classList.remove('is-error');
            msg.classList.add('is-visible');
          }
          form.querySelectorAll('input,select,textarea').forEach(el => {
            if (el.type !== 'hidden') el.value = '';
          });
        } else {
          throw new Error(out.error || 'failed');
        }
      } catch (err) {
        if (msg) {
          msg.textContent = errorText;
          msg.classList.add('is-visible', 'is-error');
        }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btnText; }
        window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
      }
    });
  });
});
