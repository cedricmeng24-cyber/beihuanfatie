/* ==========================================================================
   To Whity — 动效运行时
   1. 开屏（logo + 诗句逐字 + 2 秒后跳转）
   2. 标题打字机
   3. 滚动触发的入场（正文 / 图片 / 归档）
   4. 两层折叠归档
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ========================================================================
     1. 开屏
     ======================================================================== */
  var Splash = {
    el: null,
    key: 'towhity_splash_seen',
    duration: 2900,

    init: function () {
      this.el = document.getElementById('splash');
      if (!this.el) { document.body.classList.add('booted'); return; }

      // 本会话已经看过就不再放
      var seen = false;
      try { seen = sessionStorage.getItem(this.key) === '1'; } catch (e) {}

      if (seen || reduceMotion) {
        this.el.remove();
        document.body.classList.add('booted');
        this.startPage();
        return;
      }

      // 锁定滚动，避免开屏期间页面在背后滚
      document.documentElement.style.overflow = 'hidden';
      this.typePoem();
      var self = this;
      setTimeout(function () { self.finish(); }, this.duration);
    },

    typePoem: function () {
      var poem = this.el.querySelector('.splash-poem');
      if (!poem) return;
      var text = poem.getAttribute('data-text') || poem.textContent.trim();
      poem.textContent = '';
      var frag = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch === ' ') { frag.appendChild(document.createTextNode('\u00a0')); continue; }
        var span = document.createElement('span');
        span.className = 'ch';
        span.textContent = ch;
        span.style.animationDelay = (0.55 + i * 0.12) + 's';
        frag.appendChild(span);
      }
      poem.appendChild(frag);
    },

    finish: function () {
      if (!this.el || this.el.classList.contains('done')) return;
      try { sessionStorage.setItem(this.key, '1'); } catch (e) {}
      this.el.classList.add('done');
      document.documentElement.style.overflow = '';
      document.body.classList.add('booted');
      var self = this;
      setTimeout(function () { if (self.el && self.el.parentNode) self.el.remove(); }, 800);
      this.startPage();
    },

    startPage: function () {
      document.dispatchEvent(new CustomEvent('splash:done'));
    }
  };

  /* ========================================================================
     2. 打字机标题
     ======================================================================== */
  function typeTitle(el, text, after) {
    if (!el) { if (after) after(); return; }
    if (reduceMotion) {
      el.textContent = text;
      if (after) after();
      return;
    }

    el.textContent = '';
    el.classList.add('typing');

    var i = 0;
    var speed = text.length > 22 ? 32 : 46;   // 长标题稍快

    function step() {
      if (i >= text.length) {
        el.classList.remove('typing');
        if (after) after();
        return;
      }
      // 一帧一个字符，纯文本插入，不再包 span（避免大量节点）
      el.textContent = text.slice(0, ++i);
      setTimeout(step, speed);
    }
    setTimeout(step, 90);
  }

  /* ========================================================================
     3. 滚动入场
     ======================================================================== */
  var Enter = {
    io: null,

    init: function (root) {
      root = root || document;

      if (reduceMotion || !('IntersectionObserver' in window)) {
        // 不支持就全部直接显示
        root.querySelectorAll('[data-enter]').forEach(function (n) {
          n.classList.add('entered');
        });
        return;
      }

      if (!this.io) {
        this.io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add('entered');
              Enter.io.unobserve(en.target);
              // 动画播完把 will-change 撤掉
              setTimeout(function () {
                en.target.classList.add('settled');
              }, 2100);
            }
          });
        }, {
          rootMargin: '0px 0px -8% 0px',
          threshold: 0.05
        });
      }

      var io = this.io;
      root.querySelectorAll('[data-enter]').forEach(function (n) {
        if (n.classList.contains('entered')) return;
        // 已经在视口内的，延迟一点点错开给个节奏
        var r = n.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          n.style.transitionDelay = (0.05 + Math.random() * 0.12) + 's';
        }
        io.observe(n);
      });
    },

    // 新插入的节点
    watch: function (nodeList) {
      if (reduceMotion || !this.io) {
        Array.prototype.forEach.call(nodeList, function (n) {
          n.classList.add('entered');
        });
        return;
      }
      for (var i = 0; i < nodeList.length; i++) this.io.observe(nodeList[i]);
    }
  };

  /* ========================================================================
     4. 两层折叠归档
     ======================================================================== */
  var CHEV_SVG =
    '<svg class="chev" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function parseDate(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }

  function weekStart(d) {
    // 周一为一周起点
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var wd = (x.getDay() + 6) % 7;          // 周一=0
    x.setDate(x.getDate() - wd);
    return x;
  }

  function fmtMD(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function weekIndexInMonth(monday, monthRef) {
    // 周序号按「该周落在哪个自然月」算：
    // 一个周可能横跨两个月，取它四天以上所在的那个月当归属月。
    var m = monthRef;                                  // {y, m}
    var monthFirst = new Date(m.y, m.m, 1);
    var monthLast = new Date(m.y, m.m + 1, 0);

    // 这一周在本月内有几天
    var sunday = new Date(monday.getTime() + 6 * 86400000);
    var start = monday > monthFirst ? monday : monthFirst;
    var end = sunday < monthLast ? sunday : monthLast;
    var daysIn = Math.round((end - start) / 86400000) + 1;

    // 从本月第一天所在周的周一开始数
    var firstMon = weekStart(monthFirst);
    var diff = Math.round((monday - firstMon) / 604800000);
    var idx = diff + 1;

    // 若这一周在本月内不足 4 天（属于上个月尾巴），序号记 0，由调用方跳过
    if (daysIn < 4 && idx === 1) return 0;
    return idx > 0 ? idx : 0;
  }

  /**
   * 构建两层归档
   * @param {Array} posts  [{id,title,date}]
   * @param {string} currentId
   * @param {Object} opts { newestOnly: bool, onNavigate: fn(id) }
   */
  function buildArchive(posts, currentId, opts) {
    opts = opts || {};
    var container = opts.container;
    if (!container) return;
    container.innerHTML = '';

    // 1. 解析并按时间倒序
    var items = [];
    posts.forEach(function (p) {
      var d = parseDate(p.date);
      if (!d) return;
      items.push({ post: p, date: d, mon: weekStart(d) });
    });
    items.sort(function (a, b) { return b.date - a.date; });

    // 2. 分组：月份 -> 周
    var months = {};      // "2026-10" -> {key, label, weeks:{}}
    var monthOrder = [];
    items.forEach(function (it) {
      var y = it.date.getFullYear(), m = it.date.getMonth();
      var mk = y + '-' + (m + 1);
      if (!months[mk]) {
        months[mk] = { label: y + '年' + (m + 1) + '月', key: mk, weeks: {}, count: 0,
                       monthRef: { y: y, m: m } };
        monthOrder.push(mk);
      }
      months[mk].count++;

      // 跨月：那一周的周一可能属于上个月，两边都挂
      var wk = it.mon.getFullYear() + '-' + it.mon.getMonth() + '-' + it.mon.getDate();
      if (!months[mk].weeks[wk]) {
        months[mk].weeks[wk] = { monday: it.mon, items: [] };
      }
      months[mk].weeks[wk].items.push(it);
    });
    // 月份按时间倒序（posts 的顺序不保证）
    monthOrder.sort(function (a, b) {
      var pa = a.split('-'), pb = b.split('-');
      return (+pb[0] - +pa[0]) || (+pb[1] - +pa[1]);
    });

    // 3. 渲染
    var newestRendered = false;
    var firstWeekDone = false;

    monthOrder.forEach(function (mk) {
      var M = months[mk];

      var monthEl = document.createElement('div');
      monthEl.className = 'archive-month';
      monthEl.setAttribute('data-enter', '');

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'month-head';
      head.setAttribute('aria-expanded', 'true');
      head.innerHTML =
        '<span class="label">' + escapeHtml(M.label) + '</span>' +
        '<span class="count">' + M.count + ' 篇</span>' +
        CHEV_SVG;

      var body = document.createElement('div');
      body.className = 'month-body';
      var inner = document.createElement('div');
      inner.className = 'month-body-inner';
      body.appendChild(inner);

      // 周排序（倒序）
      var weekKeys = Object.keys(M.weeks).sort(function (a, b) {
        return M.weeks[b].monday - M.weeks[a].monday;
      });

      weekKeys.forEach(function (wk) {
        var W = M.weeks[wk];
        var wIdx = weekIndexInMonth(W.monday, M.monthRef);
        var sunday = new Date(W.monday.getTime() + 6 * 86400000);

        var weekEl = document.createElement('div');
        weekEl.className = 'archive-week';

        // 默认：只展开最新的那一周
        var shouldOpen = !firstWeekDone;
        if (opts.newestOnly !== false && !shouldOpen) weekEl.classList.add('collapsed');

        // 周标题：序号为 0 时（这个月只有零头）只显示日期区间
        var weekLabel = wIdx > 0
          ? '第' + cnNum(wIdx) + '周 ' + fmtMD(W.monday) + ' – ' + fmtMD(sunday)
          : fmtMD(W.monday) + ' – ' + fmtMD(sunday);

        var whead = document.createElement('button');
        whead.type = 'button';
        whead.className = 'week-head';
        whead.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        whead.innerHTML =
          '<span class="label">' + escapeHtml(weekLabel) + '</span>' +
          '<span class="count">' + W.items.length + ' 篇</span>' +
          CHEV_SVG;

        var wbody = document.createElement('div');
        wbody.className = 'week-body';
        var winner = document.createElement('div');
        winner.className = 'week-body-inner';
        wbody.appendChild(winner);

        W.items.forEach(function (it) {
          var a = document.createElement('a');
          a.className = 'post-row' + (it.post.id === currentId ? ' current' : '');
          a.href = 'index.html?post=' + encodeURIComponent(it.post.id);
          a.setAttribute('data-enter', '');
          var dd = it.date;
          a.innerHTML =
            '<span class="t">' + escapeHtml(it.post.title || '(无标题)') + '</span>' +
            '<span class="d">' + dd.getFullYear() + '年' + (dd.getMonth() + 1) + '月' +
              dd.getDate() + '日</span>';

          if (opts.onNavigate) {
            a.addEventListener('click', function (ev) {
              ev.preventDefault();
              opts.onNavigate(it.post.id);
            });
          }
          winner.appendChild(a);
          if (it.post.id === currentId) newestRendered = true;
        });

        // 折叠事件
        whead.addEventListener('click', function () {
          var collapsed = weekEl.classList.toggle('collapsed');
          whead.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        });

        weekEl.appendChild(whead);
        weekEl.appendChild(wbody);
        inner.appendChild(weekEl);
        firstWeekDone = true;
      });

      // 月份折叠事件
      head.addEventListener('click', function () {
        var collapsed = monthEl.classList.toggle('collapsed');
        head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });

      monthEl.appendChild(head);
      monthEl.appendChild(body);
      container.appendChild(monthEl);
    });

    Enter.init(container);
  }

  function cnNum(n) {
    var d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n <= 0) return String(n);
    if (n < 10) return d[n];
    if (n === 10) return '十';
    if (n < 20) return '十' + d[n - 10];
    return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ========================================================================
     导出
     ======================================================================== */
  window.TW = {
    Splash: Splash,
    Enter: Enter,
    typeTitle: typeTitle,
    buildArchive: buildArchive,
    parseDate: parseDate,
    weekStart: weekStart,
    escapeHtml: escapeHtml,
    cnNum: cnNum,
    reduceMotion: reduceMotion
  };

  // 开屏立刻初始化（DOM 里已有 #splash 时）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Splash.init(); });
  } else {
    Splash.init();
  }
})();
