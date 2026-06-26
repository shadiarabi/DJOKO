// DJOKO Accounting v2.5 - fixed line calculation
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'

const SURL = 'https://nlhllkpuqvtllpiginyn.supabase.co'
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5saGxsa3B1cXZ0bGxwaWdpbnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDk5NjAsImV4cCI6MjA5NjY4NTk2MH0.eoUxK5D2oF-ybpnpktw7vHjS0_1aWPVyPuoEKfQXw7M'
const sb = createClient(SURL, SKEY)

// ── CURRENCIES & RATES ────────────────────────────────────
const CURS = {
  USD:{s:'$',d:2}, EUR:{s:'€',d:2}, GBP:{s:'£',d:2},
  IDR:{s:'Rp',d:0}, BRL:{s:'R$',d:2}, JPY:{s:'¥',d:0},
  CNY:{s:'¥',d:2}, AED:{s:'د.إ',d:2}, SGD:{s:'S$',d:2},
  ZAR:{s:'R',d:2}, NGN:{s:'₦',d:0}, KES:{s:'KSh',d:2}
}
const RATES = {USD:1,EUR:0.92,GBP:0.79,IDR:15800,BRL:4.97,JPY:149.5,CNY:7.24,AED:3.67,SGD:1.34,ZAR:18.6,NGN:1580,KES:130}

// ── STATE ─────────────────────────────────────────────────
let baseCur = 'USD'
let settings = {company:'DJOKO',address:'',phone:'',email:'',vat_number:'',invoice_prefix:'INV-',po_prefix:'PO-',payment_terms:30}
let customers=[], suppliers=[], products=[], invoices=[], purchases=[], receipts=[], payments=[], expenses=[], stockAdjustments=[]
let invLines=[], poLines=[]

// ── HELPERS ───────────────────────────────────────────────
const toBase = (n,cur) => n*(RATES[baseCur]||1)/(RATES[cur]||1)
const fc = (n,cur) => { cur=cur||baseCur; const c=CURS[cur]||{s:'$',d:2}; return c.s+Number(n).toLocaleString('en-US',{minimumFractionDigits:c.d,maximumFractionDigits:c.d}) }
const fmt = n => fc(n,baseCur)
const td = () => new Date().toISOString().slice(0,10)
const addD = (d,n) => { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10) }
const el = id => document.getElementById(id)
const erow = (n,m) => `<tr class="erow"><td colspan="${n}">${m}</td></tr>`
const delBtn = fn => `<button class="btn icon ghost" onclick="${fn}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:var(--red)"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>`
const editBtn = fn => `<button class="btn icon ghost" onclick="${fn}" title="Edit" style="color:var(--acc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`

function toast(msg, ok=true, duration=2800) {
  el('toast-msg').textContent = msg
  el('toast').querySelector('svg').style.color = ok ? '#4ADE80' : '#F87171'
  el('toast').classList.add('show')
  setTimeout(() => el('toast').classList.remove('show'), duration)
}
function saved() { el('tsave').style.opacity='1'; setTimeout(()=>el('tsave').style.opacity='0',1500) }
function setDb(ok,msg) { el('dbdot').className='tdb '+(ok?'':'red'); el('dbtext').textContent=msg }
function loading(show) { el('loader').classList.toggle('show',show) }

function bcs(id,val) {
  const s=el(id); if(!s)return
  s.innerHTML = Object.keys(CURS).map(c=>`<option value="${c}"${c===(val||baseCur)?'selected':''}>${c}</option>`).join('')
}
function pSel(id,arr,field,extra='') {
  const s=el(id); if(!s)return
  s.innerHTML = extra+arr.map(x=>`<option value="${x.id}">${x[field]}</option>`).join('')
}
function sbadge(s) {
  const m={paid:'bp',pending:'bn',partial:'bpa',overdue:'bo',draft:'bd'}
  return `<span class="badge ${m[s]||'bd'}"><span class="dot"></span>${s}</span>`
}
function skb(q,r) { return q<=0?'<span class="badge bout">Out</span>':q<=r?'<span class="badge blow">Low</span>':'<span class="badge bok">OK</span>' }
function ftbl(id,q) { el(id).querySelectorAll('tr:not(.erow)').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none') }

// ── NAV ───────────────────────────────────────────────────
window.nav = function(elem, page) {
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'))
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  if(elem) elem.classList.add('active')
  el('page-'+page).classList.add('active')
  if(page==='dashboard') renderDash()
  if(page==='reports') renderReports()
  if(page==='expenses') renderExpenses()
  if(page==='stock') renderStockStats()
}
window.ftbl = ftbl

// ── MODALS ────────────────────────────────────────────────
window.openModal = function(id) {
  const d = td()
  if(id==='mo-settings'){el('set-co').value=settings.company;el('set-addr').value=settings.address||'';el('set-ph').value=settings.phone||'';el('set-em').value=settings.email||'';el('set-vat').value=settings.vat_number||'';el('set-ip').value=settings.invoice_prefix||'INV-';el('set-pt').value=settings.payment_terms||30}
  if(id==='mo-customer') { delete el('mo-customer').dataset.editId; bcs('cl-cur') }
  if(id==='mo-supplier') { delete el('mo-supplier').dataset.editId; bcs('su-cur') }
  if(id==='mo-stock') { delete el('mo-stock').dataset.editId; el('sk-code').value='PRD-'+(products.length+1).toString().padStart(3,'0') }
  if(id==='mo-invoice'){
    bcs('inv-cur','BRL');el('inv-date').value=d;el('inv-due').value=addD(d,settings.payment_terms||30)
    // Use last saved taxa rate, not hardcoded 5.50
    const lastTaxa = (() => { try { return localStorage.getItem('djoko_last_taxa') } catch(e){ return null } })()
    if(el('inv-taxa')) el('inv-taxa').value = lastTaxa || '5.50'
    // Generate unique invoice number using count + timestamp suffix
    const invCount = (invoices.length+1).toString().padStart(3,'0')
    el('inv-num').value=(settings.invoice_prefix||'INV-')+invCount
    el('inv-disc').value=0; el('inv-status').value='pending'; el('inv-notes').value=''
    pSel('inv-cust',customers,'name','<option value="">Select customer...</option>')
    invLines=[];addInvLine();renderInvLines()
    delete el('mo-invoice').dataset.editId
    el('inv-save-btn').textContent='Save invoice'
    el('mo-invoice').querySelector('.mh h3').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--acc)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> New Sales Invoice'
  }
  if(id==='mo-purchase'){
    // CRITICAL: clear any leftover edit state from a cancelled edit
    delete el('mo-purchase').dataset.editId
    delete el('mo-purchase').dataset.editOldStatus
    delete el('mo-purchase').dataset.editBaseAmt
    bcs('po-cur');el('po-date').value=d;el('po-del').value=addD(d,14)
    el('po-num').value=(settings.po_prefix||'PO-')+(purchases.length+1).toString().padStart(3,'0')
    el('po-status').value='pending'
    pSel('po-sup',suppliers,'name','<option value="">Select supplier...</option>')
    poLines=[];addPoLine();renderPoLines()
    if(el('po-save-btn')) el('po-save-btn').textContent='Save PO'
    const h3=el('mo-purchase').querySelector('.mh h3')
    if(h3) h3.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--acc)"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> New Purchase Order'
  }
  if(id==='mo-receipt'){bcs('rc-cur');el('rc-date').value=d;pSel('rc-cust',customers,'name','<option value="">Select customer...</option>')}
  if(id==='mo-payment'){bcs('py-cur');el('py-date').value=d;pSel('py-sup',suppliers,'name','<option value="">Select supplier...</option>')}
  if(id==='mo-expense'){ delete el('mo-expense').dataset.editId; bcs('ex-cur');el('ex-date').value=d }
  if(id==='mo-stockadj'){
    pSel('adj-prod', products, 'name', '<option value="">Select product...</option>')
    el('adj-current').value=''; el('adj-new').value=''
    el('adj-diff').textContent='—'; el('adj-diff').style.color='var(--txt)'
    el('adj-reason').value='Physical count correction'; el('adj-notes').value=''
  }
  if(id==='mo-adj-history'){ renderAdjHistory() }
  el(id).classList.add('open')
}
window.closeModal = function(id) {
  el(id).classList.remove('open')
  // Safety: clear any edit-mode flags when modal is closed/cancelled
  delete el(id).dataset.editId
  delete el(id).dataset.editOldStatus
  delete el(id).dataset.editBaseAmt
}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)closeModal(o.id)}))
window.changeCurrency = function() { baseCur=el('base-currency').value; renderAll() }

