'use strict';
// Playable map registry. The menu cards, the front shell and the loader all read
// from here, so adding a map means adding one entry plus its data files.
globalThis.BALTIC_MAPS=[
 {
  id:'baltic',
  title:'Речь Посполитая',
  subtitle:'Балтийские порты и земли Восточной Европы',
  card:'front-map-baltic',
  folder:'',
  extras:[]
 },
 {
  id:'mediterranean',
  title:'Средиземноморье',
  subtitle:'Морские пути от Иберии до Леванта',
  card:'front-map-med',
  folder:'maps/mediterranean/',
  extras:['mediterranean/navigation.js','maps/mediterranean/scenario.js','maps/mediterranean/andalusia.js']
 }
];
