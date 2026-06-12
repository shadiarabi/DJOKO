// DJOKO Accounting v2.5 - fixed line calculation
import { createClient } from '@supabase/supabase-js'

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
let customers=[], suppliers=[], products=[], invoices=[], purchases=[], receipts=[], payments=[], expenses=[]
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

function toast(msg, ok=true) {
  el('toast-msg').textContent = msg
  el('toast').querySelector('svg').style.color = ok ? '#4ADE80' : '#F87171'
  el('toast').classList.add('show')
  setTimeout(() => el('toast').classList.remove('show'), 2800)
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
  if(id==='mo-customer') bcs('cl-cur')
  if(id==='mo-supplier') bcs('su-cur')
  if(id==='mo-stock') el('sk-code').value='PRD-'+(products.length+1).toString().padStart(3,'0')
  if(id==='mo-invoice'){
    bcs('inv-cur','BRL');el('inv-date').value=d;el('inv-due').value=addD(d,settings.payment_terms||30);if(el('inv-taxa'))el('inv-taxa').value='5.50'
    el('inv-num').value=(settings.invoice_prefix||'INV-')+(invoices.length+1).toString().padStart(3,'0')
    el('inv-disc').value=0; el('inv-status').value='pending'; el('inv-notes').value=''
    pSel('inv-cust',customers,'name','<option value="">Select customer...</option>')
    invLines=[];addInvLine();renderInvLines()
    delete el('mo-invoice').dataset.editId
    el('inv-save-btn').textContent='Save invoice'
    el('mo-invoice').querySelector('.mh h3').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--acc)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> New Sales Invoice'
  }
  if(id==='mo-purchase'){bcs('po-cur');el('po-date').value=d;el('po-del').value=addD(d,14);el('po-num').value=(settings.po_prefix||'PO-')+(purchases.length+1).toString().padStart(3,'0');pSel('po-sup',suppliers,'name','<option value="">Select supplier...</option>');poLines=[];addPoLine();renderPoLines()}
  if(id==='mo-receipt'){bcs('rc-cur');el('rc-date').value=d;pSel('rc-cust',customers,'name','<option value="">Select customer...</option>')}
  if(id==='mo-payment'){bcs('py-cur');el('py-date').value=d;pSel('py-sup',suppliers,'name','<option value="">Select supplier...</option>')}
  if(id==='mo-expense'){bcs('ex-cur');el('ex-date').value=d}
  el(id).classList.add('open')
}
window.closeModal = function(id) { el(id).classList.remove('open') }
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}))
window.changeCurrency = function() { baseCur=el('base-currency').value; renderAll() }