// ── INVOICE LINES ─────────────────────────────────────────
window.addInvLine = function() { invLines.push({prod:null,qty:1,price:0,disc:0,com:0}); renderInvLines() }
window.addPoLine = function() { poLines.push({prod:null,qty:1,cost:0}); renderPoLines() }
// ── RENDER INVOICE LINES ──────────────────────────────────
function renderInvLines() {
  const cur = el('inv-cur')?.value || baseCur
  let html = '<table style="width:100%;border-collapse:collapse;margin-bottom:4px"><thead><tr style="background:#F9FAFB">'
  html += '<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr)">PRODUCT</th>'
  html += '<th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:65px">QTY</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:85px">PRICE</th>'
  html += '<th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:55px">DISC%</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:#7C3AED;border-bottom:1px solid var(--bdr);width:90px">COM (R$)</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:85px">TOTAL</th>'
  html += '<th style="border-bottom:1px solid var(--bdr);width:26px"></th>'
  html += '</tr></thead><tbody>'
  invLines.forEach((l,i) => {
    const qty=parseFloat(l.qty)||0, price=parseFloat(l.price)||0, disc=parseFloat(l.disc)||0
    const lt = qty*price*(1-disc/100)
    const stockQty = l.prod ? (l.prod.qty||0) : null
    const stockColor = stockQty===null?'':stockQty<=0?'color:#DC2626':stockQty<5?'color:#D97706':'color:#16A34A'
    const stockLabel = stockQty===null?'':`<span style="font-size:9px;${stockColor};margin-left:4px">(stock: ${stockQty})</span>`
    html += '<tr>'
    html += '<td style="padding:4px 4px 4px 0">'
    html += '<select id="inv-prod-'+i+'" onchange="ilProd('+i+',this.value)" style="width:100%;padding:5px 6px;border:1px solid var(--bdr2);border-radius:4px;font-size:11px;background:var(--inp)">'
    html += '<option value="">Select product...</option>'
    products.forEach(p => {
      const avail = p.qty||0
      const color = avail<=0?'color:#DC2626':avail<5?'color:#D97706':''
      html += `<option value="${p.id}"${l.prod&&l.prod.id===p.id?' selected':''} style="${color}">${p.name} — stock: ${avail} ${p.uom}</option>`
    })
    html += '</select>'
    if(l.prod) html += `<div style="font-size:9px;margin-top:2px;${stockColor}">Available in stock: <strong>${stockQty} ${l.prod.uom||''}</strong>${stockQty<=0?' ⚠️ OUT OF STOCK':stockQty<5?' ⚠️ LOW STOCK':' ✓'}</div>`
    html += '</td>'
    html += '<td style="padding:4px"><input id="inv-qty-'+i+'" type="number" value="'+(l.qty||1)+'" min="1" step="1" oninput="setInvQty('+i+',this.value)" onchange="setInvQty('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:center;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="inv-price-'+i+'" type="number" value="'+(l.price||0)+'" min="0" step="0.01" oninput="setInvPrice('+i+',this.value)" onchange="setInvPrice('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:right;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="inv-disc-line-'+i+'" type="number" value="'+(l.disc||0)+'" min="0" max="100" step="1" oninput="setInvDisc('+i+',this.value)" onchange="setInvDisc('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:center;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="inv-com-'+i+'" type="number" value="'+(l.com||0)+'" min="0" step="0.01" placeholder="0.00" oninput="setInvCom('+i+',this.value)" onchange="setInvCom('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid #DDD6FE;border-radius:4px;font-size:12px;text-align:right;background:#F5F3FF;color:#7C3AED;font-weight:600"></td>'
    html += '<td style="padding:4px;text-align:right;font-size:12px;font-weight:600;color:var(--acc)" id="inv-lt-'+i+'">'+fc(lt,cur)+'</td>'
    html += '<td style="padding:4px 0"><button onclick="rmInvLine('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;padding:3px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
    html += '</tr>'
  })
  // TOTALS ROW
  const totalQty = invLines.reduce((a,l)=>a+(parseFloat(l.qty)||0),0)
  const totalAmt = invLines.reduce((a,l)=>a+(parseFloat(l.qty)||0)*(parseFloat(l.price)||0)*(1-(parseFloat(l.disc)||0)/100),0)
  const totalCom = invLines.reduce((a,l)=>a+(parseFloat(l.com)||0),0)
  html += `<tr style="background:#F9FAFB;border-top:2px solid var(--bdr)">
    <td style="padding:7px 8px;font-size:11px;font-weight:700;color:var(--tx2)">TOTAL</td>
    <td style="padding:7px 4px;text-align:center;font-weight:700;color:var(--acc);font-size:13px">${totalQty}</td>
    <td colspan="2"></td>
    <td style="padding:7px 4px;text-align:right;font-weight:700;color:#7C3AED;font-size:12px">${totalCom>0?'R$'+totalCom.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td>
    <td style="padding:7px 4px;text-align:right;font-weight:700;color:var(--acc);font-size:13px">${fc(totalAmt,cur)}</td>
    <td></td>
  </tr>`
  html += '</tbody></table>'
  el('inv-lines').innerHTML = html
  calcInv()
}

window.refreshInvLine = function(i) {
  const cur = el('inv-cur')?.value || baseCur
  const l = invLines[i]
  const qty=parseFloat(l.qty)||0, price=parseFloat(l.price)||0, disc=parseFloat(l.disc)||0
  const lt = qty*price*(1-disc/100)
  const e=el('inv-lt-'+i); if(e) e.textContent=fc(lt,cur)
  calcInv()
}

function renderPoLines() {
  const cur = el('po-cur')?.value || baseCur
  let html = '<table style="width:100%;border-collapse:collapse;margin-bottom:4px"><thead><tr style="background:#F9FAFB">'
  html += '<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr)">PRODUCT</th>'
  html += '<th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:65px">QTY</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:100px">UNIT COST</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:100px">LINE TOTAL</th>'
  html += '<th style="border-bottom:1px solid var(--bdr);width:26px"></th></tr></thead><tbody>'
  poLines.forEach((l,i) => {
    const qty=parseFloat(l.qty)||0, cost=parseFloat(l.cost)||0, lt=qty*cost
    const stockQty = l.prod ? (l.prod.qty||0) : null
    const stockColor = stockQty===null?'':stockQty<=0?'color:#DC2626':stockQty<5?'color:#D97706':'color:#16A34A'
    html += '<tr>'
    html += '<td style="padding:4px 4px 4px 0">'
    html += '<select id="po-prod-'+i+'" onchange="plProd('+i+',this.value)" style="width:100%;padding:5px 6px;border:1px solid var(--bdr2);border-radius:4px;font-size:11px;background:var(--inp)">'
    html += '<option value="">Select product...</option>'
    products.forEach(p => {
      const avail = p.qty||0
      html += `<option value="${p.id}"${l.prod&&l.prod.id===p.id?' selected':''}>${p.name} — stock: ${avail} ${p.uom}</option>`
    })
    html += '</select>'
    if(l.prod) html += `<div style="font-size:9px;margin-top:2px;${stockColor}">Current stock: <strong>${stockQty} ${l.prod.uom||''}</strong> → after purchase: <strong style="color:var(--grn)">${stockQty+qty} ${l.prod.uom||''}</strong></div>`
    html += '</td>'
    html += '<td style="padding:4px"><input id="po-qty-'+i+'" type="number" value="'+(l.qty||1)+'" min="1" step="1" oninput="setPoQty('+i+',this.value)" onchange="setPoQty('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:center;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="po-cost-'+i+'" type="number" value="'+(l.cost||0)+'" min="0" step="0.01" oninput="setPoQost('+i+',this.value)" onchange="setPoQost('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:right;background:var(--inp)"></td>'
    html += '<td style="padding:4px;text-align:right;font-size:12px;font-weight:600;color:var(--acc)" id="po-lt-'+i+'">'+fc(lt,cur)+'</td>'
    html += '<td style="padding:4px 0"><button onclick="rmPoLine('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;padding:3px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
    html += '</tr>'
  })
  // TOTALS ROW
  const totalQty = poLines.reduce((a,l)=>a+(parseFloat(l.qty)||0),0)
  const totalAmt = poLines.reduce((a,l)=>a+(parseFloat(l.qty)||0)*(parseFloat(l.cost)||0),0)
  html += `<tr style="background:#F9FAFB;border-top:2px solid var(--bdr)">
    <td style="padding:7px 8px;font-size:11px;font-weight:700;color:var(--tx2)">TOTAL</td>
    <td style="padding:7px 4px;text-align:center;font-weight:700;color:var(--acc);font-size:13px">${totalQty}</td>
    <td></td>
    <td style="padding:7px 4px;text-align:right;font-weight:700;color:var(--acc);font-size:13px">${fc(totalAmt,cur)}</td>
    <td></td>
  </tr>`
  html += '</tbody></table>'
  el('po-lines').innerHTML = html
  calcPo()
}

window.refreshPoLine = function(i) {
  const cur = el('po-cur')?.value || baseCur
  const l = poLines[i]
  const qty=parseFloat(l.qty)||0, cost=parseFloat(l.cost)||0, lt=qty*cost
  const e=el('po-lt-'+i); if(e) e.textContent=fc(lt,cur)
  calcPo()
}

// ── GLOBAL LINE UPDATE HELPERS ─────────────────────────────
window.setInvQty = function(i,v){ invLines[i].qty=parseFloat(v)||0; refreshInvLine(i) }
window.setInvCom = function(i,v){ invLines[i].com=parseFloat(v)||0; refreshInvLine(i) }
window.setInvPrice = function(i,v){ invLines[i].price=parseFloat(v)||0; refreshInvLine(i) }
window.setInvDisc = function(i,v){ invLines[i].disc=parseFloat(v)||0; refreshInvLine(i) }
window.setPoQty = function(i,v){ poLines[i].qty=parseFloat(v)||0; refreshPoLine(i) }
window.setPoQost = function(i,v){ poLines[i].cost=parseFloat(v)||0; refreshPoLine(i) }
window.rmInvLine = function(i){ invLines.splice(i,1); renderInvLines() }
window.rmPoLine = function(i){ poLines.splice(i,1); renderPoLines() }




window.addPoLine = function() { poLines.push({prod:null,qty:1,cost:0}); renderPoLines() }

// ── INVOICE LINE PRODUCT SELECTED ─────────────────────────
window.ilProd = function(i, pid) {
  const p = products.find(x => x.id === pid)
  invLines[i].prod = p || null
  if(p) {
    invLines[i].price = parseFloat(p.sell_price) || 0
  }
  renderInvLines()
}

// ── PO LINE PRODUCT SELECTED ──────────────────────────────
window.plProd = function(i, pid) {
  const p = products.find(x => x.id === pid)
  poLines[i].prod = p || null
  if(p) {
    poLines[i].cost = parseFloat(p.cost_price) || 0
  }
  renderPoLines()
}

// ── UPDATE INV LINE FIELD ─────────────────────────────────
window.updateInvLine = function(i, field, val) {
  invLines[i][field] = parseFloat(val) || 0
  // Update just the line total span and grand total — no re-render
  const cur = el('inv-cur')?.value || baseCur
  const l = invLines[i]
  const lt = (l.qty||0) * (l.price||0) * (1 - (l.disc||0)/100)
  const span = document.getElementById('ilt'+i)
  if(span) span.textContent = fc(lt, cur)
  calcInv()
}

// ── UPDATE PO LINE FIELD ──────────────────────────────────
window.updatePoLine = function(i, field, val) {
  poLines[i][field] = parseFloat(val) || 0
  const cur = el('po-cur')?.value || baseCur
  const l = poLines[i]
  const lt = (l.qty||0) * (l.cost||0)
  const span = document.getElementById('plt'+i)
  if(span) span.textContent = fc(lt, cur)
  calcPo()
}

// ── RENDER INVOICE LINES ──────────────────────────────────


window.calcInv = function() {
  const cur = el('inv-cur')?.value || baseCur
  let sub = 0
  invLines.forEach(l => {
    sub += (parseFloat(l.qty)||0) * (parseFloat(l.price)||0) * (1-(parseFloat(l.disc)||0)/100)
  })
  const discPct = parseFloat(el('inv-disc')?.value) || 0
  const discAmt = sub * discPct / 100
  const total = Math.max(0, sub - discAmt)

  // Total commission (direct R$ amounts)
  const totalCom = invLines.reduce((a,l)=>a+(parseFloat(l.com)||0),0)
  // Show totals in invoice currency (BRL)
  if(el('inv-sub')) el('inv-sub').textContent = fc(sub, cur)
  if(el('inv-disc-amt')) el('inv-disc-amt').textContent = discAmt>0 ? '- '+fc(discAmt,cur) : ''
  if(el('inv-total')) el('inv-total').textContent = fc(total, cur)
  if(el('inv-com-total')) el('inv-com-total').textContent = totalCom>0 ? 'R$'+totalCom.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'

  // USD equivalent: taxa = how many R$ per 1 USD (e.g. 5.50)
  // so USD = BRL total / taxa
  const taxa = parseFloat(el('inv-taxa')?.value) || 5.50
  const totalUSD = taxa > 0 ? total / taxa : 0
  if(el('inv-total-usd')) {
    el('inv-total-usd').textContent = '$' + totalUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  }
}

// ── CALC PO TOTAL ─────────────────────────────────────────
window.calcPo = function() {
  const cur = el('po-cur')?.value || baseCur
  let total = 0
  poLines.forEach(l => { total += (parseFloat(l.qty)||0) * (parseFloat(l.cost)||0) })
  if(el('po-total')) el('po-total').textContent = fc(total, cur)
}

// ── SETTINGS ──────────────────────────────────────────────
window.saveSettings = async function() {
  const data={company:el('set-co').value||'DJOKO',address:el('set-addr').value,phone:el('set-ph').value,email:el('set-em').value,vat_number:el('set-vat').value,invoice_prefix:el('set-ip').value||'INV-',payment_terms:parseInt(el('set-pt').value)||30,base_currency:baseCur,updated_at:new Date().toISOString()}
  const {data:rows} = await sb.from('settings').select('id').limit(1)
  if(rows?.length) await sb.from('settings').update(data).eq('id',rows[0].id)
  else await sb.from('settings').insert(data)
  Object.assign(settings,data)
  el('tco').textContent=settings.company
  closeModal('mo-settings'); saved(); toast('Settings saved')
}

// ── CUSTOMERS ─────────────────────────────────────────────
window.saveCust = async function() {
  const name=el('cl-name').value.trim(); if(!name)return alert('Name required')
  const bal=parseFloat(el('cl-bal').value)||0
  const {data,error}=await sb.from('customers').insert({name,email:el('cl-email').value,phone:el('cl-phone').value,address:el('cl-addr').value,currency:el('cl-cur').value||baseCur,opening_balance:bal}).select().single()
  if(error)return toast('Error: '+error.message,false)
  customers.push({...data,totalInvoiced:bal,totalPaid:0,balance:bal})
  renderCustomers(); renderDash(); closeModal('mo-customer'); saved(); toast('Customer added')
  ;['cl-name','cl-email','cl-phone','cl-addr','cl-bal'].forEach(id=>el(id).value='')
}
window.delCust = async function(id) {
  if(!confirm('Delete?'))return
  await sb.from('customers').delete().eq('id',id)
  customers=customers.filter(c=>c.id!==id); renderCustomers(); toast('Deleted')
}
window.editCust = function(id) {
  const c=customers.find(x=>x.id===id); if(!c)return
  bcs('cl-cur',c.currency)
  el('cl-name').value=c.name; el('cl-email').value=c.email||''; el('cl-phone').value=c.phone||''
  el('cl-addr').value=c.address||''; el('cl-bal').value=c.opening_balance||0
  el('mo-customer').classList.add('open')
  el('mo-customer').dataset.editId=id
  el('mo-customer').querySelector('.mf button:last-child').textContent='Update customer'
  el('mo-customer').querySelector('.mh h3').lastChild.textContent=' Edit Customer'
}
window.saveCust = async function() {
  const name=el('cl-name').value.trim(); if(!name)return alert('Name required')
  const bal=parseFloat(el('cl-bal').value)||0
  const editId=el('mo-customer').dataset.editId
  const row={name,email:el('cl-email').value,phone:el('cl-phone').value,address:el('cl-addr').value,currency:el('cl-cur').value||baseCur,opening_balance:bal}
  if(editId){
    const {error}=await sb.from('customers').update(row).eq('id',editId)
    if(error)return toast('Error: '+error.message,false)
    const c=customers.find(x=>x.id===editId); if(c)Object.assign(c,row)
    delete el('mo-customer').dataset.editId
  } else {
    const {data,error}=await sb.from('customers').insert(row).select().single()
    if(error)return toast('Error: '+error.message,false)
    customers.push({...data,totalInvoiced:bal,totalPaid:0,balance:bal})
  }
  renderCustomers(); renderDash(); closeModal('mo-customer'); saved(); toast(editId?'Customer updated':'Customer added')
  ;['cl-name','cl-email','cl-phone','cl-addr','cl-bal'].forEach(id=>el(id).value='')
  el('mo-customer').querySelector('.mf button:last-child').textContent='Save customer'
}

// ── SUPPLIERS ─────────────────────────────────────────────
window.saveSupp = async function() {
  const name=el('su-name').value.trim(); if(!name)return alert('Name required')
  const bal=parseFloat(el('su-bal').value)||0
  const {data,error}=await sb.from('suppliers').insert({name,email:el('su-email').value,phone:el('su-phone').value,address:el('su-addr').value,currency:el('su-cur').value||baseCur,opening_balance:bal}).select().single()
  if(error)return toast('Error: '+error.message,false)
  suppliers.push({...data,totalPurchased:bal,totalPaid:0,owed:bal})
  renderSuppliers(); renderDash(); closeModal('mo-supplier'); saved(); toast('Supplier added')
  ;['su-name','su-email','su-phone','su-addr','su-bal'].forEach(id=>el(id).value='')
}
window.delSupp = async function(id) {
  if(!confirm('Delete?'))return
  await sb.from('suppliers').delete().eq('id',id)
  suppliers=suppliers.filter(s=>s.id!==id); renderSuppliers(); toast('Deleted')
}
window.editSupp = function(id) {
  const s=suppliers.find(x=>x.id===id); if(!s)return
  bcs('su-cur',s.currency)
  el('su-name').value=s.name; el('su-email').value=s.email||''; el('su-phone').value=s.phone||''
  el('su-addr').value=s.address||''; el('su-bal').value=s.opening_balance||0
  el('mo-supplier').classList.add('open')
  el('mo-supplier').dataset.editId=id
  el('mo-supplier').querySelector('.mf button:last-child').textContent='Update supplier'
}
window.saveSupp = async function() {
  const name=el('su-name').value.trim(); if(!name)return alert('Name required')
  const bal=parseFloat(el('su-bal').value)||0
  const editId=el('mo-supplier').dataset.editId
  const row={name,email:el('su-email').value,phone:el('su-phone').value,address:el('su-addr').value,currency:el('su-cur').value||baseCur,opening_balance:bal}
  if(editId){
    const {error}=await sb.from('suppliers').update(row).eq('id',editId)
    if(error)return toast('Error: '+error.message,false)
    const s=suppliers.find(x=>x.id===editId); if(s)Object.assign(s,row)
    delete el('mo-supplier').dataset.editId
  } else {
    const {data,error}=await sb.from('suppliers').insert(row).select().single()
    if(error)return toast('Error: '+error.message,false)
    suppliers.push({...data,totalPurchased:bal,totalPaid:0,owed:bal})
  }
  renderSuppliers(); renderDash(); closeModal('mo-supplier'); saved(); toast(editId?'Supplier updated':'Supplier added')
  ;['su-name','su-email','su-phone','su-addr','su-bal'].forEach(id=>el(id).value='')
  el('mo-supplier').querySelector('.mf button:last-child').textContent='Save supplier'
}

// ── PRODUCTS ──────────────────────────────────────────────
window.editStock = function(id) {
  const p=products.find(x=>x.id===id); if(!p)return
  el('sk-code').value=p.code; el('sk-name').value=p.name; el('sk-cat').value=p.category
  el('sk-uom').value=p.uom; el('sk-qty').value=p.qty; el('sk-reorder').value=p.reorder_level
  el('sk-cost').value=p.cost_price; el('sk-price').value=p.sell_price
  el('mo-stock').classList.add('open')
  el('mo-stock').dataset.editId=id
  el('mo-stock').querySelector('.mf button:last-child').textContent='Update product'
}
window.saveStock = async function() {
  const name=el('sk-name').value.trim(); if(!name)return alert('Name required')
  const editId=el('mo-stock').dataset.editId
  const row={code:el('sk-code').value||'PRD-'+(products.length+1).toString().padStart(3,'0'),name,category:el('sk-cat').value||'General',uom:el('sk-uom').value,qty:parseFloat(el('sk-qty').value)||0,reorder_level:parseFloat(el('sk-reorder').value)||10,cost_price:parseFloat(el('sk-cost').value)||0,sell_price:parseFloat(el('sk-price').value)||0}
  if(editId){
    const {error}=await sb.from('products').update(row).eq('id',editId)
    if(error)return toast('Error: '+error.message,false)
    const p=products.find(x=>x.id===editId); if(p)Object.assign(p,row)
    delete el('mo-stock').dataset.editId
  } else {
    const {data,error}=await sb.from('products').insert(row).select().single()
    if(error)return toast('Error: '+error.message,false)
    products.push(data)
  }
  renderStock(); renderStockStats(); renderDash()
  closeModal('mo-stock'); saved(); toast(editId?'Product updated':'Product added')
  ;['sk-code','sk-name','sk-cat','sk-qty','sk-reorder','sk-cost','sk-price'].forEach(id=>el(id).value='')
  el('mo-stock').querySelector('.mf button:last-child').textContent='Add product'
}

// ── STOCK ADJUSTMENT ──────────────────────────────────────
window.loadAdjCurrentQty = function() {
  const pid = el('adj-prod').value
  const p = products.find(x=>x.id===pid)
  el('adj-current').value = p ? p.qty : ''
  el('adj-new').value = ''
  el('adj-diff').textContent = '—'
  el('adj-diff').style.color = 'var(--txt)'
}

window.calcAdjDiff = function() {
  const current = parseFloat(el('adj-current').value) || 0
  const newQty = parseFloat(el('adj-new').value)
  const diffEl = el('adj-diff')
  if(isNaN(newQty)) { diffEl.textContent = '—'; diffEl.style.color='var(--txt)'; return }
  const diff = newQty - current
  if(diff > 0) {
    diffEl.textContent = '+' + diff + ' units (stock increased)'
    diffEl.style.color = 'var(--grn)'
  } else if(diff < 0) {
    diffEl.textContent = diff + ' units (stock decreased)'
    diffEl.style.color = 'var(--red)'
  } else {
    diffEl.textContent = '0 (no change)'
    diffEl.style.color = 'var(--tx2)'
  }
}

window.saveStockAdjustment = async function() {
  const pid = el('adj-prod').value
  if(!pid) return alert('Select a product')
  const p = products.find(x=>x.id===pid)
  if(!p) return alert('Product not found')
  const newQty = parseFloat(el('adj-new').value)
  if(isNaN(newQty) || newQty < 0) return alert('Enter a valid new quantity')
  const oldQty = parseFloat(p.qty) || 0
  const diff = newQty - oldQty
  const reason = el('adj-reason').value
  const notes = el('adj-notes').value

  if(diff === 0) return toast('No change to apply', false)

  if(!confirm(`Confirm stock adjustment for ${p.name}:\nOld qty: ${oldQty}\nNew qty: ${newQty}\nDifference: ${diff > 0 ? '+' : ''}${diff}\nReason: ${reason}\n\nThis will be logged permanently.`)) return

  // Update product qty
  const {error: pe} = await sb.from('products').update({qty: newQty}).eq('id', pid)
  if(pe) return toast('Error updating product: '+pe.message, false)

  // Log the adjustment
  const {data: adjData, error: ae} = await sb.from('stock_adjustments').insert({
    product_id: pid,
    product_name: p.name,
    product_code: p.code,
    old_qty: oldQty,
    new_qty: newQty,
    difference: diff,
    reason: reason,
    notes: notes
  }).select().single()
  if(ae) console.warn('Could not log adjustment:', ae.message)
  else stockAdjustments.unshift(adjData)

  // Update in memory
  p.qty = newQty

  renderStock(); renderStockStats(); renderDash()
  closeModal('mo-stockadj'); saved()
  toast(`✓ Stock adjusted: ${p.name} ${diff > 0 ? '+' : ''}${diff} units`, true)
}

function renderAdjHistory() {
  const tb = el('adj-history-tb')
  if(!stockAdjustments.length) { tb.innerHTML = erow(6, 'No adjustments recorded yet'); return }
  tb.innerHTML = stockAdjustments.map(a => `<tr>
    <td style="font-size:11px;color:var(--tx2)">${new Date(a.created_at).toLocaleString()}</td>
    <td><strong>${a.product_name}</strong><br><code style="font-size:10px">${a.product_code||''}</code></td>
    <td>${a.old_qty}</td>
    <td>${a.new_qty}</td>
    <td style="font-weight:700;color:${a.difference>0?'var(--grn)':'var(--red)'}">${a.difference>0?'+':''}${a.difference}</td>
    <td style="font-size:11px">${a.reason}${a.notes?'<br><span style="color:var(--tx2)">'+a.notes+'</span>':''}</td>
  </tr>`).join('')
}

window.delStock = async function(id) {
  if(!confirm('Delete product?'))return
  await sb.from('products').delete().eq('id',id)
  products=products.filter(p=>p.id!==id); renderStock(); renderStockStats(); renderDash(); toast('Deleted')
}
// ── INVOICES ──────────────────────────────────────────────
window.saveInvoice = async function() {
  const cid=el('inv-cust').value; if(!cid)return alert('Select a customer')
  const valid=invLines.filter(l=>l.prod); if(!valid.length)return alert('Add at least one product')
  const cur=el('inv-cur').value||baseCur
  const sub=invLines.reduce((a,l)=>{
    const qty=parseFloat(l.qty)||0
    const price=parseFloat(l.price)||0
    const disc=parseFloat(l.disc)||0
    return a + qty*price*(1-disc/100)
  },0)
  const discPct=parseFloat(el('inv-disc').value)||0
  const total=sub*(1-discPct/100)
  const taxa = parseFloat(el('inv-taxa')?.value) || 5.50
  // If currency is BRL, convert to USD using taxa (1 USD = taxa BRL)
  const baseAmt = cur === 'BRL' ? (taxa > 0 ? total / taxa : total) : toBase(total, cur)
  const cogs=valid.reduce((a,l)=>a+((parseFloat(l.qty)||0)*(l.prod.cost_price||0)),0)
  const status=el('inv-status').value
  const paid=status==='paid'?baseAmt:status==='partial'?baseAmt*0.5:0
  const cust=customers.find(c=>c.id===cid)
  const btn=el('inv-save-btn'); btn.disabled=true; btn.textContent='Saving...'
  const editId=el('mo-invoice').dataset.editId

  if(editId) {
    // ── UPDATE EXISTING INVOICE ──
    const oldInv=invoices.find(i=>i.id===editId)
    const oldStatus=el('mo-invoice').dataset.editOldStatus
    const oldBaseAmt=parseFloat(el('mo-invoice').dataset.editBaseAmt)||0
    const taxaVal = parseFloat(el('inv-taxa')?.value) || 5.50
    // Remember this rate for next time
    try { localStorage.setItem('djoko_last_taxa', taxaVal) } catch(e){}
    const invData={number:el('inv-num').value,customer_id:cid,customer_name:cust?.name,date:el('inv-date').value,due_date:el('inv-due').value,currency:cur,subtotal:sub,discount_pct:discPct,total,base_amount:baseAmt,cogs,paid_amount:paid,balance:baseAmt-paid,status,notes:el('inv-notes').value,taxa:taxaVal}
    const {error}=await sb.from('invoices').update(invData).eq('id',editId)
    if(error){btn.disabled=false;btn.textContent='Update invoice';return toast('Error: '+error.message,false)}
    // Capture OLD line quantities BEFORE deleting (needed to correctly restore/adjust stock)
    const {data:oldInvLinesBeforeDelete} = await sb.from('invoice_lines').select('product_id,qty').eq('invoice_id',editId)
    const oldInvQtyMap = {}
    ;(oldInvLinesBeforeDelete||[]).forEach(ol=>{ oldInvQtyMap[ol.product_id] = (oldInvQtyMap[ol.product_id]||0) + (parseFloat(ol.qty)||0) })
    // Replace lines
    await sb.from('invoice_lines').delete().eq('invoice_id',editId)
    await sb.from('invoice_lines').insert(invLines.map(l=>({invoice_id:editId,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:l.qty,unit_price:l.price,discount_pct:l.disc||0,commission_pct:0,commission_amt:parseFloat(l.com)||0,line_total:l.qty*l.price*(1-(l.disc||0)/100),cogs:l.qty*(l.prod?.cost_price||0)})))
    // Adjust stock: restore old sold qty, then deduct new sold qty
    for(const l of valid){
      if(!l.prod?.id) continue
      const newSoldQty = parseFloat(l.qty)||0
      const oldSoldQty = oldInvQtyMap[l.prod.id] || 0
      const {data:freshProd} = await sb.from('products').select('qty').eq('id',l.prod.id).single()
      const currentQty = freshProd ? (parseFloat(freshProd.qty)||0) : 0
      // Add back what was previously sold, then subtract the new sold amount
      const newQty = Math.max(0, currentQty + oldSoldQty - newSoldQty)
      const {error:se} = await sb.from('products').update({qty:newQty}).eq('id',l.prod.id)
      if(se) { console.error('Stock update FAILED:', se.message); toast('⚠️ Stock update failed: '+se.message, false) }
      const p=products.find(x=>x.id===l.prod.id)
      if(p) p.qty=newQty
    }
    // Update invoice in memory
    Object.assign(oldInv,invData)
    // Fix customer balance: reverse old, apply new
    if(cust){
      cust.totalInvoiced=(cust.totalInvoiced||0)-oldBaseAmt+baseAmt
      if(oldStatus==='paid') cust.totalPaid=(cust.totalPaid||0)-oldBaseAmt
      else cust.balance=Math.max(0,(cust.balance||0)-oldBaseAmt)
      if(status==='paid') cust.totalPaid=(cust.totalPaid||0)+baseAmt
      else cust.balance=(cust.balance||0)+baseAmt
    }
    // Cleanup edit mode
    delete el('mo-invoice').dataset.editId
    delete el('mo-invoice').dataset.editOldStatus
    delete el('mo-invoice').dataset.editBaseAmt
    btn.disabled=false; btn.textContent='Save invoice'
    el('mo-invoice').querySelector('.mh h3').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--acc)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> New Sales Invoice'
    renderInvoices(); renderCustomers(); renderStock(); renderDash()
    closeModal('mo-invoice'); saved(); toast('✓ Invoice '+invData.number+' updated — confirmed', true); updateBadges()
  } else {
    // ── CREATE NEW INVOICE ──
    // Make sure number is unique (skip check if editing same invoice)
    let invNumber = el('inv-num').value
    const existing = invoices.find(i => i.number === invNumber && i.id !== editId)
    if(existing) {
      invNumber = (settings.invoice_prefix||'INV-') + Date.now().toString().slice(-6)
      el('inv-num').value = invNumber
    }
    const taxaVal = parseFloat(el('inv-taxa')?.value) || 5.50
    // Remember this rate for next time
    try { localStorage.setItem('djoko_last_taxa', taxaVal) } catch(e){}
    const {data:inv,error}=await sb.from('invoices').insert({number:invNumber,customer_id:cid,customer_name:cust?.name,date:el('inv-date').value,due_date:el('inv-due').value,currency:cur,subtotal:sub,discount_pct:discPct,total,base_amount:baseAmt,cogs,paid_amount:paid,balance:baseAmt-paid,status,notes:el('inv-notes').value,taxa:taxaVal}).select().single()
    if(error){btn.disabled=false;btn.textContent='Save invoice';return toast('Error: '+error.message,false)}
    await sb.from('invoice_lines').insert(invLines.map(l=>({invoice_id:inv.id,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:l.qty,unit_price:l.price,discount_pct:l.disc||0,commission_pct:0,commission_amt:parseFloat(l.com)||0,line_total:l.qty*l.price*(1-(l.disc||0)/100),cogs:l.qty*(l.prod?.cost_price||0)})))
    for(const l of valid){
    const subQty = parseFloat(l.qty)||0
    const {data:freshProd} = await sb.from('products').select('qty').eq('id',l.prod.id).single()
    const currentQty = freshProd ? (parseFloat(freshProd.qty)||0) : (parseFloat(l.prod.qty)||0)
    const newQty = Math.max(0, currentQty - subQty)
    const {error:se} = await sb.from('products').update({qty:newQty}).eq('id',l.prod.id)
    if(se) toast('Stock update warning: '+se.message, false)
    const p=products.find(x=>x.id===l.prod.id)
    if(p) p.qty=newQty
  }
    invoices.unshift(inv)
    if(cust){cust.totalInvoiced=(cust.totalInvoiced||0)+baseAmt;if(status==='paid')cust.totalPaid=(cust.totalPaid||0)+baseAmt;else cust.balance=(cust.balance||0)+baseAmt}
    btn.disabled=false; btn.textContent='Save invoice'
    renderInvoices(); renderCustomers(); renderStock(); renderDash()
    closeModal('mo-invoice'); saved(); toast('✓ Invoice '+inv.number+' saved — confirmed in database', true); updateBadges()
  }
}
window.delInvoice = async function(id) {
  if(!confirm('Delete this invoice? This cannot be undone.'))return
  const inv=invoices.find(i=>i.id===id); if(!inv)return
  // Delete lines first then invoice
  const {error:le}=await sb.from('invoice_lines').delete().eq('invoice_id',id)
  if(le) console.warn('Lines delete error:',le.message)
  const {error}=await sb.from('invoices').delete().eq('id',id)
  if(error) return toast('Delete failed: '+error.message,false)
  invoices=invoices.filter(i=>i.id!==id)
  const c=customers.find(x=>x.id===inv.customer_id)
  if(c){c.totalInvoiced-=inv.base_amount;if(inv.status==='paid')c.totalPaid-=inv.paid_amount;else c.balance-=inv.balance}
  renderInvoices(); renderCustomers(); renderDash(); toast('Invoice deleted ✓'); updateBadges()
}
window.editInvoice = async function(id) {
  const inv = invoices.find(i=>i.id===id)
  if(!inv) return toast('Invoice not found', false)

  // Load line items from DB
  const {data:lines, error} = await sb.from('invoice_lines').select('*').eq('invoice_id', id)
  if(error) return toast('Error loading invoice: '+error.message, false)

  // Fill in header fields
  bcs('inv-cur', inv.currency||'BRL')
  // Set default taxa
  // Load the SAVED taxa rate from the invoice record
  const savedTaxa = (inv.taxa && parseFloat(inv.taxa) > 0) ? parseFloat(inv.taxa) : null
  const fallbackTaxa = (() => { try { return parseFloat(localStorage.getItem('djoko_last_taxa')) || 5.50 } catch(e){ return 5.50 } })()
  if(el('inv-taxa')) el('inv-taxa').value = savedTaxa || fallbackTaxa
  // Small delay to ensure DOM is ready before calculating
  setTimeout(() => calcInv(), 50)
  el('inv-date').value = inv.date || ''
  el('inv-due').value = inv.due_date || ''
  el('inv-num').value = inv.number || ''
  el('inv-disc').value = parseFloat(inv.discount_pct) || 0
  el('inv-status').value = inv.status || 'pending'
  el('inv-notes').value = inv.notes || ''

  // Set customer
  pSel('inv-cust', customers, 'name', '<option value="">Select customer...</option>')
  el('inv-cust').value = inv.customer_id || ''

  // Rebuild line items — match product from products array
  invLines = (lines||[]).map(l => {
    const prod = products.find(p => p.id === l.product_id) || {
      id: l.product_id,
      name: l.product_name || 'Unknown',
      code: l.product_code || '',
      cost_price: 0,
      sell_price: parseFloat(l.unit_price) || 0,
      qty: 0
    }
    return {
      prod,
      qty: parseFloat(l.qty) || 1,
      price: parseFloat(l.unit_price) || 0,
      disc: parseFloat(l.discount_pct) || 0,
      com: parseFloat(l.commission_amt) || 0
    }
  })

  // Ensure at least one line
  if(!invLines.length) invLines = [{prod:null, qty:1, price:0, disc:0}]

  // Render lines and recalculate total
  renderInvLines()
  calcInv()

  // Set edit mode flags
  el('mo-invoice').dataset.editId = id
  el('mo-invoice').dataset.editOldStatus = inv.status
  el('mo-invoice').dataset.editBaseAmt = inv.base_amount

  // Update modal title and button
  el('inv-save-btn').textContent = 'Update invoice'
  const h3 = el('mo-invoice').querySelector('.mh h3')
  if(h3) h3.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--org)"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Invoice — '+inv.number

  el('mo-invoice').classList.add('open')
}
window.fInv = function(s) { el('inv-tb').querySelectorAll('tr:not(.erow)').forEach(r=>r.style.display=(s==='all'||r.textContent.includes(s))?'':'none') }

