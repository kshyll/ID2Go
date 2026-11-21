


(() => {
  const db = window.ID2GoDB;
  const $ = id => document.getElementById(id);
  let busy = false;
  const feedback = message => { $('admin-feedback').textContent = message; };
  const cell = (row, value) => { const td = document.createElement('td'); td.textContent = value ?? '—'; row.append(td); };
  let dirty = false;
  let request = 0;
  async function loadAppointments() {
    const version = ++request;
    const date = $('appointment-day').value;
    $('appointment-rows').replaceChildren();
    $('appointment-message').textContent = date ? 'Loading appointments…' : 'Choose a service date.';
    if (!date) return;
    try {
      const {data,error} = await db.from('appointments').select('queue_number,full_name,time_slot,service,status').eq('appointment_date',date).order('created_at');
      if (version !== request) return;
      if (error) throw error;
      for (const a of data) {
        const row = document.createElement('tr');
        for (const value of [a.queue_number,a.full_name,a.time_slot,a.service,a.status]) cell(row,value);
        $('appointment-rows').append(row);
      }
      $('appointment-message').textContent = data.length ? data.length + ' appointments' : 'No appointments on this date.';
    } catch (error) {
      if (version === request) $('appointment-message').textContent = 'Unable to load appointments. ' + error.message;
    }
  }
  const refresh = async () => {
    const {data, error} = await db.rpc('admin_dashboard');
    if (error) throw error;
    ['total_appointments','waiting','completed'].forEach(key => { $(key).textContent = data[key]; });
    $('active-stations').textContent = `${data.stations.filter(s => s.status !== 'offline').length} / 4`;
    $('live-queue-body').replaceChildren();
    const summarize = (id, lines, empty) => {
      const list = $(id); list.replaceChildren();
      for (const line of lines.length ? lines : [empty]) { const li=document.createElement('li'); li.textContent=line; list.append(li); }
    };
    summarize('station-summary',data.stations.map(s => s.name + ' · ' + s.status),'No station information.');
    summarize('queue-preview',data.queue.filter(q => ['waiting','returned','called','in_service'].includes(q.status)).slice(0,4).map(q => 'Ticket ' + q.queue_number + ' · ' + q.status),'No active tickets.');
    const filter = $('status-filter'), selected = filter.value;
    filter.replaceChildren(new Option('All statuses',''));
    for (const status of new Set(data.queue.map(q => q.status))) filter.add(new Option(status,status));
    filter.value = selected;
    data.queue.forEach(item => {
      const row = document.createElement('tr');
      cell(row, item.queue_number); cell(row, `${item.student_name} (${item.student_number})`);
      cell(row, item.station_number); cell(row, item.status);
      row.dataset.status = item.status;
      const detail = document.createElement('button'); detail.textContent = 'View';
      detail.onclick = () => { $('detail').querySelector('p').textContent = [item.queue_number,item.student_name,item.service_name,item.study_level,item.status].filter(Boolean).join(' · '); $('detail').showModal(); };
      row.insertCell().append(detail);
      $('live-queue-body').append(row);
    });
    $('operator-directory').replaceChildren();
    for (const operator of data.operators) {
      const item = document.createElement('li');
      const station = data.settings.find(s => s.operator_id === operator.id);
      item.textContent = operator.email + ' · ' + (station?.name || 'Unassigned');
      $('operator-directory').append(item);
    }
    if (!data.operators.length) $('operator-directory').textContent = 'No operator accounts.';
    $('queue-search').dispatchEvent(new Event('input'));
    if (dirty) return;
    $('station-toggle-list').replaceChildren();
    data.settings.forEach(station => {
      const row = document.createElement('div'); row.className = 'toggle-row'; row.dataset.station = station.number;
      const label = document.createElement('label'); label.textContent = station.name + ' · ' + (data.stations.find(s => s.number === station.number)?.status || 'Unknown');
      const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = station.enabled;
      label.append(enabled);
      const select = document.createElement('select'); select.setAttribute('aria-label', `${station.name} operator`);
      const none = document.createElement('option'); none.value = ''; none.textContent = 'Not assigned'; select.append(none);
      data.operators.forEach(operator => { const option = document.createElement('option'); option.value = operator.id; option.textContent = operator.email; select.append(option); });
      select.value = station.operator_id || ''; row.append(label, select); $('station-toggle-list').append(row);
    });
    $('queue-search').dispatchEvent(new Event('input'));
  };
  document.addEventListener('DOMContentLoaded', async () => {
    if (!await window.ID2GoSession.requireRole('admin')) return;
    const links = [...document.querySelectorAll('nav a[href^="#"]')];
    function route() {
      const link = links.find(a => a.hash === location.hash) || links[0];
      for (const a of links) {
        $(a.hash.slice(1)).hidden = a !== link;
        if (a === link) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
      }
      const reports = link.hash === '#reports';
      $('view-title').textContent = reports ? 'Reports & Analytics' : link.textContent;
      $('topbar-label').textContent = reports ? 'ID2GO / Reports & Analytics' : 'ID2GO / Administration';
      $('refresh-admin').hidden = reports;
      if (reports) window.ID2GoReports.open();
      setMenu(false);
    }
    function setMenu(open) {
      document.body.classList.toggle('menu-open',open);
      $('drawer-dismiss').hidden = !open;
      $('menu').setAttribute('aria-expanded',String(open));
      if(open) links[0].focus();
    }
    $('drawer-dismiss').onclick = () => { setMenu(false); $('menu').focus(); };
    document.addEventListener('keydown', e => { if(e.key==='Escape' && !$('drawer-dismiss').hidden) $('drawer-dismiss').click(); });
    document.querySelector('nav').addEventListener('click', () => setMenu(false));
    window.addEventListener('hashchange',route); route();
    $('menu').onclick = () => setMenu(!document.body.classList.contains('menu-open'));
    $('status-filter').onchange = () => $('queue-search').dispatchEvent(new Event('input'));
    $('appointment-day').value = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    $('appointment-day').addEventListener('change', loadAppointments);
    loadAppointments();
    $('station-toggle-list').addEventListener('change', () => { dirty = true; feedback('Unsaved station changes.'); });
    const poll = setInterval(async () => {
      if (document.hidden || busy) return;
      busy = true;
      try { await refresh(); await loadAppointments(); } catch (error) { feedback(error.message); }
      finally { busy = false; }
    }, 30000);
    window.addEventListener('pagehide', () => clearInterval(poll), {once:true});
    $('queue-search').addEventListener('input', () => {
      const query = $('queue-search').value.toLowerCase();
      $('live-queue-body').querySelectorAll('tr').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query) || (!!$('status-filter').value && row.dataset.status !== $('status-filter').value); });
    });
    $('refresh-admin').addEventListener('click', async () => {
      if (busy) return; busy = true;
      try { await refresh(); feedback(''); } catch (error) { feedback(error.message); } finally { busy = false; }
    });
    $('btn-save-stations').addEventListener('click', async () => {
      if (busy) return; busy = true; $('btn-save-stations').disabled = true;
      try {
        const p_settings = [...$('station-toggle-list').children].map(row => ({number: Number(row.dataset.station), enabled: row.querySelector('input').checked, operator_id: row.querySelector('select').value || null}));
        const {error} = await db.rpc('admin_save_stations', {p_settings}); if (error) throw error;
        dirty = false; await refresh(); feedback('Station settings saved.');
      } catch (error) { feedback(`Save failed: ${error.message}`); }
      finally { busy = false; $('btn-save-stations').disabled = false; }
    });
    $('admin-logout').addEventListener('click', async () => { try { await window.ID2GoSession.logout(); } catch (error) { feedback(error.message); } });
    try { await refresh(); feedback(''); } catch (error) { feedback(`Unable to load dashboard: ${error.message}`); }
  });
})();
