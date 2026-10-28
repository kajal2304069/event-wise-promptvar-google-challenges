/* Eventwise: helpers, event templates and plan builders. Loaded first; everything hangs off window.EW. */
(function () {
  'use strict';
  var EW = (window.EW = window.EW || {});

  /* ---------- small helpers ---------- */
  EW.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  EW.uid = function () { return Math.random().toString(36).slice(2, 9); };
  var DAY = 864e5;
  EW.parseD = function (s) { var p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  EW.iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  EW.today = function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  EW.addDays = function (d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  EW.diffDays = function (s, b) { return Math.round((EW.parseD(s) - b) / DAY); };
  EW.validDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(EW.parseD(s).getTime()); };
  EW.fmtDate = function (s, o) { return EW.parseD(s).toLocaleDateString(undefined, o || { day: 'numeric', month: 'short', year: 'numeric' }); };
  EW.fmtLong = function (s) { return EW.parseD(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); };
  EW.rel = function (s) {
    var d = EW.diffDays(s, EW.today());
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    if (d === -1) return 'yesterday';
    return d > 0 ? 'in ' + d + ' days' : Math.abs(d) + ' days ago';
  };
  EW.sum = function (a, k) { return a.reduce(function (t, x) { return t + (Number(x[k]) || 0); }, 0); };
  EW.plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  /* ---------- money ---------- */
  EW.CUR = {
    INR: { s: '₹', l: 'en-IN', n: 'Indian rupee' }, USD: { s: '$', l: 'en-US', n: 'US dollar' },
    EUR: { s: '€', l: 'en-IE', n: 'Euro' }, GBP: { s: '£', l: 'en-GB', n: 'British pound' },
    AUD: { s: 'A$', l: 'en-AU', n: 'Australian dollar' }, CAD: { s: 'C$', l: 'en-CA', n: 'Canadian dollar' },
    AED: { s: 'AED ', l: 'en-AE', n: 'UAE dirham' }
  };
  EW.money = function (n, c) {
    var m = EW.CUR[c] || EW.CUR.INR;
    n = Math.round(Number(n) || 0);
    return (n < 0 ? '−' : '') + m.s + Math.abs(n).toLocaleString(m.l);
  };
  /* round a planned amount to a tidy step that suits the size of the budget */
  EW.nice = function (n, total) {
    var step = total >= 500000 ? 1000 : total >= 50000 ? 500 : total >= 5000 ? 50 : 1;
    return Math.round(n / step) * step;
  };

  /* ---------- event templates ---------- */
  EW.TYPES = {
    wedding: {
      label: 'Wedding', blurb: 'Ceremony, reception and the weeks around them',
      cats: [['Venue', 22], ['Catering', 28], ['Photo & video', 10], ['Decor & flowers', 10], ['Attire & beauty', 10], ['Music & entertainment', 6], ['Invitations & stationery', 2], ['Transport & stay', 4], ['Gifts & favours', 2], ['Buffer', 6]],
      tasks: [[365, 'Set the total budget and a first guest list'], [330, 'Shortlist and visit venues'], [300, 'Book the venue and fix the date'], [270, 'Book the photographer and videographer'], [240, 'Book the caterer and hold a tasting'], [210, 'Send save-the-dates'], [180, 'Book decorator and florist'], [150, 'Start shopping for attire'], [120, 'Book music, DJ or band'], [100, 'Book makeup and hair artists'], [84, 'Send formal invitations'], [60, 'Plan guest stays and transport'], [45, 'Finalise the menu and the day-of schedule'], [30, 'Confirm every vendor in writing'], [21, 'Final fittings and beauty trials'], [14, 'Collect RSVPs and finalise the seating plan'], [7, 'Pack payment envelopes and a day-of kit'], [2, 'Rehearsal and final headcount to the caterer'], [0, 'Wedding day'], [-2, 'Send thank-you notes and settle final balances']],
      vendors: ['Venue', 'Caterer', 'Photographer', 'Videographer', 'Decorator & florist', 'Makeup & hair', 'DJ or band', 'Priest or officiant', 'Invitation printer', 'Cake & desserts', 'Transport'],
      ideas: [
        { title: 'Golden-hour ceremony', detail: 'Time the vows for the hour before sunset so photos and light do the decorating for you. Costs nothing extra.', tag: 'Theme' },
        { title: 'Live regional food stations', detail: 'Three or four chef-run counters from the couple’s home regions feel personal and cut plated-service staffing.', tag: 'Food' },
        { title: 'Hand-written guest notes', detail: 'Leave a card at each seat. Ask close friends to write them in the week before; it takes an evening.', tag: 'Gift' },
        { title: 'Memory table', detail: 'Framed photos of grandparents and earlier weddings in the family, placed near the entrance.', tag: 'Decor' },
        { title: 'Late-night chai and snacks', detail: 'A small cart after the first dance keeps energy up and replaces a second dessert course.', tag: 'Food' },
        { title: 'Playlist from the guests', detail: 'Add a song-request line to the invitation RSVP and give the DJ the top forty.', tag: 'Music' }]
    },
    birthday: {
      label: 'Birthday', blurb: 'From a first birthday to a milestone year',
      cats: [['Venue', 20], ['Food & cake', 35], ['Decor & balloons', 12], ['Entertainment', 15], ['Invitations', 3], ['Return gifts', 8], ['Photography', 4], ['Buffer', 3]],
      tasks: [[56, 'Set the budget and a guest list'], [49, 'Choose the theme and the venue'], [42, 'Send invitations'], [35, 'Book entertainment and a photographer'], [28, 'Order the cake'], [21, 'Plan the menu and order decor'], [14, 'Chase RSVPs and buy return gifts'], [7, 'Confirm every vendor and plan the schedule'], [2, 'Pick up the cake, balloons and supplies'], [0, 'Party day'], [-1, 'Send thank-you messages and share photos']],
      vendors: ['Venue', 'Caterer or food order', 'Cake', 'Decorator', 'Entertainer', 'Photographer', 'Return gifts supplier'],
      ideas: [
        { title: 'Treasure hunt around the venue', detail: 'Eight clues in rhyme, each ending at a small prize. Works from age five to adult.', tag: 'Activity' },
        { title: 'Build-your-own food bar', detail: 'Mini pizzas, tacos or dosa fillings. Guests assemble their own, which keeps kitchen costs low.', tag: 'Food' },
        { title: 'Photo wall with props', detail: 'A plain backdrop, a string of lights and a basket of props gives you pictures for the group chat.', tag: 'Decor' },
        { title: 'Seed-packet return gifts', detail: 'Small, cheap and not another piece of plastic. Add a hand-stamped tag with the date.', tag: 'Gift' },
        { title: 'Guest of honour playlist', detail: 'Ask the birthday person for ten songs and ask three friends for five each.', tag: 'Music' },
        { title: 'Colour-coded dress code', detail: 'Pick two colours and mention them on the invite. Group photos look planned without any budget.', tag: 'Theme' }]
    },
    community: {
      label: 'Community event', blurb: 'Fairs, drives, festivals and meetups',
      cats: [['Venue & permits', 18], ['Food & refreshments', 25], ['Sound & AV', 12], ['Marketing & printing', 10], ['Programme & speakers', 10], ['Volunteers & supplies', 8], ['Insurance & safety', 5], ['Cleanup & logistics', 4], ['Buffer', 8]],
      tasks: [[90, 'Write the goal, audience and success measure'], [80, 'Secure the venue and the permits'], [70, 'Recruit a core team and name leads for each area'], [60, 'Confirm speakers and performers'], [55, 'Start sponsor and donation outreach'], [45, 'Open registration and launch promotion'], [30, 'Book sound, stage and seating'], [21, 'Confirm the volunteer roster and shifts'], [14, 'Plan first aid, security and accessibility'], [7, 'Walk the site and finalise the run-of-show'], [1, 'Brief volunteers and set up'], [0, 'Event day'], [-3, 'Debrief the team and thank sponsors and volunteers']],
      vendors: ['Venue and permit office', 'Caterer or food stalls', 'Sound & AV', 'Printer for banners and flyers', 'Security and first aid', 'Stage and seating rental', 'Cleanup crew'],
      ideas: [
        { title: 'Neighbourhood passport', detail: 'Visitors collect a stamp at each stall and enter a draw at the end. Pushes footfall to every corner.', tag: 'Activity' },
        { title: 'Sponsor-a-stall', detail: 'Local shops cover a stall’s cost for a banner and a mention. Offer three clear price tiers.', tag: 'Theme' },
        { title: 'Potluck table with labels', detail: 'Ask households to bring a dish with an ingredients card. Cheap, welcoming and good for dietary needs.', tag: 'Food' },
        { title: 'Kids’ corner with volunteers', detail: 'A tent with chalk, bubbles and two vetted volunteers lets parents stay longer.', tag: 'Activity' },
        { title: 'Open-mic hour', detail: 'Ten-minute slots for residents. Cap it at six acts and keep a timer on stage.', tag: 'Music' },
        { title: 'Reusable cup deposit', detail: 'Small refundable deposit cuts waste and cleanup time. Collect cups at one return point.', tag: 'Gift' }]
    }
  };

  /* ---------- plan builders ---------- */
  /* Task dates are counted back from the event date. If the event is closer than the
     standard lead time, every date is squeezed proportionally so nothing starts in the past. */
  EW.buildTasks = function (type, dateStr) {
    var tpl = EW.TYPES[type].tasks, total = EW.diffDays(dateStr, EW.today());
    var max = Math.max.apply(null, tpl.map(function (x) { return x[0]; }));
    var scale = (total > 0 && max > total) ? total / max : 1;
    return tpl.map(function (x) {
      var d = x[0];
      var due = d <= 0 ? EW.addDays(EW.parseD(dateStr), -d) : EW.addDays(EW.parseD(dateStr), -Math.round(d * scale));
      return { id: EW.uid(), title: x[1], due: EW.iso(due), done: false };
    });
  };
  /* Standard budget split. The last line (Buffer) absorbs rounding so the total always matches. */
  EW.applySplit = function (type, budget, keepSpent, existing) {
    var T = EW.TYPES[type], out = [], used = 0;
    T.cats.forEach(function (c, i) {
      var last = i === T.cats.length - 1;
      var planned = last ? Math.max(0, budget - used) : EW.nice(budget * c[1] / 100, budget);
      used += planned;
      var prev = (existing || []).filter(function (x) { return x.name.toLowerCase() === c[0].toLowerCase(); })[0];
      out.push({ id: prev ? prev.id : EW.uid(), name: c[0], planned: planned, spent: prev && keepSpent ? prev.spent : 0 });
    });
    return out;
  };
  EW.buildEvent = function (o) {
    var T = EW.TYPES[o.type];
    return {
      id: EW.uid(), type: o.type, name: o.name, date: o.date, guests: o.guests, budget: o.budget, currency: o.currency,
      city: o.city || '', style: o.style || '',
      categories: EW.applySplit(o.type, o.budget, false),
      tasks: EW.buildTasks(o.type, o.date),
      vendors: T.vendors.map(function (r) { return { id: EW.uid(), role: r, name: '', contact: '', quote: 0, status: 'Researching', notes: '' }; }),
      ideas: [], pool: [], chat: [], example: !!o.example
    };
  };
  /* The example event shown on first launch, with some progress filled in */
  EW.seed = function () {
    var e = EW.buildEvent({ type: 'wedding', name: 'Meera & Arjun’s Wedding', date: EW.iso(EW.addDays(EW.today(), 158)), guests: 180, budget: 1500000, currency: 'INR', city: 'Jaipur', style: 'Garden ceremony, marigold and white, live shehnai at the entrance', example: true });
    e.tasks.slice(0, 3).forEach(function (x) { x.done = true; });
    function sp(n, v) { e.categories.forEach(function (c) { if (c.name === n) c.spent = v; }); }
    sp('Venue', 150000); sp('Photo & video', 40000); sp('Invitations & stationery', 12000);
    function vd(r, p) { e.vendors.forEach(function (v) { if (v.role === r) Object.keys(p).forEach(function (k) { v[k] = p[k]; }); }); }
    vd('Venue', { name: 'Lakeview Gardens', contact: 'events@lakeview.example', quote: 330000, status: 'Booked', notes: 'Deposit paid. Garden lawn and two rooms held for the family.' });
    vd('Caterer', { name: 'Saffron Table', quote: 420000, status: 'Quoted', notes: 'Tasting on the first weekend of next month.' });
    vd('Photographer', { name: 'Frame & Flame Studio', quote: 150000, status: 'Booked', notes: 'Two photographers, one videographer for the ceremony.' });
    vd('Decorator & florist', { status: 'Contacted', notes: 'Waiting on a moodboard from the florist.' });
    return { v: 1, active: e.id, events: [e], theme: null };
  };
})();
