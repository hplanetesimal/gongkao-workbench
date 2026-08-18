(function(){
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}

/* ===== 清理 ECharts tooltip 残留 ===== */
/* 彻底清理 body 下所有 ECharts 生成的 tooltip / 临时 DOM */
window.cleanupEchartsTooltips=function(){
  /* 1. 清理所有 ECharts tooltip 元素（多种可能的 selector） */
  var selectors=[
    'body > div[style*="z-index: 9999999"]',
    'body > div[style*="z-index:9999999"]',
    'body > div[style*="position: absolute !important; visibility: hidden"]',
    'body > div[style*="position:absolute !important;visibility:hidden"]',
    'body > div._echarts_tooltip_',
    'body > div[class*="echarts"]',
    'body > div[class*="tooltip"]'
  ];
  selectors.forEach(function(sel){
    try{document.querySelectorAll(sel).forEach(function(el){el.remove()})}catch(e){}
  });
  /* 2. 清理 body 直接子元素中，无内容、无 class 的悬浮 div（ECharts tooltip 常见特征） */
  document.querySelectorAll('body > div').forEach(function(el){
    if(el.id||el.className) return; /* 跳过有 id 或 class 的正常元素 */
    var s=el.style;
    if((s.position==='absolute'||s.position==='fixed')&&(s.zIndex||s.zIndex==='0')){
      /* 检查是否是 ECharts tooltip（通常有 pointer-events 或高 z-index） */
      if(s.pointerEvents==='none'||parseInt(s.zIndex)>=999){
        el.remove();
        return;
      }
      /* 也清理无内容的悬浮空 div */
      if(!el.textContent.trim()&&el.children.length===0){
        el.remove();
      }
    }
  });
};

/* ===== 销毁所有 ECharts 实例 ===== */
window.disposeAllCharts=function(){
  document.querySelectorAll('.chart[_echarts_instance_]').forEach(function(el){
    var inst=echarts.getInstanceByDom(el);
    if(inst){
      try{inst.dispose()}catch(e){}
    }
  });
  /* 销毁后再清理 tooltip */
  if(window.cleanupEchartsTooltips)window.cleanupEchartsTooltips();
};

/* ===== 检查元素是否可见（有宽高） ===== */
function isVisible(el){
  if(!el)return false;
  /* 检查元素及其所有祖先是否 display:none */
  var node=el;
  while(node&&node!==document.body){
    var cs=getComputedStyle(node);
    if(cs.display==='none'||cs.visibility==='hidden')return false;
    node=node.parentElement;
  }
  var rect=el.getBoundingClientRect();
  return rect.width>0&&rect.height>0;
}

/* ===== 按面板渲染对应图表 ===== */
/* pane: 'stats' | 'focusDaily' | 'focusTotal' */
window.renderChartsForPane=function(st,pane){
  if(!window.renderMikkoCharts)return;
  /* 先销毁当前面板的图表实例，避免重复 */
  var ids=[];
  if(pane==='stats')ids=['chartModules','chartWrongs'];
  else if(pane==='focusDaily')ids=['chartFocusDaily','chartFocusMonthly'];
  else if(pane==='focusTotal')ids=['chartFocusModules','chartFocusMonthlyTrend'];
  ids.forEach(function(id){
    var el=document.getElementById(id);
    if(el){
      var inst=echarts.getInstanceByDom(el);
      if(inst){try{inst.dispose()}catch(e){}}
    }
  });
  /* 调用渲染（renderMikkoCharts 内部会检查可见性） */
  window.renderMikkoCharts(st);
};

/* ===== 主渲染函数 ===== */
window.renderMikkoCharts=function(st){
  const accent=css('--accent')||'#ff8fb7', accent2=css('--accent2')||'#8cc7ff', ink=css('--ink')||'#4e382f', muted=css('--muted')||'#aa9383', line=css('--line')||'#f1d8c7';

  function init(id){
    let el=document.getElementById(id);
    if(!el)return null;
    /* 如果容器不可见，跳过初始化（避免 0 尺寸问题） */
    if(!isVisible(el))return null;
    /* 如果已有实例，先销毁再重建 */
    let existing=echarts.getInstanceByDom(el);
    if(existing){try{existing.dispose()}catch(e){}}
    /* 清空容器内残留 */
    el.innerHTML='';
    return echarts.init(el,null,{renderer:'svg'});
  }

  /* 统计 - 模块完成度 */
  let m=init('chartModules'); if(m){
    m.setOption({animation:false,tooltip:{trigger:'item',confine:true,appendToBody:false},grid:{left:80,right:24,top:22,bottom:24},xAxis:{type:'value',max:100,axisLabel:{color:muted},splitLine:{lineStyle:{color:line,type:'dashed'}}},yAxis:{type:'category',data:st.modules.map(x=>x.name).reverse(),axisLabel:{color:ink,fontWeight:700},axisLine:{show:false}},series:[{type:'bar',data:st.modules.map(x=>Math.round(((+x.done||0)/(+x.hours||1))*100)).reverse(),barWidth:14,itemStyle:{borderRadius:8,color:accent},label:{show:true,position:'right',formatter:'{c}%',color:muted}}]});
    window.addEventListener('resize',()=>{try{m.resize()}catch(e){}});
  }
  /* 统计 - 错题分布 */
  let w=init('chartWrongs'); if(w){
    let counts={};(st.wrongs||[]).forEach(x=>counts[x.module]=(counts[x.module]||0)+1);
    let data=Object.keys(counts).map(k=>({name:k,value:counts[k]}));
    w.setOption({animation:false,tooltip:{trigger:'item',confine:true,appendToBody:false},legend:{bottom:0,textStyle:{color:muted}},series:[{type:'pie',radius:['42%','72%'],center:['50%','44%'],color:[accent,accent2,'#b6e8ca','#ffe28a','#ffb4ce','#b8defe'],data:data.length?data:[{name:'暂无错题',value:1}],label:{color:ink,fontSize:12},itemStyle:{borderColor:'#fff',borderWidth:2,borderRadius:8}}]});
    window.addEventListener('resize',()=>{try{w.resize()}catch(e){}});
  }
  /* 专注每日 - 近7天学习曲线 */
  let fd=init('chartFocusDaily'); if(fd){
    let days=[]; for(let i=6;i>=0;i--){let d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}
    let vals=days.map(d=>(st.focus?.sessions||[]).filter(s=>s.date===d).reduce((a,s)=>a+(+s.minutes||0),0));
    fd.setOption({animation:false,tooltip:{trigger:'axis',confine:true,appendToBody:false,axisPointer:{type:'shadow'}},grid:{left:38,right:14,top:20,bottom:28},xAxis:{type:'category',data:days.map(d=>d.slice(5)),axisLabel:{color:muted},axisLine:{lineStyle:{color:line}}},yAxis:{type:'value',axisLabel:{color:muted,formatter:'{value}m'},splitLine:{lineStyle:{color:line,type:'dashed'}}},series:[{type:'line',smooth:true,areaStyle:{color:'rgba(255,143,183,.16)'},lineStyle:{color:accent,width:3},itemStyle:{color:accent},data:vals}]});
    window.addEventListener('resize',()=>{try{fd.resize()}catch(e){}});
  }
  /* 专注每日 - 本月每日学习时长柱状图 */
  let fmon=init('chartFocusMonthly'); if(fmon){
    let now=new Date(),ym=now.toISOString().slice(0,7),dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    let days=[],vals=[];
    for(let i=1;i<=dim;i++){let ds=ym+'-'+String(i).padStart(2,'0');days.push(i);vals.push((st.focus?.sessions||[]).filter(s=>s.date===ds).reduce((a,s)=>a+(+s.minutes||0),0))}
    fmon.setOption({animation:false,tooltip:{trigger:'axis',confine:true,appendToBody:false,axisPointer:{type:'shadow'}},grid:{left:38,right:14,top:20,bottom:28},xAxis:{type:'category',data:days,axisLabel:{color:muted,interval:Math.ceil(dim/10)-1}},yAxis:{type:'value',axisLabel:{color:muted,formatter:'{value}m'},splitLine:{lineStyle:{color:line,type:'dashed'}}},series:[{type:'bar',barWidth:dim>20?6:10,data:vals,itemStyle:{borderRadius:4,color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:accent},{offset:1,color:accent2}])}}]});
    window.addEventListener('resize',()=>{try{fmon.resize()}catch(e){}});
  }
  /* 专注总计 - 各科目学习总时长 */
  let fm=init('chartFocusModules'); if(fm){
    let counts={};(st.focus?.sessions||[]).forEach(s=>counts[s.module]=(counts[s.module]||0)+(+s.minutes||0));
    let names=Object.keys(counts), vals=names.map(n=>Math.round(counts[n]/60*10)/10);
    fm.setOption({animation:false,tooltip:{trigger:'item',confine:true,appendToBody:false},grid:{left:80,right:20,top:20,bottom:20},xAxis:{type:'value',axisLabel:{color:muted,formatter:'{value}h'},splitLine:{lineStyle:{color:line,type:'dashed'}}},yAxis:{type:'category',data:names.length?names:['暂无'],axisLabel:{color:ink,fontWeight:700}},series:[{type:'bar',barWidth:14,data:vals.length?vals:[0],itemStyle:{borderRadius:8,color:accent2},label:{show:true,position:'right',formatter:'{c}h',color:muted}}]});
    window.addEventListener('resize',()=>{try{fm.resize()}catch(e){}});
  }
  /* 专注总计 - 月度学习总时长趋势 */
  let fmt=init('chartFocusMonthlyTrend'); if(fmt){
    let months=[]; for(let i=5;i>=0;i--){let d=new Date();d.setMonth(d.getMonth()-i);months.push(d.toISOString().slice(0,7))}
    let vals=months.map(ym=>Math.round((st.focus?.sessions||[]).filter(s=>s.date.slice(0,7)===ym).reduce((a,s)=>a+(+s.minutes||0),0)/60*10)/10);
    fmt.setOption({animation:false,tooltip:{trigger:'axis',confine:true,appendToBody:false,axisPointer:{type:'shadow'}},grid:{left:38,right:14,top:20,bottom:28},xAxis:{type:'category',data:months.map(m=>m.slice(5)+'月'),axisLabel:{color:muted},axisLine:{lineStyle:{color:line}}},yAxis:{type:'value',axisLabel:{color:muted,formatter:'{value}h'},splitLine:{lineStyle:{color:line,type:'dashed'}}},series:[{type:'bar',barWidth:20,data:vals,itemStyle:{borderRadius:8,color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:accent2},{offset:1,color:accent}])},label:{show:true,position:'top',formatter:'{c}h',color:muted,fontSize:11}}]});
    window.addEventListener('resize',()=>{try{fmt.resize()}catch(e){}});
  }
};
})();
