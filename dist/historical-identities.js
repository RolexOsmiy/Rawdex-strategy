'use strict';

// Small, original drawings of historical devices. Rows without local arms use the
// contemporary polity's device, and campaign districts inherit their parent.
const HISTORICAL_ARMS={
 'brzeskie kujawskie':['Куявский полуорёл и полулев','gold kujawy:black halfEagle:red'],
 'chełmińskie':['Орёл Королевской Пруссии с мечом','white eagle:black sword:red@43,12,.46'],
 'inowrocławskie':['Куявский полуорёл и полулев','gold kujawy:red halfEagle:black'],
 'kaliskie':['Голова тура на шахматном поле','white check:red bull:black'],
 'krakowskie':['Орёл Краковского воеводства','red eagle:white crown:gold@32,10,.45'],
 'łęczyckie':['Ленчицкий полуорёл и полулев','white pale:red kujawy:red halfEagle:white'],
 'malborskie':['Орёл Королевской Пруссии','white eagle:black sword:gold@44,16,.45'],
 'płockie':['Чёрный плоцкий орёл с литерой P','red eagle:black p:gold@31,27,.55'],
 'podlaskie':['Орёл и Погоня','red eagle:white@18,27,.64 rider:white@45,36,.64'],
 'pomorskie':['Поморский грифон','white griffin:red'],
 'poznańskie':['Орёл Познанского воеводства','red eagle:white'],
 'rawskie':['Равский орёл с литерой R','red eagle:black r:gold@32,27,.58'],
 'sandomierskie':['Сандомирские полосы и звёзды','blue pale:red bands:white@17,31,.72 stars:gold@45,30,.69'],
 'sieradzkie':['Серадзский полуорёл и полулев','gold pale:red kujawy:red halfEagle:white'],
 'ziemia dobrzyńska':['Коронованная голова Добжинской земли','red bust:white crown:gold@32,11,.62'],
 'warmińskie':['Агнец Вармийского княжества-епископства','red lamb:white cross:gold@43,15,.46'],
 'bełskie':['Грифон Белзского воеводства','red griffin:white'],
 'wołyńskie':['Волынский крест','red cross:white'],
 'trockie':['Рыцарь Трокской земли','red knight:white'],
 'mazowieckie':['Белый орёл Мазовии','red eagle:white crown:gold@32,13,.40'],
 'lubelskie':['Олень Люблинского воеводства','red stag:white crown:gold@44,14,.42'],
 'doprackie':['Ключ и меч Дерпта','red key:white@23,29,.74 sword:gold@41,28,.82','city'],
 'Prusy Książęce':['Чёрный орёл герцогской Пруссии','white eagle:black s:gold@32,27,.52 crown:gold@32,10,.38'],
 'bracławskie':['Крест и полумесяц Брацлавского воеводства','red cross:white inescutcheon:blue moon:gold@32,30,.32'],
 'starostwo spiskie':['Шпишская крепость','blue castle:white','city'],
 'brzeskie litewskie':['Погоня Брест-Литовского воеводства','blue rider:white'],
 'wendeńskie':['Грифон Инфлянт','red griffin:white sword:gold@45,24,.59','realm'],
 'kijowskie':['Архангел Киевского воеводства','red angel:white'],
 'Księstwo Siewierskie':['Орёл Северского княжества','blue eagle:gold'],
 'podolskie':['Подольское солнце','white sun:gold'],
 'parnawskie':['Крест и ключ Пернова','blue cross:white@24,19,.48 key:gold@42,36,.72','city'],
 'nowogrodzkie':['Архангел Новогрудка','red angel:white','city'],
 'czernihowskie':['Черниговский двуглавый орёл','white doubleEagle:black cross:gold@32,24,.35'],
 'żmudzkie':['Жмудский медведь','red bear:black ring:white@40,23,.29'],
 'wileńskie':['Погоня Виленского воеводства','red rider:white'],
 'Księstwo Kurlandii i Semigalii':['Лев Курляндии и олень Семигалии','white pale:blue lion:red@17,30,.76 stag:gold@46,31,.69'],
 'smoleńskie':['Архангел на городской печати Смоленска','red angel:white','city'],
 'mścisławskie':['Герб Могилёва',null,'city','ui/mogilev-coat-of-arms.png'],
 'mińskie':['Погоня Минского воеводства','red rider:white'],
 'witebskie':['Погоня Витебского воеводства','red rider:white'],
 'połockie':['Погоня Полоцкого воеводства','white rider:red'],
 'okręg bytowski':['Померанский грифон Бытувской земли','white griffin:red','realm'],
 'okręg lęborski':['Померанский грифон Лемборкской земли','white griffin:red','realm'],
 'ruskie':['Русский лев на скале','blue lion:gold@32,22,.90 hill:silver@32,48,.57'],
 'pinsk':['Лук Пинска','red bow:gold','city'],
 'ovruch':['Ворота Овруча','red gate:white','city'],
 'zytomierz':['Трёхбашенные ворота Житомира','blue castle:white','city'],
 'cherkasy':['Воин с луком Черкасс','blue knight:gold bow:silver@46,33,.55','city'],
 'pereiaslav':['Крест Переяславского знамени','blue cross:gold','realm'],
 'włodzimierz':['Георгий Владимирской городской печати','red rider:white','city'],
 'krzemieniec':['Кременецкая крепость','blue castle:white@32,26,.87 hill:green@32,49,.66','city'],
 'mozyrz':['Мозырский орёл','blue eagle:black inescutcheon:red@32,29,.40','city'],
 lisbon:['Ладья и вороны Лиссабона','gold boat:black@32,35,1.14 bird:black@13,19,.35 bird:black@51,19,.35','city'],
 algarve:['Мотивы герба Алгарве','gold pale:red bust:red@18,29,.66 bust:silver@46,29,.66','realm'],
 sevilla:['Фердинанд III и два епископа на печати Севильи','red knight:gold@32,27,.8 bust:silver@14,37,.46 bust:silver@50,37,.46','city'],
 cordoba:['Коронованный лев старой печати Кордовы','white lion:purple crown:gold@32,11,.52','city'],
 granada:['Гранат Гранадского королевства','white fruit:red'],
 malaga:['Алькасаба на городских гербах Малаги','blue castle:gold@31,27,1 hill:white@32,47,.76','city'],
 murcia:['Короны Мурсии','red crown:gold@18,14,.43 crown:gold@32,14,.43 crown:gold@46,14,.43 crown:gold@18,29,.43 crown:gold@32,29,.43 crown:gold@46,29,.43 crown:gold@32,44,.43','city'],
 valencia:['Королевские полосы Арагона','gold stripes:red crown:gold@32,10,.45','realm'],
 toledo:['Имперский орёл Толедо','gold doubleEagle:black inescutcheon:red'],
 madrid:['Медведь и земляничное дерево Мадрида','white tree:green@38,28,.93 bear:black@22,38,.70','city'],
 zaragoza:['Лев Сарагосы','red lion:gold','city'],
 barcelona:['Крест и арагонские полосы Барселоны','gold barcelona:red','city'],
 toulouse:['Тулузский крест','red occ:gold'],
 provence:['Анжуйская лилия Прованса','blue fleur:gold label:red@32,13,.88'],
 lyon:['Лионский лев и лилии','red chief:blue lion:white@32,36,.87 fleur:gold@16,10,.31 fleur:gold@32,10,.31 fleur:gold@48,10,.31','city'],
 genoa:['Крест Святого Георгия, Генуя','white cross:red'],
 milan:['Висконтийский бисционе','white snake:blue'],
 venice:['Крылатый лев Святого Марка','red wingedLion:gold'],
 florence:['Флорентийская лилия','white fleur:red','city'],
 rome:['Исторические ключи Папского государства','red key:gold@24,29,.90 key:white@40,29,.90 crown:gold@32,11,.44','realm'],
 naples:['Анжуйские лилии Неаполя','blue fleur:gold@17,28,.60 fleur:gold@32,38,.61 fleur:gold@47,28,.60 label:red@32,13,.84','realm'],
 bari:['Бело-красный щит Бари','white pale:red','city'],
 palermo:['Сицилийские орлы и арагонские полосы','gold sicily:red eagle:black@32,24,.70'],
 sardinia:['Четыре мавра Сардинии','white cross:red bust:black@17,16,.43 bust:black@47,16,.43 bust:black@20,43,.43 bust:black@44,43,.43'],
 split:['Diocletianove zidine, печать Сплита','blue gate:white castle:gold@32,29,.55','city'],
 sarajevo:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 belgrade:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 durres:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 sofia:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 thessaloniki:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 athens:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 patras:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 istanbul:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 izmir:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 bursa:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 ankara:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 antalya:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 adana:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 beirut:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 gaza:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 alexandria:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 cairo:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 tobruk:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 benghazi:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 sirte:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 tripoli:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 sfax:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 tunis:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 annaba:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 algiers:['Османское знамя эпохи','green zulfiqar:gold','realm'],
 oran:['Кастильский замок испанского Орана','red castle:gold','realm'],
 tangier:['Португальские кинасы','white quinas:blue','realm'],
 rabat:['Саадидский красный стяг по портоланам','red frame:gold','realm']
};