// ── PURCHASES ─────────────────────────────────────────────
window.savePurchase = async function() {
  const sid=el('po-sup').value; if(!sid)return alert('Select a supplier')
  const valid=poLines.filter(l=>l.prod); if(!valid.length)return alert('Add at least one product')
  const cur=el('po-cur').value||baseCur
  const total=poLines.reduce((a,l)=>(parseFloat(a)||0)+(parseFloat(l.qty)||0)*(parseFloat(l.cost)||0),0)
  const baseAmt=toBase(total,cur)
  const status=el('po-status').value
  const paid=status==='paid'?baseAmt:status==='partial'?baseAmt*0.5:0
  const supp=suppliers.find(s=>s.id===sid)
  const btn=el('po-save-btn'); btn.disabled=true; btn.textContent='Saving...'
  const editId=el('mo-purchase').dataset.editId

  if(editId) {
    // ── UPDATE EXISTING PO ──
    const oldPo=purchases.find(p=>p.id===editId)
    const oldStatus=el('mo-purchase').dataset.editOldStatus
    const oldBaseAmt=parseFloat(el('mo-purchase').dataset.editBaseAmt)||0
    const poData={number:el('po-num').value,supplier_id:sid,supplier_name:supp?.name,date:el('po-date').value,delivery_date:el('po-del').value,currency:cur,total,base_amount:baseAmt,paid_amount:paid,balance:baseAmt-paid,status}
    const {error}=await sb.from('purchases').update(poData).eq('id',editId)
    if(error){btn.disabled=false;btn.textContent='Update PO';return toast('Error: '+error.message,false)}
    // Capture OLD line quantities BEFORE deleting (needed to correctly adjust stock)
    const {data:oldLinesBeforeDelete} = await sb.from('purchase_lines').select('product_id,qty').eq('purchase_id',editId)
    const oldQtyMap = {}
    ;(oldLinesBeforeDelete||[]).forEach(ol=>{ oldQtyMap[ol.product_id] = (oldQtyMap[ol.product_id]||0) + (parseFloat(ol.qty)||0) })
    if(oldPo) oldPo._lineQtyMap = oldQtyMap
    // Replace lines
    await sb.from('purchase_lines').delete().eq('purchase_id',editId)
    await sb.from('purchase_lines').insert(poLines.map(l=>({purchase_id:editId,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:parseFloat(l.qty)||0,unit_cost:parseFloat(l.cost)||0,line_total:(parseFloat(l.qty)||0)*(parseFloat(l.cost)||0)})))
    // Update stock: when EDITING a PO, we must reverse the OLD quantities first,
    // then apply the NEW quantities — otherwise qty is never actually added!
    // Step A: reverse old quantities (subtract what this PO originally added)
    const {data:oldLines} = await sb.from('purchase_lines').select('product_id,qty').eq('purchase_id', editId)
    // Note: oldLines was already deleted above, so fetch from poLines snapshot instead if needed.
    // Step B: apply new quantities by computing the DELTA between old and new line qty per product
    // Simplify: fetch fresh qty, then add the FULL new qty and subtract the FULL old qty that we captured before delete.
    for(const l of valid){
      const addQty = parseFloat(l.qty)||0
      const newCost = parseFloat(l.cost)||0
      // Get current qty fresh from DB
      const {data:freshProd} = await sb.from('products').select('qty').eq('id',l.prod.id).single()
      const currentQty = freshProd ? (parseFloat(freshProd.qty)||0) : 0
      // Find this product's OLD qty in this same PO (before edit) to avoid double counting
      const oldLineQty = (oldPo && oldPo._lineQtyMap && oldPo._lineQtyMap[l.prod.id]) || 0
      const newQty = currentQty - oldLineQty + addQty
      const {error:se} = await sb.from('products').update({qty:newQty, cost_price:newCost}).eq('id',l.prod.id)
      if(se) { console.error('Stock update FAILED:', se.message); toast('⚠️ Stock update failed: '+se.message, false) }
      const p=products.find(x=>x.id===l.prod.id)
      if(p){p.qty=newQty; p.cost_price=newCost}
    }
    // Update PO in memory
    if(oldPo) Object.assign(oldPo, poData)
    // Fix supplier balance: reverse old, apply new
    if(supp){
      supp.totalPurchased=(supp.totalPurchased||0)-oldBaseAmt+baseAmt
      if(oldStatus==='paid') supp.totalPaid=(supp.totalPaid||0)-oldBaseAmt
      else supp.owed=Math.max(0,(supp.owed||0)-oldBaseAmt)
      if(status==='paid') supp.totalPaid=(supp.totalPaid||0)+baseAmt
      else supp.owed=(supp.owed||0)+baseAmt
    }
    // Cleanup edit mode
    delete el('mo-purchase').dataset.editId
    delete el('mo-purchase').dataset.editOldStatus
    delete el('mo-purchase').dataset.editBaseAmt
    btn.disabled=false; btn.textContent='Save PO'
    // Reset modal title
    const h3=el('mo-purchase').querySelector('.mh h3')
    if(h3) h3.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--acc)"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> New Purchase Order'
    renderPurchases(); renderSuppliers(); renderStock(); renderDash()
    closeModal('mo-purchase'); saved(); toast('✓ Purchase '+poData.number+' updated — confirmed', true); updateBadges()

  } else {
    // ── CREATE NEW PO ──
    let poNumber = el('po-num').value
    const existingPo = purchases.find(p => p.number === poNumber)
    if(existingPo) {
      poNumber = (settings.po_prefix||'PO-') + Date.now().toString().slice(-6)
      el('po-num').value = poNumber
    }
    const {data:po,error}=await sb.from('purchases').insert({number:poNumber,supplier_id:sid,supplier_name:supp?.name,date:el('po-date').value,delivery_date:el('po-del').value,currency:cur,total,base_amount:baseAmt,paid_amount:paid,balance:baseAmt-paid,status}).select().single()
    if(error){btn.disabled=false;btn.textContent='Save PO';return toast('Error: '+error.message,false)}
    await sb.from('purchase_lines').insert(poLines.map(l=>({purchase_id:po.id,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:parseFloat(l.qty)||0,unit_cost:parseFloat(l.cost)||0,line_total:(parseFloat(l.qty)||0)*(parseFloat(l.cost)||0)})))
    // Update stock using the saved purchase_lines from DB (most reliable)
    const {data:savedLines} = await sb.from('purchase_lines').select('*').eq('purchase_id', po.id)
    if(savedLines && savedLines.length > 0) {
      for(const sl of savedLines) {
        if(!sl.product_id) continue
        const addQty = parseFloat(sl.qty)||0
        const newCost = parseFloat(sl.unit_cost)||0
        // Get fresh qty from DB
        const {data:freshProd} = await sb.from('products').select('qty,name').eq('id',sl.product_id).single()
        const currentQty = freshProd ? (parseFloat(freshProd.qty)||0) : 0
        const newQty = currentQty + addQty
        console.log('Stock:', freshProd?.name, currentQty, '+', addQty, '=', newQty)
        const {error:se} = await sb.from('products').update({qty:newQty, cost_price:newCost}).eq('id',sl.product_id)
        if(se) { console.error('Stock FAILED:', se.message); toast('Stock update failed: '+se.message, false) }
        // Update in memory
        const p = products.find(x=>x.id===sl.product_id)
        if(p){p.qty=newQty; p.cost_price=newCost}
      }
    } else {
      // Fallback: use poLines
      for(const l of valid){
        if(!l.prod?.id) continue
        const addQty = parseFloat(l.qty)||0
        const newCost = parseFloat(l.cost)||0
        const {data:freshProd} = await sb.from('products').select('qty').eq('id',l.prod.id).single()
        const currentQty = freshProd ? (parseFloat(freshProd.qty)||0) : 0
        const newQty = currentQty + addQty
        const {error:se} = await sb.from('products').update({qty:newQty, cost_price:newCost}).eq('id',l.prod.id)
        if(se) toast('Stock update failed: '+se.message, false)
        const p=products.find(x=>x.id===l.prod.id)
        if(p){p.qty=newQty; p.cost_price=newCost}
      }
    }
    if(!po || !po.id) {
      btn.disabled=false; btn.textContent='Save PO'
      return toast('⚠️ Save may have failed - no confirmation from server. Please check Purchases list!', false)
    }
    purchases.unshift(po)
    if(supp){supp.totalPurchased=(supp.totalPurchased||0)+baseAmt;if(status==='paid')supp.totalPaid=(supp.totalPaid||0)+baseAmt;else supp.owed=(supp.owed||0)+baseAmt}
    btn.disabled=false; btn.textContent='Save PO'
    renderPurchases(); renderSuppliers(); renderStock(); renderDash()
    closeModal('mo-purchase'); saved()
    toast('✓ Purchase '+po.number+' saved successfully — confirmed in database', true)
    updateBadges()
  }
}
window.delPurchase = async function(id) {
  if(!confirm('Delete this purchase order? This cannot be undone.'))return
  const po=purchases.find(p=>p.id===id); if(!po)return
  // Delete lines first then PO
  const {error:le}=await sb.from('purchase_lines').delete().eq('purchase_id',id)
  if(le) console.warn('Lines delete error:',le.message)
  const {error}=await sb.from('purchases').delete().eq('id',id)
  if(error) return toast('Delete failed: '+error.message,false)
  purchases=purchases.filter(p=>p.id!==id)
  const s=suppliers.find(x=>x.id===po.supplier_id)
  if(s){s.totalPurchased-=po.base_amount;if(po.status==='paid')s.totalPaid-=po.paid_amount;else s.owed-=po.balance}
  renderPurchases(); renderSuppliers(); renderDash(); toast('Purchase deleted ✓'); updateBadges()
}
window.loadCustInv = function() {
  const cid=el('rc-cust').value; const s=el('rc-inv')
  s.innerHTML='<option value="">General</option>'
  invoices.filter(i=>i.customer_id===cid&&i.status!=='paid').forEach(i=>{const o=document.createElement('option');o.value=i.id;o.textContent=i.number+' — '+fmt(i.balance);s.appendChild(o)})
}
window.saveReceipt = async function() {
  const cid=el('rc-cust').value; if(!cid)return alert('Select customer')
  const amt=parseFloat(el('rc-amt').value)||0; if(!amt)return alert('Enter amount')
  const cur=el('rc-cur').value||baseCur; const baseAmt=toBase(amt,cur)
  const cust=customers.find(c=>c.id===cid)
  const invId=el('rc-inv').value||null
  const {data,error}=await sb.from('receipts').insert({date:el('rc-date').value,customer_id:cid,customer_name:cust?.name,invoice_id:invId||undefined,invoice_number:invId?invoices.find(i=>i.id===invId)?.number:null,currency:cur,amount:amt,base_amount:baseAmt,method:el('rc-mth').value,note:el('rc-note').value}).select().single()
  if(error)return toast('Error: '+error.message,false)
  receipts.unshift(data)
  if(cust){cust.totalPaid=(cust.totalPaid||0)+baseAmt;cust.balance=Math.max(0,(cust.balance||0)-baseAmt)}
  renderReceipts(); renderCustomers(); renderDash(); closeModal('mo-receipt'); saved(); toast('Receipt recorded!')
  ;['rc-amt','rc-note'].forEach(id=>el(id).value='')
}
window.delReceipt = async function(id) {
  if(!confirm('Delete?'))return
  await sb.from('receipts').delete().eq('id',id)
  receipts=receipts.filter(r=>r.id!==id); renderReceipts(); toast('Deleted')
}