// ── INVOICE LINES ─────────────────────────────────────────
window.addInvLine = function() { invLines.push({prod:null,qty:1,price:0,disc:0}); renderInvLines() }
window.addPoLine = function() { poLines.push({prod:null,qty:1,cost:0}); renderPoLines() }
// ── RENDER INVOICE LINES ──────────────────────────────────
function renderInvLines() {
  const cur = el('inv-cur')?.value || baseCur
  let html = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr style="background:#F9FAFB">'
  html += '<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr)">PRODUCT</th>'
  html += '<th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:65px">QTY</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:85px">PRICE</th>'
  html += '<th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:55px">DISC%</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:85px">TOTAL</th>'
  html += '<th style="border-bottom:1px solid var(--bdr);width:26px"></th>'
  html += '</tr></thead><tbody>'
  invLines.forEach((l,i) => {
    const qty=parseFloat(l.qty)||0, price=parseFloat(l.price)||0, disc=parseFloat(l.disc)||0
    const lt = qty*price*(1-disc/100)
    html += '<tr>'
    html += '<td style="padding:4px 4px 4px 0"><select id="inv-prod-'+i+'" onchange="ilProd('+i+',this.value)" style="width:100%;padding:5px 6px;border:1px solid var(--bdr2);border-radius:4px;font-size:11px;background:var(--inp)">'
    html += '<option value="">Select product...</option>'
    products.forEach(p => { html += '<option value="'+p.id+'"'+(l.prod&&l.prod.id===p.id?' selected':'')+'>'+p.name+'</option>' })
    html += '</select></td>'
    html += '<td style="padding:4px"><input id="inv-qty-'+i+'" type="number" value="'+(l.qty||1)+'" min="1" step="1" oninput="setInvQty('+i+',this.value)" onchange="setInvQty('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:center;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="inv-price-'+i+'" type="number" value="'+(l.price||0)+'" min="0" step="0.01" oninput="setInvPrice('+i+',this.value)" onchange="setInvPrice('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:right;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="inv-disc-line-'+i+'" type="number" value="'+(l.disc||0)+'" min="0" max="100" step="1" oninput="setInvDisc('+i+',this.value)" onchange="setInvDisc('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:center;background:var(--inp)"></td>'
    html += '<td style="padding:4px;text-align:right;font-size:12px;font-weight:600;color:var(--acc)" id="inv-lt-'+i+'">'+fc(lt,cur)+'</td>'
    html += '<td style="padding:4px 0"><button onclick="rmInvLine('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;padding:3px" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
    html += '</tr>'
  })
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
  let html = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr style="background:#F9FAFB">'
  html += '<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr)">PRODUCT</th>'
  html += '<th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:65px">QTY</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:100px">UNIT COST</th>'
  html += '<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:var(--tx2);border-bottom:1px solid var(--bdr);width:100px">LINE TOTAL</th>'
  html += '<th style="border-bottom:1px solid var(--bdr);width:26px"></th></tr></thead><tbody>'
  poLines.forEach((l,i) => {
    const qty=parseFloat(l.qty)||0, cost=parseFloat(l.cost)||0, lt=qty*cost
    html += '<tr>'
    html += '<td style="padding:4px 4px 4px 0"><select id="po-prod-'+i+'" onchange="plProd('+i+',this.value)" style="width:100%;padding:5px 6px;border:1px solid var(--bdr2);border-radius:4px;font-size:11px;background:var(--inp)"><option value="">Select product...</option>'
    products.forEach(p => { html += '<option value="'+p.id+'"'+(l.prod&&l.prod.id===p.id?' selected':'')+'>'+p.name+'</option>' })
    html += '</select></td>'
    html += '<td style="padding:4px"><input id="po-qty-'+i+'" type="number" value="'+(l.qty||1)+'" min="1" step="1" oninput="setPoQty('+i+',this.value)" onchange="setPoQty('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:center;background:var(--inp)"></td>'
    html += '<td style="padding:4px"><input id="po-cost-'+i+'" type="number" value="'+(l.cost||0)+'" min="0" step="0.01" oninput="setPoQost('+i+',this.value)" onchange="setPoQost('+i+',this.value)" style="width:100%;padding:5px 4px;border:1px solid var(--bdr2);border-radius:4px;font-size:12px;text-align:right;background:var(--inp)"></td>'
    html += '<td style="padding:4px;text-align:right;font-size:12px;font-weight:600;color:var(--acc)" id="po-lt-'+i+'">'+fc(lt,cur)+'</td>'
    html += '<td style="padding:4px 0"><button onclick="rmPoLine('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;padding:3px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
    html += '</tr>'
  })
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
    const inp = el('inv-price-'+i)
    if(inp) inp.value = p.sell_price || 0
    refreshInvLine(i)
  }
}