const HISTORICAL_COMMANDERS={
 crown:['Станислав Жолкевский','Станислав Конецпольский','Владислав Ваза'],
 lithuania:['Ян Кароль Ходкевич','Кшиштоф Радзивилл','Лев Сапега'],
 ruthenia:['Пётр Конашевич-Сагайдачный','Михайло Дорошенко','Олифер Голуб'],
 balticGerman:['Фридрих Кетлер','Вильгельм Кетлер','Якоб Кетлер'],
 prussia:['Георг Вильгельм Бранденбургский','Адам фон Шварценберг','Конрад фон Бургсдорф'],
 livonia:['Ян Кароль Ходкевич','Кшиштоф Радзивилл','Александр Госевский'],
 pomerania:['Богуслав XIV','Франц Померанский','Ульрих Померанский'],
 hungary:['Габриэль Бетлен','Дьёрдь Ракоци','Штефан Бетлен'],
 spain:['Гонсало Фернандес де Кордова','Амброзио Спинола','Педро де Толедо'],
 portugal:['Мануэл де Менезеш','Нуну Алвареш Ботелью','Антониу Телиш де Менезеш'],
 france:['Франсуа де Ледигьер','Анри де Роган','Шарль д’Альбер де Люинь'],
 genoa:['Амброджо Спинола','Карло Спинола','Джованни Франческо Ломеллини'],
 milan:['Педро де Толедо','Гомес Суарес де Фигероа','Джованни Томмазо Бланк'],
 venice:['Джованни де Медичи','Лоренцо Веньер','Пьетро Сагредо'],
 tuscany:['Джованни де Медичи','Козимо II Медичи','Алессандро даль Борро'],
 papal:['Карло Барберини','Таддео Барберини','Асканио Сфорца'],
 ottoman:['Халил-паша Кайсерили','Хафыз Ахмед-паша','Черкес Мехмед-паша'],
 levant:['Фахр ад-Дин Маан','Юсуф Сайфа','Хафыз Ахмед-паша'],
 northAfrica:['Юсуф-дей','Мурад-бей','Халил-паша Кайсерили'],
 algiers:['Али Битчин','Хызыр-паша','Юсуф-реис'],
 morocco:['Зидан ан-Насир','Абд аль-Малик II','Аль-Валид ибн Зидан']
};

