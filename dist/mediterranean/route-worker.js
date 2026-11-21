'use strict';
importScripts('navigation.js');

let chart;
let navigatorForChart;

onmessage = ({data}) => {
 if(data.chart) {
  chart=data.chart;
  navigatorForChart=new SeaNavigator(chart);
  postMessage({ready:true});
  return;
 }
 const from=chart.ports.find(port=>port.id===data.from);
 const to=chart.ports.find(port=>port.id===data.to);
 const route=from&&to?navigatorForChart.route(from.berth,to.berth):null;
 postMessage({id:data.id,route});
};