// ── PAYMENTS ──────────────────────────────────────────────
window.loadSuppPO = function() {
  const sid=el('py-sup').value; const s=el('py-po')
  s.innerHTML='<option value="">General</option>'
  purchases.filter(p=>p.supplier_id===sid&&p.status!=='paid').forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.number+' — '+fmt(p.balance);s.appendChild(o)})
}
window.savePayment = async function() {
  const sid=el('py-sup').value; if(!sid)return alert('Select supplier')
  const amt=parseFloat(el('py-amt').value)||0; if(!amt)return alert('Enter amount')
  const cur=el('py-cur').value||baseCur; const baseAmt=toBase(amt,cur)
  const supp=suppliers.find(s=>s.id===sid)
  const poId=el('py-po').value||null
  const {data,error}=await sb.from('payments').insert({date:el('py-date').value,supplier_id:sid,supplier_name:supp?.name,purchase_id:poId||undefined,purchase_number:poId?purchases.find(p=>p.id===poId)?.number:null,currency:cur,amount:amt,base_amount:baseAmt,method:el('py-mth').value,note:el('py-note').value}).select().single()
  if(error)return toast('Error: '+error.message,false)
  payments.unshift(data)
  if(supp){supp.totalPaid=(supp.totalPaid||0)+baseAmt;supp.owed=Math.max(0,(supp.owed||0)-baseAmt)}
  renderPayments(); renderSuppliers(); renderDash(); closeModal('mo-payment'); saved(); toast('Payment recorded!')
  ;['py-amt','py-note'].forEach(id=>el(id).value='')
}
window.delPayment = async function(id) {
  if(!confirm('Delete?'))return
  await sb.from('payments').delete().eq('id',id)
  payments=payments.filter(p=>p.id!==id); renderPayments(); toast('Deleted')
}