const COMMANDER_ORIGINS=[
 ['lithuania','trockie brzeskie_litewskie nowogrodzkie żmudzkie wileńskie smoleńskie mścisławskie mińskie witebskie połockie pinsk mozyrz'],
 ['ruthenia','kijowskie bracławskie czernihowskie cherkasy pereiaslav ovruch zytomierz'],
 ['balticGerman','Księstwo_Kurlandii_i_Semigalii'],
 ['prussia','Prusy_Książęce'],
 ['livonia','doprackie wendeńskie parnawskie'],
 ['pomerania','okręg_bytowski okręg_lęborski'],
 ['hungary','starostwo_spiskie'],
 ['portugal','lisbon algarve tangier'],
 ['spain','sevilla cordoba granada malaga murcia valencia toledo madrid zaragoza barcelona naples bari palermo sardinia oran'],
 ['france','toulouse provence lyon'],
 ['genoa','genoa'],['milan','milan'],['venice','venice split'],['tuscany','florence'],['papal','rome'],
 ['levant','beirut'],['northAfrica','tunis sfax tripoli sirte benghazi tobruk'],['algiers','algiers annaba'],['morocco','rabat'],
 ['ottoman','sarajevo belgrade durres sofia thessaloniki athens patras istanbul izmir bursa ankara antalya adana gaza alexandria cairo']
];
const commanderOriginGroups=new Map(COMMANDER_ORIGINS.flatMap(([group,keys])=>keys.split(' ').map(key=>[key.replaceAll('_',' '),group])));
function historicalRegionKey(region){return region?.key?.replace(/-district-\d+$/,'')}
function historicalCommanderPool(region){
 const group=commanderOriginGroups.get(historicalRegionKey(region))??'crown';
 return HISTORICAL_COMMANDERS[group];
}