// ── PO LINE PRODUCT SELECTED ──────────────────────────────
window.plProd = function(i, pid) {
  const p = products.find(x => x.id === pid)
  poLines[i].prod = p || null
  if(p) {
    poLines[i].cost = parseFloat(p.cost_price) || 0
    const inp = el('po-cost-'+i)
    if(inp) inp.value = p.cost_price || 0
    refreshPoLine(i)
  }
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

  // Show totals in invoice currency (BRL)
  if(el('inv-sub')) el('inv-sub').textContent = fc(sub, cur)
  if(el('inv-disc-amt')) el('inv-disc-amt').textContent = discAmt>0 ? '- '+fc(discAmt,cur) : ''
  if(el('inv-total')) el('inv-total').textContent = fc(total, cur)

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
  const taxa = parseFloat(el('inv-taxa')?.value) || 0.18
  // If currency is BRL, convert to USD using taxa; otherwise use standard rates
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
    const invData={number:el('inv-num').value,customer_id:cid,customer_name:cust?.name,date:el('inv-date').value,due_date:el('inv-due').value,currency:cur,subtotal:sub,discount_pct:discPct,total,base_amount:baseAmt,cogs,paid_amount:paid,balance:baseAmt-paid,status,notes:el('inv-notes').value,taxa:parseFloat(el('inv-taxa')?.value)||5.50}
    const {error}=await sb.from('invoices').update(invData).eq('id',editId)
    if(error){btn.disabled=false;btn.textContent='Update invoice';return toast('Error: '+error.message,false)}
    // Replace lines
    await sb.from('invoice_lines').delete().eq('invoice_id',editId)
    await sb.from('invoice_lines').insert(invLines.map(l=>({invoice_id:editId,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:l.qty,unit_price:l.price,discount_pct:l.disc||0,line_total:l.qty*l.price*(1-(l.disc||0)/100),cogs:l.qty*(l.prod?.cost_price||0)})))
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
    closeModal('mo-invoice'); saved(); toast('Invoice updated!'); updateBadges()
  } else {
    // ── CREATE NEW INVOICE ──
    const {data:inv,error}=await sb.from('invoices').insert({number:el('inv-num').value,customer_id:cid,customer_name:cust?.name,date:el('inv-date').value,due_date:el('inv-due').value,currency:cur,subtotal:sub,discount_pct:discPct,total,base_amount:baseAmt,cogs,paid_amount:paid,balance:baseAmt-paid,status,notes:el('inv-notes').value,taxa:parseFloat(el('inv-taxa')?.value)||5.50}).select().single()
    if(error){btn.disabled=false;btn.textContent='Save invoice';return toast('Error: '+error.message,false)}
    await sb.from('invoice_lines').insert(invLines.map(l=>({invoice_id:inv.id,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:l.qty,unit_price:l.price,discount_pct:l.disc||0,line_total:l.qty*l.price*(1-(l.disc||0)/100),cogs:l.qty*(l.prod?.cost_price||0)})))
    for(const l of valid){await sb.from('products').update({qty:Math.max(0,(l.prod.qty||0)-l.qty)}).eq('id',l.prod.id);const p=products.find(x=>x.id===l.prod.id);if(p)p.qty=Math.max(0,p.qty-l.qty)}
    invoices.unshift(inv)
    if(cust){cust.totalInvoiced=(cust.totalInvoiced||0)+baseAmt;if(status==='paid')cust.totalPaid=(cust.totalPaid||0)+baseAmt;else cust.balance=(cust.balance||0)+baseAmt}
    btn.disabled=false; btn.textContent='Save invoice'
    renderInvoices(); renderCustomers(); renderStock(); renderDash()
    closeModal('mo-invoice'); saved(); toast('Invoice saved!'); updateBadges()
  }
}
window.delInvoice = async function(id) {
  if(!confirm('Delete?'))return
  const inv=invoices.find(i=>i.id===id); if(!inv)return
  await sb.from('invoices').delete().eq('id',id)
  invoices=invoices.filter(i=>i.id!==id)
  const c=customers.find(x=>x.id===inv.customer_id)
  if(c){c.totalInvoiced-=inv.base_amount;if(inv.status==='paid')c.totalPaid-=inv.paid_amount;else c.balance-=inv.balance}
  renderInvoices(); renderCustomers(); renderDash(); toast('Deleted'); updateBadges()
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
  if(el('inv-taxa')) el('inv-taxa').value = inv.taxa || 5.50
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
      disc: parseFloat(l.discount_pct) || 0
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
  const total=poLines.reduce((a,l)=>a+l.qty*l.cost,0)
  const baseAmt=toBase(total,cur)
  const status=el('po-status').value
  const paid=status==='paid'?baseAmt:0
  const supp=suppliers.find(s=>s.id===sid)
  const btn=el('po-save-btn'); btn.disabled=true; btn.textContent='Saving...'
  const {data:po,error}=await sb.from('purchases').insert({number:el('po-num').value,supplier_id:sid,supplier_name:supp?.name,date:el('po-date').value,delivery_date:el('po-del').value,currency:cur,total,base_amount:baseAmt,paid_amount:paid,balance:baseAmt-paid,status}).select().single()
  if(error){btn.disabled=false;btn.textContent='Save PO';return toast('Error: '+error.message,false)}
  await sb.from('purchase_lines').insert(poLines.map(l=>({purchase_id:po.id,product_id:l.prod?.id,product_name:l.prod?.name,product_code:l.prod?.code,qty:l.qty,unit_cost:l.cost,line_total:l.qty*l.cost})))
  for(const l of valid){await sb.from('products').update({qty:(l.prod.qty||0)+l.qty,cost_price:l.cost}).eq('id',l.prod.id);const p=products.find(x=>x.id===l.prod.id);if(p){p.qty+=l.qty;p.cost_price=l.cost}}
  purchases.unshift(po)
  if(supp){supp.totalPurchased=(supp.totalPurchased||0)+baseAmt;if(status==='paid')supp.totalPaid=(supp.totalPaid||0)+baseAmt;else supp.owed=(supp.owed||0)+baseAmt}
  btn.disabled=false; btn.textContent='Save PO'
  renderPurchases(); renderSuppliers(); renderStock(); renderDash()
  closeModal('mo-purchase'); saved(); toast('Purchase saved!'); updateBadges()
}
window.delPurchase = async function(id) {
  if(!confirm('Delete?'))return
  const po=purchases.find(p=>p.id===id); if(!po)return
  await sb.from('purchases').delete().eq('id',id)
  purchases=purchases.filter(p=>p.id!==id)
  const s=suppliers.find(x=>x.id===po.supplier_id)
  if(s){s.totalPurchased-=po.base_amount;if(po.status==='paid')s.totalPaid-=po.paid_amount;else s.owed-=po.balance}
  renderPurchases(); renderSuppliers(); renderDash(); toast('Deleted'); updateBadges()
}
window.editPurchaseStatus = async function(id) {
  const po=purchases.find(p=>p.id===id); if(!po)return
  const newStatus=prompt('Change status:\npending / partial / paid', po.status)
  if(!newStatus||!['pending','partial','paid'].includes(newStatus))return
  const oldStatus=po.status
  const supp=suppliers.find(s=>s.id===po.supplier_id)
  const paid=newStatus==='paid'?po.base_amount:newStatus==='partial'?po.base_amount*0.5:0
  const balance=po.base_amount-paid
  await sb.from('purchases').update({status:newStatus,paid_amount:paid,balance}).eq('id',id)
  po.status=newStatus; po.paid_amount=paid; po.balance=balance
  if(supp){
    if(oldStatus!=='paid'&&newStatus==='paid'){supp.totalPaid=(supp.totalPaid||0)+po.base_amount;supp.owed=Math.max(0,(supp.owed||0)-po.base_amount)}
    else if(oldStatus==='paid'&&newStatus!=='paid'){supp.totalPaid=Math.max(0,(supp.totalPaid||0)-po.base_amount);supp.owed=(supp.owed||0)+po.base_amount}
  }
  renderPurchases(); renderSuppliers(); renderDash(); saved(); toast('PO status updated to: '+newStatus); updateBadges()
}

