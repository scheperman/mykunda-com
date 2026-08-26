  /* ---------------- DE FLOW ----------------
     Eén reeks vragen in plaats van twee formulieren. Er wordt hier
     niet gerekend: elk bedrag komt uit MK_VAL.value() in
     valuation.js, zodat sell.html, list.html en de zelftest
     hetzelfde antwoord geven.

     Wat hierboven staat blijft van kracht: het intekenen van de
     kavel schrijft in lfSize, lfBeach en lfBeachDist, en die
     velden staan in deze flow onder dezelfde namen. Daardoor
     werkt de kaart zonder dat er één regel tekencode is veranderd.
     ---------------------------------------- */
  function initValuationFlow(){
    var AREAS = window.MK_AREAS || {LAND:{},LABELS:{}};
    var BASE = AREAS.LAND || {}, LABELS = AREAS.LABELS || {};
    var $ = function(id){ return document.getElementById(id); };
    if(!$('mkv1') || !window.MK_VAL) return;

    var S = {type:'', area:'', beach:'inland', plot:'', built:'',
      title:'alkalalo', road:'laterite', elec:'present', water:'nearby',
      fence:'partial', cleared:'cleared', shape:'regular', corner:'no', flood:'no',
      finish:'standard', year:'', condition:'good', floors:'1', baths:'2',
      security:'wall', pool:'no', solar:'no', furnished:'unfurnished', view:'none'};

    /* De gebiedenlijst komt uit dezelfde tabel als de tarieven. */
    (function(){
      var dl=$('mkvAreas'); if(!dl) return;
      var seen={}, out=[];
      Object.keys(LABELS).forEach(function(k){ var l=LABELS[k]; if(!seen[l]){seen[l]=1;out.push(l);} });
      out.sort().forEach(function(l){ var o=document.createElement('option'); o.value=l; dl.appendChild(o); });
    })();

    function money(eur){
      if(eur==null) return '—';
      var c=CURRENCIES[getCurrency()], v=eur*(c.rate||1);
      var step = v>=200000?5000 : v>=50000?1000 : v>=2000?500 : v>=100?10 : 1;
      return c.symbol + (Math.round(v/step)*step).toLocaleString('en-US');
    }

    var at=1;
    function show(n){
      at=n;
      [1,2,3,4,5].forEach(function(i){
        var el=$('mkv'+i); if(!el) return;
        el.hidden = i>n; el.classList.toggle('done', i<n);
      });
      var el=$('mkv'+n);
      if(el && n>1){
        var soft = !window.matchMedia || !matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({behavior: soft?'smooth':'auto', block:'nearest'});
      }
      if(n>=2 && ldMap){ setTimeout(function(){ ldMap.invalidateSize(); },80); }
    }
    function recap(){
      var t={land:'Land or plot',house:'House with land',apartment:'Apartment'}[S.type]||'';
      $('mkvR1').innerHTML='<b>'+t+'</b>';
      $('mkvR2').innerHTML='<b>'+(S.area||'—')+'</b>'+(S.beach!=='inland'?' · '+(S.beach==='beachfront'?'beachfront':'near the beach'):'');
      var sz=[]; if(S.plot) sz.push(S.plot+' m² plot'); if(S.built) sz.push(S.built+' m² built');
      $('mkvR3').innerHTML='<b>'+(sz.join(' · ')||'—')+'</b>';
    }

    var FINISH_HINT={
      basic:'Cement or basic tiled floor, steel windows, corrugated roof, no air-conditioning.',
      standard:'Tiled floors, mosquito screens, ceilings, a water heater — what most homes have.',
      high:'Aluminium sliding doors, air-conditioning, fitted kitchen, finished ceilings.'};

    function applyType(){
      var land=S.type==='land', apt=S.type==='apartment';
      $('mkvLandFields').style.display = apt?'none':'';
      $('mkvBuildFields').style.display = land?'none':'';
      $('mkvWrapPlot').style.display = apt?'none':'';
      $('mkvWrapBuilt').style.display = land?'none':'';
      $('mkvH4').textContent = land?'The plot':apt?'The apartment':'The plot and the house';
      $('mkvH3').textContent = land
        ? 'A standard Gambian plot is 400 to 500 m² — 20 by 20, or 20 by 25 metres.'
        : apt ? 'The floor area of the unit itself.'
              : 'The plot is the whole compound; built area is only what stands under a roof.';
      $('ldMapBox').style.display = apt?'none':'';
      document.querySelectorAll('#mkvTypes .mkv-card').forEach(function(c){
        c.classList.toggle('sel', c.dataset.type===S.type);
      });
    }

    function calc(){
      if(!S.type || !S.area || (!S.plot && !S.built)) return null;
      return window.MK_VAL.value({
        type: S.type==='house'?'villa':S.type,
        area:S.area, plotSqm:S.plot, builtSqm:S.built,
        title:S.title, road:S.road, elec:S.elec, water:S.water, fence:S.fence,
        cleared:S.cleared, shape:S.shape, corner:S.corner, flood:S.flood,
        beach:S.beach, view:S.view, finish:S.finish, yearBuilt:S.year,
        condition:S.condition, floors:S.floors, baths:S.baths,
        security:S.security, pool:S.pool, solar:S.solar, furnished:S.furnished
      }, {LAND_BASE: BASE});
    }
    function kv(k,v,sm){ return '<div class="mkv-kv'+(sm?' sm':'')+'"><span>'+k+'</span><b>'+v+'</b></div>'; }

    var last=null;
    function render(){
      var r=calc();
      /* Onbekend gebied: geen bedrag maar uitleg. Een nul is geen schatting. */
      if(r && r.ok===false){
        $('mkvRes').hidden=true; $('mkvPortalBox').hidden=true; $('mkvRentBox').hidden=true;
        $('mkvIdle').hidden=false;
        $('mkvIdle').innerHTML='We have no rate for <b>'+(S.area||'this area')+'</b>. Try the nearest larger town, or ask for the report and someone will look at it.';
        last=null; return;
      }
      $('mkvIdle').hidden=!!r; $('mkvRes').hidden=!r;
      $('mkvPortalBox').hidden=!(r&&r.portal);
      $('mkvRentBox').hidden=!(r&&S.type!=='land');
      if(!r){ last=null; return; }
      last=r;
      $('mkvBig').textContent=money(r.mid);
      $('mkvBand').textContent='Range '+money(r.low)+' – '+money(r.high);
      $('mkvConf').className='mkv-conf '+r.confidence.label;
      $('mkvConfTxt').textContent={strong:'Strongly evidenced',fair:'Fairly evidenced',indicative:'Indicative only'}[r.confidence.label];
      $('mkvWhy').innerHTML=r.confidence.reasons.map(function(w){return '<li>'+w+'</li>';}).join('');
      var sp=[];
      if(r.land) sp.push(kv('Land',money(r.land)));
      if(r.build) sp.push(kv('Building',money(r.build)));
      if(r.rebuild) sp.push(kv('Cost to rebuild today',money(r.rebuild),true));
      $('mkvSplit').innerHTML=sp.join('');
      $('mkvLines').innerHTML=r.lines.map(function(l){
        var val = l.unit==='pt' ? (l.v>0?'+'+l.v:l.v)+'%'
                : l.unit==='%' ? l.v+'%'
                : l.unit==='/m²' ? money(l.v)+'/m²'
                : l.v==null ? '' : money(l.v);
        return '<div class="mkv-ln'+(l.strong?' strong':'')+'"><span>'+l.k+'</span>'
          +(l.note?'<span class="n">'+l.note+'</span>':'')+'<b>'+val+'</b></div>';
      }).join('');
      if(r.portal){
        $('mkvPortalTxt').innerHTML='Plots in '+r.portal.area+' are advertised there at <span class="num">'
          +money(r.portal.low)+' – '+money(r.portal.high)+'</span> — '+money(r.portal.rateLow)+' to '
          +money(r.portal.rateHigh)+' per m². That is a different market with different buyers. The figure above is the local one.';
      }
      if(S.type!=='land'){
        $('mkvRentTxt').innerHTML='A local long let here brings in roughly <span class="num">'
          +money(r.rent.local)+' a month</span>, or <span class="num">'+(r.rent.grossYield*100).toFixed(1)
          +'% gross yield</span>. Furnished, to expatriate tenants, closer to <span class="num">'
          +money(r.rent.expat)+' a month</span>. Gross: 8% rental income tax still comes off.';
      }
    }

    /* ---- bediening ---- */
    document.querySelectorAll('#mkvTypes .mkv-card').forEach(function(b){
      b.addEventListener('click',function(){ S.type=b.dataset.type; applyType(); recap(); show(2); render(); });
    });
    [['lfLocation','area'],['lfBeach','beach'],['lfSize','plot'],['mkvBuilt','built'],
     ['mkvTitle','title'],['mkvRoad','road'],['mkvElec','elec'],['mkvWater','water'],
     ['mkvFence','fence'],['mkvCleared','cleared'],['mkvShape','shape'],['mkvCorner','corner'],
     ['mkvFlood','flood'],['mkvFinish','finish'],['mkvYear','year'],['mkvCondition','condition'],
     ['mkvFloors','floors'],['mkvBaths','baths'],['mkvSecurity','security'],['mkvPool','pool'],
     ['mkvSolar','solar'],['mkvFurnished','furnished'],['mkvView','view']
    ].forEach(function(p){
      var el=$(p[0]); if(!el) return;
      /* Ook 'change': het intekenen van de kavel schrijft lfSize en
         lfBeach programmatisch en vuurt daar zelf een event bij. */
      ['input','change'].forEach(function(ev){
        el.addEventListener(ev,function(){
          S[p[1]]=el.value; el.classList.remove('bad');
          if(p[1]==='finish') $('mkvFinishHint').textContent=FINISH_HINT[el.value]||'';
          recap(); render();
        });
      });
    });

    /* De kaart volgt de plaatsnaam, net als in de oude tool. */
    var locTimer=null;
    $('lfLocation').addEventListener('input',function(){
      clearTimeout(locTimer);
      var v=this.value;
      locTimer=setTimeout(function(){
        if(LD.pts.length>=3) return;
        var a=areaName(v);
        if(!a && PLUS_RE.test(v)) a=areaFromPlusCode(v);
        if(!a) a=nearestArea(parseLatLng(v));
        var ll=updateValMap(ldMap,ldMarker,'ldMapLabel',v,a,a||v.trim());
        if(ll){ LD.ll=ll; ldApplyGeo(); if(ldMap) ldMap.setView([ll.lat,ll.lng], isExactLoc(v)?18:15); }
      },450);
    });

    $('mkv2').querySelector('[data-next]').addEventListener('click',function(){
      if(!S.area.trim()){ $('lfLocation').classList.add('bad'); $('mkvE2').textContent='Give an area — without a location there is no rate to work from.'; $('lfLocation').focus(); return; }
      $('mkvE2').textContent=''; recap(); show(3); render();
    });
    $('mkv3').querySelector('[data-next]').addEventListener('click',function(){
      var need = S.type==='apartment' ? S.built : S.type==='land' ? S.plot : (S.plot||S.built);
      if(!need || +need<=0){ $('mkvE3').textContent='Give a size — that is what everything is multiplied by.'; return; }
      $('mkvE3').textContent=''; recap(); show(4); render();
    });
    document.querySelectorAll('#value .mkv-recap').forEach(function(b){
      b.addEventListener('click',function(){ show(+b.dataset.goto); });
    });
    $('mkvToReport').addEventListener('click',function(){ show(5); });
    $('mkvSkip').addEventListener('click',function(){ show(4); });
    $('mkvRestart').addEventListener('click',function(){ location.reload(); });
    $('mkvGrip').addEventListener('click',function(){
      var open=$('mkvRail').classList.toggle('open');
      this.setAttribute('aria-expanded', open?'true':'false');
    });

    $('mkvSend').addEventListener('click',function(){
      var nm=$('mkvName').value.trim(), em=$('mkvEmail').value.trim();
      if(!nm){ $('mkvName').classList.add('bad'); $('mkvE5').textContent='Please add your name.'; return; }
      if(!emailOk(em)){ $('mkvEmail').classList.add('bad'); $('mkvE5').textContent='Please add a valid email address.'; return; }
      $('mkvE5').textContent='';
      var r=last||calc(); if(!r||r.ok===false) return;
      var btn=this; btn.disabled=true; btn.textContent='Sending…';
      sendLead('valuation',{
        name:nm, email:em, phone:$('mkvPhone').value.trim(), area:S.area,
        message:'Valuation: '+S.type+', '+S.area+', '+(S.plot||'?')+' m² plot, '+(S.built||'0')+' m² built, estimate '+money(r.mid),
        payload:{input:S, boundary: LD.pts.length>=3 ? {type:'polygon',points:LD.pts.map(function(p){return {lat:+p[0].toFixed(6),lng:+p[1].toFixed(6)};}),area_m2:LD.sqm,centroid:LD.ll} : null,
          beach_m: LD.seaM, result:{mid:r.mid,low:r.low,high:r.high,land:r.land,build:r.build,rebuild:r.rebuild,confidence:r.confidence.score}}
      }).then(function(){
        $('mkv5').querySelector('.mkv-body').innerHTML='<p class="mkv-hint" style="margin:0">Thank you, '+nm.split(' ')[0]+'. The report is on its way to '+em+'. If you would like the estimate checked on site, just reply to that email.</p>';
      }).catch(function(e){
        console.warn('valuation lead error:', e);
        btn.disabled=false; btn.textContent='Send the report';
        $('mkvE5').innerHTML=contactFallbackHTML('Hello MyKunda! I used the valuation tool for a property in '+S.area+' (estimate '+money(r.mid)+') but the form did not go through. My name is '+nm+'.', "Your estimate is on screen, but the report request did not reach us. Send it directly:");
      });
    });

    $('mkvFinishHint').textContent=FINISH_HINT[S.finish];
    applyType(); render();

    /* De listing-knop van de oude tool: het bedrag gaat mee naar list.html. */
    window.__mkvListHref=function(){
      var r=last; if(!r||r.ok===false) return null;
      var p=new URLSearchParams();
      p.set('cat', S.type==='house'?'villa':S.type);
      if(S.area) p.set('area',S.area);
      if(S.plot) p.set(S.type==='land'?'sqm':'plot', S.plot);
      if(S.built) p.set('sqm', S.built);
      p.set('price', Math.round(r.mid*(CURRENCIES.GMD.rate/CURRENCIES.EUR.rate)));
      return 'list.html?'+p.toString();
    };
  }

  initValMaps();
  initValuationFlow();