// ── EXPENSES ──────────────────────────────────────────────
window.saveExpense = async function() {
  const desc=el('ex-desc').value.trim(); if(!desc)return alert('Description required')
  const amt=parseFloat(el('ex-amt').value)||0
  const cur=el('ex-cur').value||baseCur
  const {data,error}=await sb.from('expenses').insert({date:el('ex-date').value,category:el('ex-cat').value,description:desc,payee:el('ex-payee').value,currency:cur,amount:amt,base_amount:toBase(amt,cur)}).select().single()
  if(error)return toast('Error: '+error.message,false)
  expenses.unshift(data); renderExpenses(); renderDash(); closeModal('mo-expense'); saved(); toast('Expense saved')
  ;['ex-desc','ex-payee','ex-amt'].forEach(id=>el(id).value='')
}
window.delExpense = async function(id) {
  if(!confirm('Delete?'))return
  await sb.from('expenses').delete().eq('id',id)
  expenses=expenses.filter(e=>e.id!==id); renderExpenses(); renderDash(); toast('Deleted')
}
window.editExpense = function(id) {
  const e=expenses.find(x=>x.id===id); if(!e)return
  bcs('ex-cur',e.currency)
  el('ex-date').value=e.date; el('ex-cat').value=e.category
  el('ex-desc').value=e.description; el('ex-payee').value=e.payee||''; el('ex-amt').value=e.amount
  el('mo-expense').classList.add('open')
  el('mo-expense').dataset.editId=id
  el('mo-expense').querySelector('.mf button:last-child').textContent='Update expense'
}
window.saveExpense = async function() {
  const desc=el('ex-desc').value.trim(); if(!desc)return alert('Description required')
  const amt=parseFloat(el('ex-amt').value)||0
  const cur=el('ex-cur').value||baseCur
  const editId=el('mo-expense').dataset.editId
  const row={date:el('ex-date').value,category:el('ex-cat').value,description:desc,payee:el('ex-payee').value,currency:cur,amount:amt,base_amount:toBase(amt,cur)}
  if(editId){
    const {error}=await sb.from('expenses').update(row).eq('id',editId)
    if(error)return toast('Error: '+error.message,false)
    const e=expenses.find(x=>x.id===editId); if(e)Object.assign(e,row)
    delete el('mo-expense').dataset.editId
  } else {
    const {data,error}=await sb.from('expenses').insert(row).select().single()
    if(error)return toast('Error: '+error.message,false)
    expenses.unshift(data)
  }
  renderExpenses(); renderDash(); closeModal('mo-expense'); saved(); toast(editId?'Expense updated':'Expense saved')
  ;['ex-desc','ex-payee','ex-amt'].forEach(id=>el(id).value='')
  el('mo-expense').querySelector('.mf button:last-child').textContent='Save expense'
}