// ── RECEIPTS ──────────────────────────────────────────────
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
  if(!products.length){tb.innerHTML=erow(10,'No products yet');return}
  tb.innerHTML=products.map(p=>{
    const m=p.sell_price>0?Math.round((p.sell_price-p.cost_price)/p.sell_price*100):0
    return `<tr>
      <td><code style="background:#F3F4F6;padding:2px 5px;border-radius:3px;font-size:10px">${p.code}</code></td>
      <td><strong>${p.name}</strong></td><td>${p.category}</td>
      <td style="font-weight:700;color:${p.qty<=p.reorder_level?'var(--red)':'var(--txt)'}">${p.qty} ${p.uom}</td>
      <td style="color:var(--tx2)">${p.reorder_level}</td>
      <td>${fmt(p.cost_price)}</td><td>${fmt(p.sell_price)}</td>
      <td style="font-weight:700">${fmt(p.qty*p.cost_price)}</td>
      <td style="color:${m>=30?'var(--grn)':m>=10?'var(--org)':'var(--red)'};font-weight:700">${m}%</td>
      <td>${skb(p.qty,p.reorder_level)}</td><td style="white-space:nowrap">${editBtn(`editStock('${p.id}')`)} ${delBtn(`delStock('${p.id}')`)}</td></tr>`}).join('')
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
    <td style="white-space:nowrap"><button class="btn icon ghost" onclick="editPurchase('${po.id}')" title="Edit status" style="color:var(--acc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> ${delBtn(`delPurchase('${po.id}')`)}</td></tr>`).join('')
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
  const lHtml=(lines||[]).map(l=>`
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${l.product_name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${l.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${fc(l.unit_price,inv.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${l.discount_pct||0}%</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${fc(l.line_total,inv.currency)}</td>
    </tr>`).join('')

  const printWin = window.open('','_blank','width=760,height=1000')
  const html = [
    '<!DOCTYPE html><html><head><title>Invoice '+inv.number+'</title>',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:Segoe UI,Arial,sans-serif;padding:40px;color:#111;font-size:13px}',
    '.hdr{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #2563EB}',
    '.co{font-size:22px;font-weight:800;color:#2563EB}',
    '.it{font-size:26px;font-weight:700;text-align:right}',
    '.stamp{display:inline-block;border:3px solid '+(inv.status==='paid'?'#16A34A':'#D97706')+';color:'+(inv.status==='paid'?'#16A34A':'#D97706')+';font-size:16px;font-weight:800;padding:5px 16px;border-radius:6px;transform:rotate(-8deg);opacity:.8;margin-top:10px;text-transform:uppercase;letter-spacing:2px}',
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;background:#F9FAFB;padding:16px;border-radius:8px}',
    '.pl{font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;margin-bottom:5px}',
    'table.items{width:100%;border-collapse:collapse;margin-bottom:16px}',
    'table.items thead th{background:#1E3A5F;color:#fff;padding:9px 12px;text-align:left;font-size:11px}',
    '.tot{width:260px;margin-left:auto}',
    'table.tot td{padding:6px 10px}',
    '.grand td{background:#2563EB;color:#fff;font-weight:700;font-size:15px}',
    '.footer{margin-top:32px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#9CA3AF;text-align:center}',
    '@media print{button{display:none!important}}',
    '</style></head><body>',
    '<div class="hdr">',
    '<div><div class="co">'+settings.company+'</div><div style="font-size:11px;color:#6B7280;margin-top:4px">'+settings.address+'<br>'+settings.phone+' '+settings.email+'</div></div>',
    '<div><div class="it">INVOICE</div><div style="font-size:12px;color:#6B7280;text-align:right;margin-top:5px">'+inv.number+'<br>Date: '+inv.date+'<br>Due: '+(inv.due_date||'—')+'</div><div class="stamp">'+inv.status+'</div></div>',
    '</div>',
    '<div class="parties"><div><div class="pl">From</div><div style="font-size:14px;font-weight:700">'+settings.company+'</div></div><div><div class="pl">Bill to</div><div style="font-size:14px;font-weight:700">'+inv.customer_name+'</div></div></div>',
    '<table class="items"><thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:center">Disc</th><th style="text-align:right">Total</th></tr></thead>',
    '<tbody>'+lHtml+'</tbody></table>',
    '<table class="tot"><tr><td style="color:#6B7280">Subtotal</td><td style="text-align:right">'+fc(inv.subtotal,inv.currency)+'</td></tr>',
    (inv.discount_pct?'<tr><td style="color:#6B7280">Discount ('+inv.discount_pct+'%)</td><td style="text-align:right;color:#DC2626">-'+fc(inv.subtotal*inv.discount_pct/100,inv.currency)+'</td></tr>':''),
    '<tr class="grand"><td>TOTAL ('+inv.currency+')</td><td style="text-align:right">'+fc(inv.total,inv.currency)+'</td></tr></table>',
    (inv.notes?'<div style="margin-top:18px;padding:10px;background:#F9FAFB;border-radius:6px;font-size:11px;color:#6B7280"><strong>Notes:</strong> '+inv.notes+'</div>':''),
    '<div class="footer">Generated by DJOKO Pro Accounting | '+new Date().toLocaleDateString()+'</div>',
    '<br><button onclick="window.print()" style="margin-top:12px;padding:10px 22px;background:#2563EB;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer">Print / Save as PDF</button>',
    '</body></html>'
  ].join('')
  printWin.document.write(html)
  printWin.document.close()
}