const ARMORIAL_COLORS={red:'#a32f3e',white:'#e8e2cc',silver:'#e8e2cc',gold:'#e4b853',
 blue:'#284d7b',green:'#27674d',black:'#292829',purple:'#7b3a73'};

const ARMORIAL_CHARGES={
 eagle:'M32 10l-5 2-2 5 4 6-5 1L10 11l-4 2 3 10-5 1 6 8-4 3 11 5-1 5 9-4 3-6-1 10-6 5h8l3-4 3 4h8l-6-5-1-10 3 6 9 4-1-5 11-5-4-3 6-8-5-1 3-10-4-2-14 13-4-2 2-8-5-4z',
 halfEagle:'M32 10l4 2 2 5-3 6 5 1 14-13 4 2-3 10 5 1-6 8 4 3-11 5 1 5-9-4-3-6 1 10 6 5h-8l-3-4Z',
 doubleEagle:'M32 16l-6-5-6 3 1 5 5 3-5 2L8 12l-3 4 4 9H5l7 8-5 3 12 5-2 5 10-4 3-7-1 11-6 6h8l1-5 2 5h8l-6-6-1-11 3 7 10 4-2-5 12-5-5-3 7-8h-4l4-9-3-4-13 12-5-2 5-3 1-5-6-3-6 5z',
 lion:'M38 8l8 1 6 6-6 3-1 5-7-1 4 6 6 6-1 6-6-1-6-8-2 10 6 4-1 6h-7l-7-7 1-10-5 3-4 12H8l3-7 2-10 8-7-4-6-7 2-3-5 5-3 10 1 5 7 7-6-2-4z M20 31Q2 38 4 23Q0 11 8 7l3 3q-6 2-2 10t9 5z',
 griffin:'M34 9l7-3 7 4 6 6-9 2-2 6 7 4-2 5-8-4-1 9 7 7-1 6h-8l-7-8-8 3-4 6h-8l4-10 8-6-3-8-8 3-5-4 8-7 9 1L5 8l3-3 12 5 8 11 6-4z M17 33Q1 31 5 18l4 3q0 5 11 6z',
 bear:'M9 25Q8 13 26 16l10 3 8-5h6l3 5 6 4-3 6-9-1-4 8-1 10h-8l-2-10-12 1-3 9H9l3-12z',
 wolf:'M8 27L5 17l8 6 18-4 9-5 1-7 5 5 7 3 7 2-1 5-11 1-4 8 6 12h-7l-7-13-11 2-6 11h-7l6-15z',
 stag:'M9 24l22 1 12-12 5 1 1 5 9 3-2 4-8-1-4 9-1 12h-6l-1-12-13 1-8 12H8l5-13-7-6z M46 16l-8-9 2-2 5 5V3h3v7l5-5 2 2-5 10z',
 lamb:'M9 26q3-8 11-7h17l6-7 7 1 4 5-2 6-8 3-3 10-2 8h-5l-2-9H20l-3 9h-5l1-13-6-2z',
 bird:'M9 36l8-10 12-7-6-9 13 7 7-10 4 6 11 4-10 3-5 10-12 5-9 12-3-8z',
 fruit:'M31 12l-8-9 9 3 9-2-7 8v4c18 2 21 33-3 34C7 48 10 20 31 16z',
 tree:'M28 44l2-19-9-5-6 1-6-5 2-9 7-2 7-5 9 4 7-4 9 6 5 7-6 9-9 3-4 19h9v5H20v-5z',
 hill:'M3 48Q11 21 23 33Q33 8 45 31Q55 25 61 48Z',
 castle:'M6 49V25h7V12h6v6h5v-6h7v11h3V9h6v6h5V9h7v16h6v24H39V37a7 7 0 0 0-14 0v12z',
 gate:'M7 49V17h7v7h5v-7h7v7h12v-7h7v7h5v-7h7v32H42V37a10 10 0 0 0-20 0v12z',
 crown:'M12 36l-5-21 13 9 12-14 11 14 14-9-5 21zM13 40h38v5H13z',
 bust:'M22 15l7-6h9l8 8-3 15-5 5v4l14 9H11l15-9v-4l-6-8z',
 cross:'M27 4h10v19h19v10H37v19H27V33H8V23h19z',
 occ:'M32 5l5 11 10-2-2 10 11 5-11 5 2 10-10-2-5 11-5-11-10 2 2-10-11-5 11-5-2-10 10 2zm0 13-4 7-7 4 7 4 4 7 4-7 7-4-7-4z',
 key:'M11 42l25-25a11 11 0 1 1 7 7l-9 9 4 4-5 5-4-4-5 5 3 3-6 6-3-4-3 3zm31-25a5 5 0 1 0 7-7 5 5 0 0 0-7 7z',
 sword:'M45 6l9-2-2 9-25 25 4 4-4 4-5-4-9 9-5-5 9-9-4-5 4-4 4 4z',
 bow:'M13 6Q67 27 14 51l-2-7q39-17 0-31zm2 4 4 36-3 1-4-37z M12 25h41v-5l8 8-8 8v-6H12z',
 rider:'M13 28l8-3 7 4 4-4-4-9 4-4 5 1 5 9 5 3 6-8 6 3-4 13-7 5-2 8h-6l-2-11-11 4-3 10h-6l1-11-7-1-5 8-5-2 4-9z M34 15L45 4l3 3-11 13z',
 knight:'M32 5l7 5-1 9 6 3 3 11-7 3v14h-5l-3-11-3 11h-6V35l-6-2 2-10 6-4-1-9z M44 28l9-21 4 2-8 23z',
 angel:'M32 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12z M27 22l-8-3L5 8l3 15 7 10-3 7 13-5-7 15h28l-8-15 13 5-3-7 7-10 3-15-14 11-8 3z',
 moon:'M47 7A22 22 0 1 0 47 48 22 22 0 0 1 47 7z',
 sun:'M32 3l5 12 10-8-1 13 13-1-8 10 10 6-12 4 5 11-13-3-3 12-6-12-7 12-3-12-13 3 5-11-12-4 10-6-8-10 13 1-1-13 10 8z',
 stars:'M16 7l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z M47 7l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z M32 28l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
 fleur:'M31 3Q18 17 27 31 17 15 8 21 2 26 15 36 12 24 22 28l5 10h-8v5h9l-5 7 9-4 9 4-5-7h9v-5h-8l5-10q10-4 7 8 13-10 7-15-9-6-19 10Q46 17 31 3z',
 boat:'M6 36l7 6h38l7-11-12 4H7zm25-7V6h3v23zm-4-20-14 19h14zm11 3v17h15z M11 46l9 2 10-2 10 2 11-2v3l-11 2-10-2-10 2-9-2z',
 snake:'M31 51q-24-1-19-15 3-8 24-7 9 0 7-5-2-3-14-2-18 2-15-12l6-7 4 4-4 6q1 4 12 2 20-3 22 9 3 12-17 12-20 0-16 6 3 3 15 2z',
 bull:'M7 14l10 6 7-6h16l7 6 10-6-3 13-8 3-4 15-10 5-10-5-4-15-8-3z',
 cannon:'M6 21l37 5 3-5h10v10H44l-11 3-4 10h-5l-1-10-17-2z M34 37a7 7 0 1 0 14 0 7 7 0 0 0-14 0z',
 ring:'M32 9a16 16 0 1 0 0 32 16 16 0 0 0 0-32zm0 5a11 11 0 1 1 0 22 11 11 0 0 1 0-22z',
 inescutcheon:'M25 11h14v16c0 6-4 9-7 11-3-2-7-5-7-11z',
 zulfiqar:'M9 38l6 6 7-7 5 4 4-4-4-5 21-20 11-1-6-8-11 3-21 20-5-5-4 4 4 5z M42 7l14-4 4 4-11 2z',
 banner:'M13 6h4v44h-4z M18 9h35l-5 7 5 7-5 7 5 6H18z',
 frame:'M9 9h46v40H9zm5 5v30h36V14z',
 label:'M7 14h50v5H7z M15 18h8v9h-8z M28 18h8v9h-8z M42 18h8v9h-8z',
 p:'M18 49V6h21l9 8v14l-9 8H27v13zm9-34v12h10l2-3v-6l-2-3z',
 r:'M18 49V6h21l9 8v14l-8 7 9 14H38L29 36h-2v13zm9-34v12h10l2-3v-6l-2-3z',
 s:'M20 7h24l5 5-4 8-7-4H27l-2 5 18 5 6 6-1 12-6 5H18l-5-6 5-7 7 4h13l1-5-20-6-5-6 1-10z'
};
const ARMORIAL_FIELDS={
 check:'M0 0h16v13H0zm32 0h16v13H32zM16 13h16v13H16zm32 0h16v13H48zM0 26h16v13H0zm32 0h16v13H32zM16 39h16v13H16zm32 0h16v13H48z',
 pale:'M32 0h32v60H32z',chief:'M0 0h64v19H0z',
 stripes:'M8 0h6v60H8zm12 0h6v60h-6zm12 0h6v60h-6zm12 0h6v60h-6z',
 barcelona:'M0 0h32v26H0z M6 6v14h20V6z M12 6h7v14h-7z M6 11h20v5H6z M37 0h4v28h-4z M45 0h4v28h-4z M53 0h4v28h-4z M0 26h5v34H0z M9 26h5v34H9z M18 26h5v34h-5z M27 26h5v34h-5z M32 26h32v33H32z M38 33v18h20V33z M45 33h6v18h-6z M38 39h20v5H38z',
 sicily:'M10 0h6l18 60h-6z M24 0h6l18 60h-6z M40 0h6l16 60h-6z',
 kujawy:'M17 13l7-4 8 5-2 7-7 2 6 9-6 5 4 10-9-2-1-9-6 7H6l4-11 10-5-4-6-8-2-4-8 4-3z',
 bands:'M2 13h60v6H2zm0 12h60v6H2zm0 12h60v6H2z',
 quinas:'M25 5h14v12l-7 4-7-4zm-16 15h14v12l-7 4-7-4zm16 0h14v12l-7 4-7-4zm16 0h14v12l-7 4-7-4zm-16 15h14v12l-7 4-7-4z'
};
const historicalShieldCache=new Map();
function regionArms(region){return HISTORICAL_ARMS[historicalRegionKey(region)]}
function historicalShield(region,size=20){
 const arms=regionArms(region);
 if(!arms)return '';
 const [name,recipe,kind,asset]=arms;
 const cacheKey=name+'|'+recipe+'|'+size+'|'+kind;
 if(historicalShieldCache.has(cacheKey))return historicalShieldCache.get(cacheKey);
 const caption=(kind==='realm'?'Знак исторической державы · ':kind==='city'?'Исторический городской знак · ':'Герб · ')+name;
 if(asset){
  const svg=`<svg width="${size}" height="${Math.round(size*61/64)}" viewBox="0 0 64 61" class="historical-shield" role="img" aria-label="${caption}"><title>${caption}</title><image href="${asset}" width="64" height="61"/></svg>`;
  historicalShieldCache.set(cacheKey,svg);
  return svg;
 }
 const [field,...devices]=recipe.split(' ');
 const outline='M2 3h60v27c0 15-13 24-30 29C15 54 2 45 2 30Z';
 const shapes=devices.map(device=>{
  const [spec,placement]=device.split('@');
  const [symbol,tincture]=spec.split(':');
  const [x,y,scale]=placement?placement.split(',').map(Number):[32,29,1];
  const color=ARMORIAL_COLORS[tincture];
  const at=symbol in ARMORIAL_FIELDS&&!placement?'':` transform="translate(${x} ${y}) scale(${scale}) translate(-32 -29)"`;
  const path=ARMORIAL_CHARGES[symbol]||ARMORIAL_FIELDS[symbol];
  const painted=(d,color)=>`<path fill="${color}" fill-rule="evenodd" d="${d}"/>`;
  const charge=symbol==='wingedLion'?painted(ARMORIAL_CHARGES.lion,color)+painted('M34 26L10 10l2 12 7 8 11 3z M42 34h12v10H42z',color):painted(path,color);
  return `<g${at}>${charge}</g>`;
 }).join('');
 const svg=`<svg width="${size}" height="${Math.round(size*61/64)}" viewBox="0 0 64 61" class="historical-shield" role="img" aria-label="${caption}"><title>${caption}</title><path fill="${ARMORIAL_COLORS[field]}" d="${outline}"/><svg x="2" y="3" width="60" height="56" viewBox="0 0 64 60" style="clip-path:path('M0 0H60V27C60 42 47 51 30 56C13 51 0 42 0 27Z')">${shapes}</svg><path fill="none" stroke="#594832" stroke-width="3" d="${outline}"/><path fill="none" stroke="#b49a61" stroke-opacity=".5" stroke-width="1" d="M4 6h56"/></svg>`;
 historicalShieldCache.set(cacheKey,svg);
 return svg;
}