// ── RENDER FUNCTIONS ──────────────────────────────────────
function renderCustomers() {
  const tb=el('cust-tb')
  if(!customers.length){tb.innerHTML=erow(9,'No customers yet');return}
  tb.innerHTML=customers.map((c,i)=>`<tr>
    <td style="color:var(--tx3)">${i+1}</td>
    <td><strong>${c.name}</strong><br><span style="font-size:10px;color:var(--tx3)">${c.email||''}</span></td>
    <td>${c.phone||'—'}</td><td><span class="badge bcur">${c.currency||baseCur}</span></td>
    <td>${fmt(c.totalInvoiced||0)}</td><td style="color:var(--grn)">${fmt(c.totalPaid||0)}</td>
    <td style="color:${(c.balance||0)>0?'var(--red)':'var(--grn)'};font-weight:700">${fmt(c.balance||0)}</td>
    <td>${(c.balance||0)>0?sbadge('pending'):sbadge('paid')}</td>
    <td style="white-space:nowrap">${editBtn(`editCust('${c.id}')`)} ${delBtn(`delCust('${c.id}')`)}</td></tr>`).join('')
}
function renderSuppliers() {
  const tb=el('supp-tb')
  if(!suppliers.length){tb.innerHTML=erow(9,'No suppliers yet');return}
  tb.innerHTML=suppliers.map((s,i)=>`<tr>
    <td style="color:var(--tx3)">${i+1}</td>
    <td><strong>${s.name}</strong><br><span style="font-size:10px;color:var(--tx3)">${s.email||''}</span></td>
    <td>${s.phone||'—'}</td><td><span class="badge bcur">${s.currency||baseCur}</span></td>
    <td>${fmt(s.totalPurchased||0)}</td><td style="color:var(--grn)">${fmt(s.totalPaid||0)}</td>
    <td style="color:${(s.owed||0)>0?'var(--red)':'var(--grn)'};font-weight:700">${fmt(s.owed||0)}</td>
    <td>${(s.owed||0)>0?sbadge('pending'):sbadge('paid')}</td>
    <td style="white-space:nowrap">${editBtn(`editSupp('${s.id}')`)} ${delBtn(`delSupp('${s.id}')`)}</td></tr>`).join('')
}
function renderStock() {
  const tb=el('stock-tb')
  if(!products.length){tb.innerHTML=erow(11,'No products yet');return}
  // Build product rows
  const rows = products.map(p=>{
    const m=p.sell_price>0?Math.round((p.sell_price-p.cost_price)/p.sell_price*100):0
    return `<tr>
      <td><code style="background:#F3F4F6;padding:2px 5px;border-radius:3px;font-size:10px">${p.code}</code></td>
      <td><strong>${p.name}</strong></td><td>${p.category}</td>
      <td style="font-weight:700;color:${p.qty<=p.reorder_level?'var(--red)':'var(--txt)'}">${p.qty} ${p.uom}</td>
      <td style="color:var(--tx2)">${p.reorder_level}</td>
      <td>${fmt(p.cost_price)}</td><td>${fmt(p.sell_price)}</td>
      <td style="font-weight:700">${fmt(p.qty*p.cost_price)}</td>
      <td style="color:${m>=30?'var(--grn)':m>=10?'var(--org)':'var(--red)'};font-weight:700">${m}%</td>
      <td>${skb(p.qty,p.reorder_level)}</td>
      <td style="white-space:nowrap">${editBtn(`editStock('${p.id}')`)} ${delBtn(`delStock('${p.id}')`)}</td>
    </tr>`
  }).join('')
  // Totals row
  const totalQty = products.reduce((a,p)=>a+p.qty,0)
  const totalCostVal = products.reduce((a,p)=>a+(p.qty*p.cost_price),0)
  const totalRetailVal = products.reduce((a,p)=>a+(p.qty*p.sell_price),0)
  const totalsRow = `<tr style="background:#F0FDF4;font-weight:700;border-top:2px solid var(--grn)">
    <td colspan="3" style="padding:9px 11px;color:var(--grn)">TOTAL STOCK</td>
    <td style="padding:9px 11px;color:var(--grn);font-size:13px">${totalQty} units</td>
    <td></td>
    <td></td>
    <td></td>
    <td style="padding:9px 11px;color:var(--grn);font-size:13px">${fmt(totalCostVal)}</td>
    <td style="padding:9px 11px;color:var(--grn);font-size:11px">retail: ${fmt(totalRetailVal)}</td>
    <td colspan="2"></td>
  </tr>`
  tb.innerHTML = rows + totalsRow
}
function renderStockStats() {
  el('sk-n').textContent=products.length
  el('sk-v').textContent=fmt(products.reduce((a,p)=>a+p.qty*p.cost_price,0))
  el('sk-r').textContent=fmt(products.reduce((a,p)=>a+p.qty*p.sell_price,0))
  el('sk-l').textContent=products.filter(p=>p.qty<=p.reorder_level&&p.qty>0).length
}
function renderInvoices() {
  const tb=el('inv-tb'); updateBadges()
  if(!invoices.length){tb.innerHTML=erow(10,'No invoices yet');return}
  tb.innerHTML=invoices.map(inv=>`<tr>
    <td style="font-weight:700;color:var(--acc)">${inv.number}</td>
    <td>${inv.customer_name}</td><td>${inv.date}</td>
    <td style="color:${inv.due_date<td()&&inv.status!=='paid'?'var(--red)':'var(--tx2)'}">${inv.due_date||'—'}</td>
    <td><span class="badge bcur">${inv.currency}</span></td>
    <td style="font-weight:700">${fc(inv.total,inv.currency)}</td>
    <td style="color:var(--grn)">${fmt(inv.paid_amount||0)}</td>
    <td style="color:${(inv.balance||0)>0?'var(--red)':'var(--grn)'};font-weight:700">${fmt(inv.balance||0)}</td>
    <td>${sbadge(inv.status)}</td>
    <td style="white-space:nowrap">
      <button class="btn sm" onclick="printInvoice('${inv.id}')" title="Print">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </button>
      <button class="btn icon ghost" onclick="editInvoice('${inv.id}')" title="Edit invoice" style="color:var(--acc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      ${delBtn(`delInvoice('${inv.id}')`)}
    </td></tr>`).join('')
}
function renderPurchases() {
  const tb=el('po-tb'); updateBadges()
  if(!purchases.length){tb.innerHTML=erow(9,'No purchases yet');return}
  tb.innerHTML=purchases.map(po=>`<tr>
    <td style="font-weight:700;color:var(--org)">${po.number}</td>
    <td>${po.supplier_name}</td><td>${po.date}</td>
    <td><span class="badge bcur">${po.currency}</span></td>
    <td style="font-weight:700">${fc(po.total,po.currency)}</td>
    <td style="color:var(--grn)">${fmt(po.paid_amount||0)}</td>
    <td style="color:${(po.balance||0)>0?'var(--red)':'var(--grn)'};font-weight:700">${fmt(po.balance||0)}</td>
    <td>${sbadge(po.status)}</td>
    <td style="white-space:nowrap">
      <button class="btn sm" onclick="printPurchase('${po.id}')" title="Print PO" style="padding:4px 7px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </button>
      <button class="btn icon ghost" onclick="editPurchase('${po.id}')" title="Edit" style="color:var(--acc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      ${delBtn(`delPurchase('${po.id}')`)}
    </td></tr>`).join('')
}
function renderReceipts() {
  const tb=el('rcpt-tb')
  if(!receipts.length){tb.innerHTML=erow(8,'No receipts yet');return}
  tb.innerHTML=receipts.map(r=>`<tr>
    <td>${r.date}</td><td>${r.customer_name}</td><td>${r.invoice_number||'General'}</td>
    <td><span class="badge bcur">${r.currency}</span></td>
    <td style="font-weight:700;color:var(--grn)">${fc(r.amount,r.currency)}</td>
    <td>${r.method}</td><td style="color:var(--tx2)">${r.note||'—'}</td>
    <td>${delBtn(`delReceipt('${r.id}')`)}</td></tr>`).join('')
}
function renderPayments() {
  const tb=el('pay-tb')
  if(!payments.length){tb.innerHTML=erow(8,'No payments yet');return}
  tb.innerHTML=payments.map(p=>`<tr>
    <td>${p.date}</td><td>${p.supplier_name}</td><td>${p.purchase_number||'General'}</td>
    <td><span class="badge bcur">${p.currency}</span></td>
    <td style="font-weight:700;color:var(--red)">${fc(p.amount,p.currency)}</td>
    <td>${p.method}</td><td style="color:var(--tx2)">${p.note||'—'}</td>
    <td>${delBtn(`delPayment('${p.id}')`)}</td></tr>`).join('')
}
function renderExpenses() {
  const tb=el('exp-tb')
  const tot=expenses.reduce((a,e)=>a+e.base_amount,0)
  const now=new Date().toISOString().slice(0,7)
  const mon=expenses.filter(e=>e.date.startsWith(now)).reduce((a,e)=>a+e.base_amount,0)
  el('ex-t').textContent=fmt(tot); el('ex-m').textContent=fmt(mon)
  el('ex-c').textContent=new Set(expenses.map(e=>e.category)).size
  if(!expenses.length){tb.innerHTML=erow(7,'No expenses yet');return}
  tb.innerHTML=expenses.map(e=>`<tr>
    <td>${e.date}</td><td><span class="badge bexp">${e.category}</span></td>
    <td>${e.description}</td><td>${e.payee||'—'}</td>
    <td><span class="badge bcur">${e.currency}</span></td>
    <td style="color:var(--red);font-weight:700">${fc(e.amount,e.currency)}</td>
    <td style="white-space:nowrap">${editBtn(`editExpense('${e.id}')`)} ${delBtn(`delExpense('${e.id}')`)}</td></tr>`).join('')
}
function renderDash() {
  el('dash-date').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
  const rev=invoices.reduce((a,i)=>a+i.base_amount,0)
  const cogs=invoices.reduce((a,i)=>a+(i.cogs||0),0)
  const exp=expenses.reduce((a,e)=>a+e.base_amount,0)
  const net=rev-cogs-exp
  const recv=customers.reduce((a,c)=>a+(c.balance||0),0)
  const pay=suppliers.reduce((a,s)=>a+(s.owed||0),0)
  const stk=products.reduce((a,p)=>a+p.qty*p.cost_price,0)
  const ov=invoices.filter(i=>i.due_date<td()&&i.status!=='paid').length
  el('k-rev').textContent=fmt(rev); el('k-net').textContent=fmt(net)
  el('k-net').className='kval '+(net>=0?'g':'r')
  el('k-recv').textContent=fmt(recv); el('k-pay').textContent=fmt(pay)
  el('k-stk').textContent=fmt(stk); el('k-stkn').textContent=products.length+' products'
  el('k-ov').textContent=ov
  const cols={Invoice:'#DBEAFE|#1E40AF',Purchase:'#FEF9C3|#854D0E',Receipt:'#DCFCE7|#166534',Payment:'#FEE2E2|#991B1B'}
  const rec=[
    ...invoices.slice(0,4).map(i=>({t:'Invoice',r:i.number,p:i.customer_name,d:i.date,a:i.base_amount,s:i.status})),
    ...purchases.slice(0,3).map(p=>({t:'Purchase',r:p.number,p:p.supplier_name,d:p.date,a:p.base_amount,s:p.status})),
    ...receipts.slice(0,3).map(r=>({t:'Receipt',r:r.method,p:r.customer_name,d:r.date,a:r.base_amount,s:'paid'})),
    ...payments.slice(0,3).map(p=>({t:'Payment',r:p.method,p:p.supplier_name,d:p.date,a:p.base_amount,s:'paid'}))
  ].sort((a,b)=>b.d.localeCompare(a.d)).slice(0,10)
  el('dash-tb').innerHTML=rec.length?rec.map(r=>{
    const[bg,fg]=(cols[r.t]||'#F3F4F6|#374151').split('|')
    return `<tr><td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${bg};color:${fg};font-weight:600">${r.t}</span></td><td style="font-weight:600">${r.r}</td><td>${r.p}</td><td style="color:var(--tx2)">${r.d}</td><td style="font-weight:600">${fmt(r.a)}</td><td>${sbadge(r.s)}</td></tr>`
  }).join(''):erow(6,'No transactions yet')
  const ls=products.filter(p=>p.qty<=p.reorder_level)
  el('dash-ls').innerHTML=ls.length?ls.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr)"><div><strong style="font-size:12px">${p.name}</strong><br><span style="font-size:10px;color:var(--tx3)">${p.code}</span></div><div style="text-align:right">${skb(p.qty,p.reorder_level)}<br><span style="font-size:10px;color:var(--tx3)">${p.qty} left</span></div></div>`).join(''):'<div style="color:var(--tx3);font-size:12px;text-align:center;padding:14px">All stock levels OK</div>'
}
function updateBadges() {
  el('nb-inv').textContent=invoices.filter(i=>i.status!=='paid').length||''
  el('nb-po').textContent=purchases.filter(p=>p.status!=='paid').length||''
}