window.printReport = function() {
  renderReports()
  const printWin = window.open('','_blank','width=820,height=1000')
  const html = [
    '<!DOCTYPE html><html><head><title>'+settings.company+' Reports</title>',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:Segoe UI,Arial,sans-serif;padding:32px;color:#111;font-size:12px}',
    'h1{font-size:20px;font-weight:700;color:#2563EB;margin-bottom:4px}',
    '.sub{color:#6B7280;font-size:11px;margin-bottom:22px}',
    '.sec{margin-bottom:26px}',
    'h2{font-size:14px;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #2563EB}',
    'table{width:100%;border-collapse:collapse}',
    'th{background:#F9FAFB;padding:7px 10px;text-align:left;border-bottom:1px solid #E5E7EB;font-size:10px;font-weight:600;color:#6B7280}',
    'td{padding:7px 10px;border-bottom:1px solid #F3F4F6}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}',
    '.card{border:1px solid #E5E7EB;border-radius:6px;overflow:hidden}',
    '@media print{button{display:none!important}}',
    '</style></head><body>',
    '<h1>'+settings.company+' — Financial Reports</h1>',
    '<div class="sub">Generated: '+new Date().toLocaleString()+' | Base currency: '+baseCur+'</div>',
    '<div class="sec"><h2>Balance Sheet</h2>'+el('rpt-bs').innerHTML+'</div>',
    '<div class="sec"><h2>Profit & Loss</h2>'+el('rpt-pl').innerHTML+'</div>',
    '<br><button onclick="window.print()" style="padding:10px 22px;background:#2563EB;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer">Print / Save as PDF</button>',
    '</body></html>'
  ].join('')
  printWin.document.write(html)
  printWin.document.close()
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
    const [c,s,p,inv,po,rc,py,ex]=await Promise.all([
      sb.from('customers').select('*').order('created_at'),
      sb.from('suppliers').select('*').order('created_at'),
      sb.from('products').select('*').order('created_at'),
      sb.from('invoices').select('*').order('date',{ascending:false}),
      sb.from('purchases').select('*').order('date',{ascending:false}),
      sb.from('receipts').select('*').order('date',{ascending:false}),
      sb.from('payments').select('*').order('date',{ascending:false}),
      sb.from('expenses').select('*').order('date',{ascending:false})
    ])
    customers=c.data||[]; suppliers=s.data||[]; products=p.data||[]
    invoices=inv.data||[]; purchases=po.data||[]; receipts=rc.data||[]; payments=py.data||[]; expenses=ex.data||[]
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