// ── REPORTS ───────────────────────────────────────────────
function renderReports() {
  const rev=invoices.reduce((a,i)=>a+i.base_amount,0)
  const cogs=invoices.reduce((a,i)=>a+(i.cogs||0),0)
  const exp=expenses.reduce((a,e)=>a+e.base_amount,0)
  const gross=rev-cogs; const net=gross-exp
  const recv=customers.reduce((a,c)=>a+(c.balance||0),0)
  const pay=suppliers.reduce((a,s)=>a+(s.owed||0),0)
  const stk=products.reduce((a,p)=>a+p.qty*p.cost_price,0)
  const cash=receipts.reduce((a,r)=>a+r.base_amount,0)-payments.reduce((a,p)=>a+p.base_amount,0)
  const ta=stk+recv+Math.max(0,cash); const eq=ta-pay
  const rr=(lbl,val,lvl,cls)=>`<tr style="${lvl===0?'background:#F9FAFB;font-weight:700':''}"><td style="padding:8px 14px;padding-left:${14+lvl*18}px">${lbl}</td><td style="text-align:right;padding:8px 14px;color:${cls||'var(--txt)'}">${val===null?'':fmt(val)}</td></tr>`
  el('rpt-bs').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div class="card"><div class="ch"><div class="ct">Assets</div><div class="cs">As at ${td()}</div></div>
    <table>${rr('Current assets',null,1)}${rr('Inventory',stk,2,'var(--acc)')}${rr('Receivables',recv,2,'var(--acc)')}${rr('Cash',Math.max(0,cash),2,'var(--acc)')}${rr('TOTAL ASSETS',ta,0,'var(--acc)')}</table></div>
    <div class="card"><div class="ch"><div class="ct">Liabilities & Equity</div><div class="cs">As at ${td()}</div></div>
    <table>${rr('Liabilities',null,1)}${rr('Accounts payable',pay,2,'var(--red)')}${rr('Total liabilities',pay,1)}${rr('Equity',null,1)}${rr('Retained earnings',eq,2,eq>=0?'var(--grn)':'var(--red)')}${rr('TOTAL LIAB + EQUITY',ta,0,'var(--acc)')}</table></div></div>`
  const ec={};expenses.forEach(e=>{ec[e.category]=(ec[e.category]||0)+e.base_amount})
  const er=Object.entries(ec).map(([k,v])=>rr(k,v,2)).join('')||rr('No expenses',0,2)
  el('rpt-pl').innerHTML=`<div class="card"><div class="ch"><div class="ct">Profit & Loss</div><div class="cs">To ${td()}</div></div>
    <table>${rr('REVENUE',null,0)}${rr('Sales revenue',rev,2,'var(--acc)')}${rr('Gross revenue',rev,1)}
    ${rr('COST OF GOODS SOLD',null,0)}${rr('COGS',cogs,2,'var(--red)')}${rr('GROSS PROFIT',gross,0,gross>=0?'var(--grn)':'var(--red)')}
    ${rr('EXPENSES',null,0)}${er}${rr('Total expenses',exp,1,'var(--red)')}
    <tr style="background:${net>=0?'#F0FDF4':'#FEF2F2'}"><td style="padding:11px 14px;font-weight:700;font-size:14px">NET PROFIT / (LOSS)</td>
    <td style="text-align:right;padding:11px 14px;font-weight:700;font-size:14px;color:${net>=0?'var(--grn)':'var(--red)'}">${fmt(net)}</td></tr></table></div>`
  el('rpt-ar').innerHTML=`<div class="card"><div class="ch"><div class="ct">Accounts Receivable</div></div>
    <table><thead><tr><th>Customer</th><th>Currency</th><th>Invoiced</th><th>Paid</th><th>Outstanding</th></tr></thead>
    <tbody>${customers.length?customers.map(c=>`<tr><td><strong>${c.name}</strong></td><td><span class="badge bcur">${c.currency||baseCur}</span></td><td>${fmt(c.totalInvoiced||0)}</td><td style="color:var(--grn)">${fmt(c.totalPaid||0)}</td><td style="font-weight:700;color:${(c.balance||0)>0?'var(--red)':'var(--grn)'}">${fmt(c.balance||0)}</td></tr>`).join('')+`<tr style="background:#F9FAFB;font-weight:700"><td colspan="4">TOTAL</td><td style="color:var(--red)">${fmt(recv)}</td></tr>`:erow(5,'No customers')}</tbody></table></div>`
  el('rpt-ap').innerHTML=`<div class="card"><div class="ch"><div class="ct">Accounts Payable</div></div>
    <table><thead><tr><th>Supplier</th><th>Currency</th><th>Purchased</th><th>Paid</th><th>Outstanding</th></tr></thead>
    <tbody>${suppliers.length?suppliers.map(s=>`<tr><td><strong>${s.name}</strong></td><td><span class="badge bcur">${s.currency||baseCur}</span></td><td>${fmt(s.totalPurchased||0)}</td><td style="color:var(--grn)">${fmt(s.totalPaid||0)}</td><td style="font-weight:700;color:${(s.owed||0)>0?'var(--red)':'var(--grn)'}">${fmt(s.owed||0)}</td></tr>`).join('')+`<tr style="background:#F9FAFB;font-weight:700"><td colspan="4">TOTAL</td><td style="color:var(--red)">${fmt(pay)}</td></tr>`:erow(5,'No suppliers')}</tbody></table></div>`
  el('rpt-trial').innerHTML=`<div class="card"><div class="ch"><div class="ct">Trial Balance</div><div class="cs">As at ${td()}</div></div>
    <table><thead><tr><th>Account</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead>
    <tbody>
    <tr><td>Sales revenue</td><td></td><td style="text-align:right">${fmt(rev)}</td></tr>
    <tr><td>Cost of goods sold</td><td style="text-align:right">${fmt(cogs)}</td><td></td></tr>
    <tr><td>Operating expenses</td><td style="text-align:right">${fmt(exp)}</td><td></td></tr>
    <tr><td>Accounts receivable</td><td style="text-align:right">${fmt(recv)}</td><td></td></tr>
    <tr><td>Accounts payable</td><td></td><td style="text-align:right">${fmt(pay)}</td></tr>
    <tr><td>Inventory</td><td style="text-align:right">${fmt(stk)}</td><td></td></tr>
    <tr style="background:#F9FAFB;font-weight:700"><td>TOTALS</td><td style="text-align:right">${fmt(cogs+exp+recv+stk)}</td><td style="text-align:right">${fmt(rev+pay)}</td></tr>
    </tbody></table></div>`
}
window.rptTab = function(elem,view) {
  document.querySelectorAll('#page-reports .tab').forEach(t=>t.classList.remove('active'))
  elem.classList.add('active')
  ;['rpt-bs','rpt-pl','rpt-ar','rpt-ap','rpt-trial'].forEach(id=>el(id).style.display='none')
  el(view).style.display='block'
}

// ── PRINT INVOICE ─────────────────────────────────────────
window.printInvoice = async function(id) {
  const inv=invoices.find(i=>i.id===id); if(!inv)return
  const {data:lines}=await sb.from('invoice_lines').select('*').eq('invoice_id',id)
  toast('Generating PDF...')
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=210, mg=14
  let y=mg
  // Header bar
  doc.setFillColor(37,99,235); doc.rect(0,0,W,26,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont('helvetica','bold')
  doc.text(settings.company||'DJOKO',mg,13)
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  if(settings.address && settings.address!=='null') doc.text(settings.address,mg,18)
  const contactLine = [settings.phone,settings.email].filter(x=>x&&x!=='null').join('  ')
  if(contactLine) doc.text(contactLine,mg,22)
  doc.setFontSize(16); doc.setFont('helvetica','bold')
  doc.text('INVOICE',W-mg,12,{align:'right'})
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  doc.text(inv.number,W-mg,17,{align:'right'})
  doc.text('Date: '+inv.date,W-mg,21,{align:'right'})
  doc.text('Due: '+(inv.due_date||'—'),W-mg,25,{align:'right'})
  y=34
  // Bill To box
  doc.setTextColor(0,0,0); doc.setFillColor(249,250,251)
  doc.rect(mg,y,W-mg*2,16,'F')
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(156,163,175)
  doc.text('BILL TO',mg+3,y+6)
  doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold')
  doc.text(inv.customer_name||'',mg+3,y+13)
  const sc=inv.status==='paid'?[22,163,74]:[217,119,6]
  doc.setTextColor(...sc); doc.setFontSize(9)
  doc.text(inv.status.toUpperCase(),W-mg-3,y+10,{align:'right'})
  y+=22
  // Table header
  doc.setFillColor(30,58,95); doc.rect(mg,y,W-mg*2,7,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold')
  doc.text('PRODUCT',mg+2,y+5)
  doc.text('QTY',mg+85,y+5,{align:'center'})
  doc.text('PRICE',mg+110,y+5,{align:'right'})
  doc.text('DISC%',mg+124,y+5,{align:'center'})
  doc.text('COM R$',mg+148,y+5,{align:'right'})
  doc.text('LINE TOTAL',W-mg-2,y+5,{align:'right'})
  y+=8
  // Rows
  let totalCom=0, totalQty=0
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  ;(lines||[]).forEach((l,idx)=>{
    if(y>270){doc.addPage();y=15}
    doc.setFillColor(idx%2===0?255:248,idx%2===0?255:250,idx%2===0?255:252)
    doc.rect(mg,y-1,W-mg*2,8,'F')
    doc.setTextColor(0,0,0)
    doc.text((l.product_name||'').substring(0,40),mg+2,y+4.5)
    doc.text(String(l.qty||0),mg+85,y+4.5,{align:'center'})
    doc.text(fc(l.unit_price,inv.currency),mg+110,y+4.5,{align:'right'})
    doc.text((l.discount_pct||0)+'%',mg+124,y+4.5,{align:'center'})
    const ca=parseFloat(l.commission_amt)||0; totalCom+=ca; totalQty+=parseFloat(l.qty)||0
    doc.setTextColor(124,58,237)
    doc.text(ca>0?'R$'+ca.toFixed(2):'—',mg+148,y+4.5,{align:'right'})
    doc.setTextColor(0,0,0)
    doc.text(fc(l.line_total||0,inv.currency),W-mg-2,y+4.5,{align:'right'})
    doc.setDrawColor(229,231,235); doc.line(mg,y+7,W-mg,y+7)
    y+=8
  })
  // Totals row
  doc.setFillColor(243,244,246); doc.rect(mg,y,W-mg*2,8,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(0,0,0)
  doc.text('TOTAL: '+totalQty+' units',mg+2,y+5.5)
  if(totalCom>0){doc.setTextColor(124,58,237);doc.text('Com: R$'+totalCom.toFixed(2),mg+148,y+5.5,{align:'right'})}
  doc.setTextColor(37,99,235)
  doc.text(fc(inv.total,inv.currency),W-mg-2,y+5.5,{align:'right'})
  y+=14
  // Summary
  const bx=W-mg-60, bw=58
  let bh=18+(inv.discount_pct>0?7:0)+(totalCom>0?6:0)
  doc.setFillColor(249,250,251); doc.rect(bx,y,bw,bh,'F')
  doc.setDrawColor(229,231,235); doc.rect(bx,y,bw,bh)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(107,114,128)
  doc.text('Subtotal:',bx+3,y+7); doc.setTextColor(0,0,0)
  doc.text(fc(inv.subtotal||inv.total,inv.currency),bx+bw-3,y+7,{align:'right'})
  let sy=y+12
  if(inv.discount_pct>0){
    doc.setTextColor(107,114,128); doc.text('Discount ('+inv.discount_pct+'%):',bx+3,sy)
    doc.setTextColor(220,38,38); doc.text('-'+fc((inv.subtotal||inv.total)*inv.discount_pct/100,inv.currency),bx+bw-3,sy,{align:'right'})
    sy+=7
  }
  if(totalCom>0){
    doc.setTextColor(124,58,237); doc.setFont('helvetica','normal')
    doc.text('Commission:',bx+3,sy)
    doc.text('R$'+totalCom.toFixed(2),bx+bw-3,sy,{align:'right'})
    sy+=6
  }
  doc.setFillColor(37,99,235); doc.rect(bx,sy,bw,11,'F')
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10)
  doc.text('TOTAL '+inv.currency,bx+3,sy+7.5)
  doc.setFontSize(11)
  doc.text(fc(inv.total,inv.currency),bx+bw-3,sy+7.5,{align:'right'})
  sy+=13
  // USD equivalent box - prominent display
  if(inv.taxa && inv.currency==='BRL'){
    const usd = inv.total / inv.taxa
    const ux = bx, uw = bw
    doc.setFillColor(239,246,255); doc.rect(ux,sy+2,uw,12,'F')
    doc.setDrawColor(147,197,253); doc.rect(ux,sy+2,uw,12)
    doc.setTextColor(37,99,235); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text('TOTAL USD',ux+3,sy+9)
    doc.setFontSize(11)
    doc.text('$'+usd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),ux+uw-3,sy+9,{align:'right'})
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,116,139)
    doc.text('Rate: $1 = R$'+inv.taxa,ux+3,sy+13)
    sy+=14
  }
  // Notes
  if(inv.notes){
    y=Math.max(y+bh+14,sy+10)
    doc.setFillColor(249,250,251); doc.rect(mg,y,W-mg*2,10,'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
    doc.text('Notes: ',mg+2,y+6)
    doc.setFont('helvetica','normal'); doc.text(inv.notes,mg+18,y+6)
  }
  // Footer
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(156,163,175)
  doc.text('Generated by DJOKO Pro Accounting | '+new Date().toLocaleDateString(),W/2,287,{align:'center'})
  doc.save('Invoice-'+inv.number+'.pdf')
  toast('Invoice PDF saved! ✓')
}

window.printReport = function() {
  renderReports()
  toast('Generating report PDF...')
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=210, mg=14
  let y=mg
  // Header
  doc.setFillColor(37,99,235); doc.rect(0,0,W,22,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
  doc.text((settings.company||'DJOKO')+' — Financial Reports',mg,14)
  doc.setFontSize(7); doc.setFont('helvetica','normal')
  doc.text('Generated: '+new Date().toLocaleString()+' | Currency: '+baseCur,W-mg,14,{align:'right'})
  y=30
  const addRow=(label,val,indent,bold,bg)=>{
    if(y>275){doc.addPage();y=15}
    if(bg){doc.setFillColor(...bg);doc.rect(mg,y-1,W-mg*2,7,'F')}
    doc.setFont('helvetica',bold?'bold':'normal'); doc.setFontSize(8); doc.setTextColor(0,0,0)
    doc.text(label,mg+(indent||0)*5+2,y+4)
    if(val!==null&&val!==undefined) doc.text(String(val),W-mg-2,y+4,{align:'right'})
    y+=7
  }
  const rev=invoices.reduce((a,i)=>a+i.base_amount,0)
  const cogs=invoices.reduce((a,i)=>a+(i.cogs||0),0)
  const exp=expenses.reduce((a,e)=>a+e.base_amount,0)
  const gross=rev-cogs; const net=gross-exp
  const recv=customers.reduce((a,c)=>a+(c.balance||0),0)
  const pay=suppliers.reduce((a,s)=>a+(s.owed||0),0)
  const stk=products.reduce((a,p)=>a+p.qty*p.cost_price,0)
  const cash=receipts.reduce((a,r)=>a+r.base_amount,0)-payments.reduce((a,p)=>a+p.base_amount,0)
  const ta=stk+recv+Math.max(0,cash); const eq=ta-pay
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(37,99,235)
  doc.text('BALANCE SHEET',mg,y); y+=8
  addRow('Current assets',null,0,true,[249,250,251])
  addRow('Inventory / Stock',fmt(stk),1)
  addRow('Accounts receivable',fmt(recv),1)
  addRow('Cash & bank',fmt(Math.max(0,cash)),1)
  addRow('TOTAL ASSETS',fmt(ta),0,true,[219,234,254])
  y+=3
  addRow('Liabilities',null,0,true,[249,250,251])
  addRow('Accounts payable',fmt(pay),1)
  addRow('Equity / Retained earnings',fmt(eq),1)
  addRow('TOTAL LIABILITIES + EQUITY',fmt(ta),0,true,[219,234,254])
  y+=8
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(37,99,235)
  doc.text('PROFIT & LOSS',mg,y); y+=8
  addRow('Sales revenue',fmt(rev),0,true,[249,250,251])
  addRow('Cost of goods sold (COGS)',fmt(cogs),1)
  addRow('GROSS PROFIT',fmt(gross),0,true,gross>=0?[220,252,231]:[254,226,226])
  y+=3
  addRow('OPERATING EXPENSES',null,0,true,[249,250,251])
  const ec={};expenses.forEach(e=>{ec[e.category]=(ec[e.category]||0)+e.base_amount})
  Object.entries(ec).forEach(([k,v])=>addRow(k,fmt(v),1))
  addRow('Total expenses',fmt(exp),0,true)
  y+=3
  const nb=net>=0?[220,252,231]:[254,226,226]
  addRow('NET PROFIT / (LOSS)',fmt(net),0,true,nb)
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(156,163,175)
  doc.text('DJOKO Pro Accounting | '+new Date().toLocaleDateString(),W/2,287,{align:'center'})
  doc.save('DJOKO-Report-'+new Date().toISOString().slice(0,10)+'.pdf')
  toast('Report PDF saved! ✓')
}

window.printPurchase = async function(id) {
  const po = purchases.find(p=>p.id===id); if(!po)return
  const {data:lines} = await sb.from('purchase_lines').select('*').eq('purchase_id',id)
  toast('Generating PDF...')
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=210, mg=14
  let y=mg
  // Header bar
  doc.setFillColor(217,119,6); doc.rect(0,0,W,26,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont('helvetica','bold')
  doc.text(settings.company||'DJOKO',mg,13)
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  const addr = settings.address&&settings.address!=='null'?settings.address:''
  const contact = [settings.phone,settings.email].filter(x=>x&&x!=='null').join('  ')
  if(addr) doc.text(addr,mg,18)
  if(contact) doc.text(contact,mg,22)
  doc.setFontSize(16); doc.setFont('helvetica','bold')
  doc.text('PURCHASE ORDER',W-mg,12,{align:'right'})
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  doc.text(po.number,W-mg,17,{align:'right'})
  doc.text('Date: '+po.date,W-mg,21,{align:'right'})
  if(po.delivery_date) doc.text('Delivery: '+po.delivery_date,W-mg,25,{align:'right'})
  y=34
  // Supplier box
  doc.setTextColor(0,0,0); doc.setFillColor(255,251,235)
  doc.rect(mg,y,W-mg*2,16,'F')
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(156,163,175)
  doc.text('SUPPLIER',mg+3,y+6)
  doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold')
  doc.text(po.supplier_name||'',mg+3,y+13)
  const sc=po.status==='paid'?[22,163,74]:po.status==='partial'?[37,99,235]:[217,119,6]
  doc.setTextColor(...sc); doc.setFontSize(9)
  doc.text(po.status.toUpperCase(),W-mg-3,y+10,{align:'right'})
  y+=22
  // Table header
  doc.setFillColor(92,61,3); doc.rect(mg,y,W-mg*2,7,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold')
  doc.text('PRODUCT',mg+2,y+5)
  doc.text('QTY',mg+100,y+5,{align:'center'})
  doc.text('UNIT COST',mg+145,y+5,{align:'right'})
  doc.text('LINE TOTAL',W-mg-2,y+5,{align:'right'})
  y+=8
  // Rows
  let totalQty=0, grandTotal=0
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  ;(lines||[]).forEach((l,idx)=>{
    if(y>270){doc.addPage();y=15}
    doc.setFillColor(idx%2===0?255:255,idx%2===0?255:251,idx%2===0?255:235)
    doc.rect(mg,y-1,W-mg*2,8,'F')
    doc.setTextColor(0,0,0)
    doc.text((l.product_name||'').substring(0,45),mg+2,y+4.5)
    doc.text(String(l.qty||0),mg+100,y+4.5,{align:'center'})
    doc.text(fc(l.unit_cost||0,po.currency),mg+145,y+4.5,{align:'right'})
    const lt=(parseFloat(l.qty)||0)*(parseFloat(l.unit_cost)||0)
    doc.text(fc(lt,po.currency),W-mg-2,y+4.5,{align:'right'})
    doc.setDrawColor(229,231,235); doc.line(mg,y+7,W-mg,y+7)
    totalQty+=parseFloat(l.qty)||0; grandTotal+=lt
    y+=8
  })
  // Totals row
  doc.setFillColor(255,251,235); doc.rect(mg,y,W-mg*2,8,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(0,0,0)
  doc.text('TOTAL: '+totalQty+' units',mg+2,y+5.5)
  doc.setFillColor(217,119,6); doc.rect(W-mg-62,y,60,8,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(9)
  doc.text('TOTAL '+po.currency,W-mg-60,y+5.5)
  doc.text(fc(grandTotal,po.currency),W-mg-2,y+5.5,{align:'right'})
  y+=16
  // Paid/Balance
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(107,114,128)
  doc.text('Paid: '+fmt(po.paid_amount||0),W-mg-62,y)
  doc.text('Balance: '+fmt(po.balance||0),W-mg-30,y)
  // Footer
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(156,163,175)
  doc.text('Generated by DJOKO Pro Accounting | '+new Date().toLocaleDateString(),W/2,287,{align:'center'})
  doc.save('PO-'+po.number+'.pdf')
  toast('Purchase order PDF saved! ✓')
}

window.exportCSV = function() {
  const h='Code,Product,Category,Qty,Cost,Price,Value\n'
  const r=products.map(p=>`"${p.code}","${p.name}","${p.category}",${p.qty},${p.cost_price},${p.sell_price},${p.qty*p.cost_price}`).join('\n')
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(h+r); a.download='DJOKO_Inventory.csv'; a.click()
  toast('CSV exported')
}

function renderAll() { renderDash();renderCustomers();renderSuppliers();renderStock();renderStockStats();renderInvoices();renderPurchases();renderReceipts();renderPayments();renderExpenses() }

// ── LOAD DATA ─────────────────────────────────────────────
async function computeBalances() {
  for(const c of customers) {
    const cinv=invoices.filter(i=>i.customer_id===c.id)
    const crc=receipts.filter(r=>r.customer_id===c.id)
    c.totalInvoiced=(c.opening_balance||0)+cinv.reduce((a,i)=>a+i.base_amount,0)
    c.totalPaid=crc.reduce((a,r)=>a+r.base_amount,0)+cinv.filter(i=>i.status==='paid').reduce((a,i)=>a+i.base_amount,0)
    c.balance=Math.max(0,c.totalInvoiced-c.totalPaid)
  }
  for(const s of suppliers) {
    const spo=purchases.filter(p=>p.supplier_id===s.id)
    const spy=payments.filter(p=>p.supplier_id===s.id)
    s.totalPurchased=(s.opening_balance||0)+spo.reduce((a,p)=>a+p.base_amount,0)
    s.totalPaid=spy.reduce((a,p)=>a+p.base_amount,0)+spo.filter(p=>p.status==='paid').reduce((a,p)=>a+p.base_amount,0)
    s.owed=Math.max(0,s.totalPurchased-s.totalPaid)
  }
}

async function loadAll() {
  loading(true)
  try {
    const {error:testErr}=await sb.from('settings').select('id').limit(1)
    if(testErr) throw testErr
    setDb(true,'Connected')
    const {data:sRows}=await sb.from('settings').select('*').limit(1)
    if(sRows?.length){Object.assign(settings,sRows[0]);baseCur=settings.base_currency||'USD';el('base-currency').value=baseCur;el('tco').textContent=settings.company}
    const [c,s,p,inv,po,rc,py,ex,adj]=await Promise.all([
      sb.from('customers').select('*').order('created_at'),
      sb.from('suppliers').select('*').order('created_at'),
      sb.from('products').select('*').order('created_at'),
      sb.from('invoices').select('*').order('date',{ascending:false}),
      sb.from('purchases').select('*').order('date',{ascending:false}),
      sb.from('receipts').select('*').order('date',{ascending:false}),
      sb.from('payments').select('*').order('date',{ascending:false}),
      sb.from('expenses').select('*').order('date',{ascending:false}),
      sb.from('stock_adjustments').select('*').order('created_at',{ascending:false})
    ])
    customers=c.data||[]; suppliers=s.data||[]; products=p.data||[]
    invoices=inv.data||[]; purchases=po.data||[]; receipts=rc.data||[]; payments=py.data||[]; expenses=ex.data||[]
    stockAdjustments=adj.data||[]
    await computeBalances()
    renderAll(); updateBadges()
    toast('Connected! '+customers.length+' customers, '+invoices.length+' invoices')
  } catch(err) {
    setDb(false,'Not connected')
    toast('Database error: '+err.message, false)
    console.error(err)
  } finally {
    loading(false)
  }
}

el('dash-date').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
loadAll()
window.editPurchase = async function(id) {
  const po = purchases.find(p=>p.id===id)
  if(!po) return toast('Purchase order not found', false)

  // Load line items from DB
  const {data:lines, error} = await sb.from('purchase_lines').select('*').eq('purchase_id', id)
  if(error) return toast('Error loading PO: '+error.message, false)

  // Fill header fields
  bcs('po-cur', po.currency)
  el('po-date').value = po.date || ''
  el('po-del').value = po.delivery_date || ''
  el('po-num').value = po.number || ''
  el('po-status').value = po.status || 'pending'

  // Set supplier
  pSel('po-sup', suppliers, 'name', '<option value="">Select supplier...</option>')
  el('po-sup').value = po.supplier_id || ''

  // Rebuild line items
  poLines = (lines||[]).map(l => {
    const prod = products.find(p => p.id === l.product_id) || {
      id: l.product_id,
      name: l.product_name || 'Unknown',
      code: l.product_code || '',
      cost_price: parseFloat(l.unit_cost) || 0,
      sell_price: 0,
      qty: 0
    }
    return {
      prod,
      qty: parseFloat(l.qty) || 1,
      cost: parseFloat(l.unit_cost) || 0
    }
  })

  if(!poLines.length) poLines = [{prod:null, qty:1, cost:0}]

  // Render and calculate
  renderPoLines()
  calcPo()

  // Set edit mode
  el('mo-purchase').dataset.editId = id
  el('mo-purchase').dataset.editOldStatus = po.status
  el('mo-purchase').dataset.editBaseAmt = po.base_amount

  // Update modal UI
  el('po-save-btn').textContent = 'Update PO'
  const h3 = el('mo-purchase').querySelector('.mh h3')
  if(h3) h3.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--org)"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit PO — '+po.number

  el('mo-purchase').classList.add('open')
}

