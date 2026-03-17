/**
 * Seed script: inserts ~80 realistic road segments in Kyiv
 * and computes OSM base quality scores for each.
 *
 * Run: npm run seed
 */
import postgres from 'postgres'
import 'dotenv/config'
import { osmBaseScore } from '../src/scoring/osmScorer.js'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1, transform: postgres.camel })

// ── Kyiv road segments ──────────────────────────────────────────────────────
// Each segment defined as: name, road_type, surface, speed_limit, coordinate pairs [lon, lat]

interface SeedSegment {
  osmWayId: number
  name: string
  roadType: string
  surface: string
  speedLimit: number
  coords: [number, number][]  // [lon, lat]
}

const SEED_SEGMENTS: SeedSegment[] = [
  // ── Central Kyiv ────────────────────────────────────────────────────────
  { osmWayId: 100001, name: 'Хрещатик', roadType: 'primary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5184, 50.4461], [30.5218, 50.4472], [30.5245, 50.4483], [30.5268, 50.4493]] },
  { osmWayId: 100002, name: 'вул. Велика Васильківська', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.5152, 50.4350], [30.5185, 50.4368], [30.5220, 50.4385], [30.5260, 50.4402]] },
  { osmWayId: 100003, name: 'бул. Лесі Українки', roadType: 'secondary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.5399, 50.4376], [30.5420, 50.4390], [30.5438, 50.4405], [30.5455, 50.4418]] },
  { osmWayId: 100004, name: 'вул. Саксаганського', roadType: 'tertiary', surface: 'paving_stones', speedLimit: 40,
    coords: [[30.5035, 50.4340], [30.5060, 50.4350], [30.5085, 50.4360]] },
  { osmWayId: 100005, name: 'вул. Антоновича', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5095, 50.4295], [30.5115, 50.4320], [30.5130, 50.4345], [30.5148, 50.4370]] },

  // ── Maidan area ─────────────────────────────────────────────────────────
  { osmWayId: 100006, name: 'вул. Інститутська', roadType: 'secondary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.5254, 50.4485], [30.5270, 50.4500], [30.5280, 50.4515]] },
  { osmWayId: 100007, name: 'вул. Городецького', roadType: 'tertiary', surface: 'paving_stones', speedLimit: 30,
    coords: [[30.5230, 50.4468], [30.5240, 50.4478], [30.5250, 50.4488]] },

  // ── Obolon district ─────────────────────────────────────────────────────
  { osmWayId: 100008, name: 'Оболонський проспект', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4920, 50.5050], [30.4940, 50.5090], [30.4955, 50.5130], [30.4965, 50.5170]] },
  { osmWayId: 100009, name: 'просп. Героїв Сталінграда', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4870, 50.5180], [30.4920, 50.5195], [30.4970, 50.5208], [30.5020, 50.5215]] },
  { osmWayId: 100010, name: 'вул. Північна (Оболонь)', roadType: 'residential', surface: 'asphalt', speedLimit: 40,
    coords: [[30.4950, 50.5100], [30.4970, 50.5105], [30.4990, 50.5110]] },
  { osmWayId: 100011, name: 'вул. Луговая', roadType: 'residential', surface: 'gravel', speedLimit: 30,
    coords: [[30.4880, 50.5040], [30.4895, 50.5048], [30.4910, 50.5055]] },

  // ── Pechersk district ───────────────────────────────────────────────────
  { osmWayId: 100012, name: 'вул. Лаврська', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5550, 50.4340], [30.5568, 50.4358], [30.5580, 50.4375]] },
  { osmWayId: 100013, name: 'вул. Мазепи', roadType: 'tertiary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5480, 50.4350], [30.5510, 50.4360], [30.5540, 50.4370]] },
  { osmWayId: 100014, name: 'вул. Редутна', roadType: 'residential', surface: 'cobblestone', speedLimit: 30,
    coords: [[30.5590, 50.4310], [30.5600, 50.4320], [30.5608, 50.4328]] },

  // ── Podil district ──────────────────────────────────────────────────────
  { osmWayId: 100015, name: 'вул. Сагайдачного', roadType: 'primary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5185, 50.4580], [30.5210, 50.4592], [30.5240, 50.4602], [30.5270, 50.4610]] },
  { osmWayId: 100016, name: 'вул. Хорива', roadType: 'secondary', surface: 'paving_stones', speedLimit: 40,
    coords: [[30.5095, 50.4630], [30.5120, 50.4638], [30.5145, 50.4645]] },
  { osmWayId: 100017, name: 'Андріївський узвіз', roadType: 'residential', surface: 'cobblestone', speedLimit: 20,
    coords: [[30.5180, 50.4565], [30.5175, 50.4550], [30.5170, 50.4535]] },
  { osmWayId: 100018, name: 'вул. Флорівська', roadType: 'residential', surface: 'paving_stones', speedLimit: 20,
    coords: [[30.5155, 50.4610], [30.5165, 50.4620], [30.5175, 50.4628]] },

  // ── Shevchenkivskyi district ─────────────────────────────────────────────
  { osmWayId: 100019, name: 'бул. Тараса Шевченка', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4945, 50.4440], [30.4980, 50.4455], [30.5015, 50.4468], [30.5050, 50.4480]] },
  { osmWayId: 100020, name: 'вул. Льва Толстого', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5100, 50.4378], [30.5118, 50.4392], [30.5130, 50.4408]] },
  { osmWayId: 100021, name: 'вул. Паньківська', roadType: 'tertiary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.5025, 50.4352], [30.5040, 50.4365], [30.5055, 50.4375]] },

  // ── Darnytsya district ───────────────────────────────────────────────────
  { osmWayId: 100022, name: 'вул. Бориспільська', roadType: 'primary', surface: 'asphalt', speedLimit: 70,
    coords: [[30.6200, 50.4080], [30.6250, 50.4095], [30.6300, 50.4108], [30.6350, 50.4120]] },
  { osmWayId: 100023, name: 'просп. Петра Григоренка', roadType: 'secondary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.6050, 50.4010], [30.6080, 50.4025], [30.6110, 50.4040]] },
  { osmWayId: 100024, name: 'вул. Сортувальна', roadType: 'residential', surface: 'gravel', speedLimit: 30,
    coords: [[30.6150, 50.3960], [30.6170, 50.3970], [30.6190, 50.3980]] },

  // ── Kyiv Ring Road (Велика Кільцева) ─────────────────────────────────────
  { osmWayId: 100025, name: 'Велика Кільцева дорога (північ)', roadType: 'trunk', surface: 'asphalt', speedLimit: 80,
    coords: [[30.3800, 50.5300], [30.4100, 50.5380], [30.4400, 50.5420], [30.4700, 50.5430]] },
  { osmWayId: 100026, name: 'Велика Кільцева дорога (схід)', roadType: 'trunk', surface: 'asphalt', speedLimit: 80,
    coords: [[30.6500, 50.5000], [30.6550, 50.4700], [30.6520, 50.4400], [30.6450, 50.4100]] },
  { osmWayId: 100027, name: 'Велика Кільцева дорога (південь)', roadType: 'trunk', surface: 'asphalt', speedLimit: 80,
    coords: [[30.5500, 50.3550], [30.5200, 50.3480], [30.4900, 50.3450], [30.4600, 50.3480]] },

  // ── Boryspil Highway (M-03) ──────────────────────────────────────────────
  { osmWayId: 100028, name: 'Бориспільське шосе (M-03)', roadType: 'motorway', surface: 'asphalt', speedLimit: 110,
    coords: [[30.5850, 50.4180], [30.6100, 50.4090], [30.6400, 50.3980], [30.6700, 50.3870]] },

  // ── Zhytomyr Highway (M-06) ──────────────────────────────────────────────
  { osmWayId: 100029, name: 'Житомирська траса (M-06)', roadType: 'motorway', surface: 'asphalt', speedLimit: 110,
    coords: [[30.3500, 50.4380], [30.3200, 50.4320], [30.2900, 50.4260], [30.2600, 50.4200]] },

  // ── Obolon – Podil connector ─────────────────────────────────────────────
  { osmWayId: 100030, name: 'Набережне шосе (північ)', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.5010, 50.4750], [30.5020, 50.4830], [30.5025, 50.4920], [30.5030, 50.5000]] },

  // ── Holosiivskyi district ────────────────────────────────────────────────
  { osmWayId: 100031, name: 'просп. Науки', roadType: 'secondary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4950, 50.4090], [30.5000, 50.4100], [30.5050, 50.4108]] },
  { osmWayId: 100032, name: 'вул. Глушкова', roadType: 'secondary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4870, 50.4080], [30.4900, 50.4068], [30.4930, 50.4055]] },
  { osmWayId: 100033, name: 'вул. Лісова (Голосіїв)', roadType: 'tertiary', surface: 'gravel', speedLimit: 30,
    coords: [[30.4750, 50.3950], [30.4770, 50.3965], [30.4790, 50.3980]] },

  // ── Sviatoshyn district ──────────────────────────────────────────────────
  { osmWayId: 100034, name: 'просп. Перемоги', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.3780, 50.4600], [30.3900, 50.4595], [30.4020, 50.4590], [30.4140, 50.4585]] },
  { osmWayId: 100035, name: 'вул. Борщагівська', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.4300, 50.4480], [30.4320, 50.4465], [30.4340, 50.4450], [30.4360, 50.4435]] },

  // ── Solomyanskyi district ─────────────────────────────────────────────────
  { osmWayId: 100036, name: 'просп. Повітрофлотський', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4500, 50.4300], [30.4530, 50.4315], [30.4560, 50.4330]] },
  { osmWayId: 100037, name: 'вул. Авіаційна', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.4480, 50.4370], [30.4500, 50.4380], [30.4520, 50.4390]] },
  { osmWayId: 100038, name: 'вул. Машинобудівна', roadType: 'tertiary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.4550, 50.4260], [30.4570, 50.4270], [30.4590, 50.4280]] },

  // ── Dnipro embankment ────────────────────────────────────────────────────
  { osmWayId: 100039, name: 'Набережне шосе (центр)', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.5350, 50.4480], [30.5360, 50.4420], [30.5368, 50.4360], [30.5372, 50.4300]] },
  { osmWayId: 100040, name: 'Набережно-Хрещатицька вул.', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5240, 50.4568], [30.5270, 50.4580], [30.5300, 50.4590]] },

  // ── Problem roads (low quality) ──────────────────────────────────────────
  { osmWayId: 100041, name: 'вул. Ракетна (ями)', roadType: 'residential', surface: 'asphalt', speedLimit: 30,
    coords: [[30.4820, 50.4870], [30.4840, 50.4878], [30.4858, 50.4884]] },
  { osmWayId: 100042, name: 'вул. Корольова (грунт)', roadType: 'residential', surface: 'dirt', speedLimit: 20,
    coords: [[30.4720, 50.4910], [30.4735, 50.4918], [30.4750, 50.4924]] },
  { osmWayId: 100043, name: 'вул. Польова (бруківка)', roadType: 'service', surface: 'cobblestone', speedLimit: 20,
    coords: [[30.4990, 50.5200], [30.5005, 50.5208], [30.5018, 50.5215]] },
  { osmWayId: 100044, name: 'провул. Озерний (гравій)', roadType: 'track', surface: 'gravel', speedLimit: 20,
    coords: [[30.4850, 50.5250], [30.4862, 50.5260], [30.4875, 50.5268]] },

  // ── Bridges ──────────────────────────────────────────────────────────────
  { osmWayId: 100045, name: 'Міст Патона', roadType: 'trunk', surface: 'asphalt', speedLimit: 60,
    coords: [[30.5410, 50.4280], [30.5450, 50.4270], [30.5490, 50.4260], [30.5530, 50.4250]] },
  { osmWayId: 100046, name: 'Московський міст', roadType: 'trunk', surface: 'asphalt', speedLimit: 80,
    coords: [[30.5680, 50.4650], [30.5700, 50.4640], [30.5720, 50.4628], [30.5740, 50.4615]] },
  { osmWayId: 100047, name: 'Південний міст', roadType: 'motorway', surface: 'asphalt', speedLimit: 80,
    coords: [[30.5500, 50.3950], [30.5520, 50.3940], [30.5540, 50.3928]] },

  // ── Troieshchyna district ────────────────────────────────────────────────
  { osmWayId: 100048, name: 'просп. Матері Тереси', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.6180, 50.5050], [30.6140, 50.5060], [30.6100, 50.5068], [30.6060, 50.5075]] },
  { osmWayId: 100049, name: 'вул. Братиславська', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.6050, 50.5020], [30.6070, 50.5035], [30.6090, 50.5048]] },
  { osmWayId: 100050, name: 'вул. Драйзера', roadType: 'tertiary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.6120, 50.4980], [30.6140, 50.4992], [30.6158, 50.5003]] },

  // ── Desnyanskyi district ─────────────────────────────────────────────────
  { osmWayId: 100051, name: 'вул. Милославська', roadType: 'residential', surface: 'asphalt', speedLimit: 40,
    coords: [[30.5720, 50.5150], [30.5740, 50.5158], [30.5758, 50.5165]] },
  { osmWayId: 100052, name: 'просп. Маяковського', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.5900, 50.5050], [30.5880, 50.5065], [30.5858, 50.5080], [30.5835, 50.5092]] },

  // ── Akademmistechko ──────────────────────────────────────────────────────
  { osmWayId: 100053, name: 'просп. Академіка Палладіна', roadType: 'secondary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.3600, 50.4720], [30.3640, 50.4710], [30.3680, 50.4700]] },
  { osmWayId: 100054, name: 'вул. Академіка Заболотного', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.4250, 50.3820], [30.4280, 50.3835], [30.4310, 50.3850]] },

  // ── Kyiv suburb roads (varied quality) ───────────────────────────────────
  { osmWayId: 100055, name: 'Харківське шосе', roadType: 'primary', surface: 'asphalt', speedLimit: 80,
    coords: [[30.6380, 50.4250], [30.6500, 50.4200], [30.6620, 50.4150], [30.6740, 50.4100]] },
  { osmWayId: 100056, name: 'Одеська траса (M-05)', roadType: 'motorway', surface: 'asphalt', speedLimit: 110,
    coords: [[30.4700, 50.3500], [30.4600, 50.3380], [30.4500, 50.3260], [30.4400, 50.3140]] },
  { osmWayId: 100057, name: 'Варшавське шосе', roadType: 'trunk', surface: 'asphalt', speedLimit: 90,
    coords: [[30.4200, 50.4050], [30.4100, 50.3950], [30.4000, 50.3850]] },

  // ── Inner city varied surfaces ────────────────────────────────────────────
  { osmWayId: 100058, name: 'вул. Пушкінська', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5175, 50.4420], [30.5185, 50.4435], [30.5194, 50.4450]] },
  { osmWayId: 100059, name: 'вул. Ярославів Вал', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5115, 50.4490], [30.5135, 50.4505], [30.5155, 50.4520]] },
  { osmWayId: 100060, name: 'вул. Рейтарська', roadType: 'tertiary', surface: 'paving_stones', speedLimit: 30,
    coords: [[30.5145, 50.4490], [30.5155, 50.4503], [30.5162, 50.4515]] },

  // ── Service roads, industrial ─────────────────────────────────────────────
  { osmWayId: 100061, name: 'вул. Набережно-Луговая', roadType: 'service', surface: 'asphalt', speedLimit: 30,
    coords: [[30.5480, 50.4560], [30.5495, 50.4548], [30.5510, 50.4535]] },
  { osmWayId: 100062, name: 'проїзд Бакинський', roadType: 'service', surface: 'unpaved', speedLimit: 20,
    coords: [[30.5380, 50.4680], [30.5390, 50.4690], [30.5400, 50.4698]] },

  // ── Irpin / Bucha direction (NW) ──────────────────────────────────────────
  { osmWayId: 100063, name: 'Брестське шосе (M-07)', roadType: 'motorway', surface: 'asphalt', speedLimit: 110,
    coords: [[30.3200, 50.5050], [30.2900, 50.5100], [30.2600, 50.5150], [30.2300, 50.5200]] },
  { osmWayId: 100064, name: 'вул. Польова (Бориспіль)', roadType: 'residential', surface: 'dirt', speedLimit: 20,
    coords: [[30.9100, 50.3600], [30.9120, 50.3612], [30.9140, 50.3622]] },

  // ── Additional central streets ────────────────────────────────────────────
  { osmWayId: 100065, name: 'вул. Михайлівська', roadType: 'tertiary', surface: 'paving_stones', speedLimit: 30,
    coords: [[30.5200, 50.4515], [30.5210, 50.4525], [30.5218, 50.4535]] },
  { osmWayId: 100066, name: 'вул. Прорізна', roadType: 'secondary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.5195, 50.4478], [30.5208, 50.4490], [30.5218, 50.4502]] },
  { osmWayId: 100067, name: 'вул. Банкова', roadType: 'secondary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.5268, 50.4508], [30.5278, 50.4518], [30.5285, 50.4528]] },
  { osmWayId: 100068, name: 'вул. Лютеранська', roadType: 'tertiary', surface: 'paving_stones', speedLimit: 30,
    coords: [[30.5250, 50.4460], [30.5258, 50.4472], [30.5265, 50.4485]] },

  // ── Teremky district ──────────────────────────────────────────────────────
  { osmWayId: 100069, name: 'просп. Академіка Глушкова', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4780, 50.4028], [30.4810, 50.4018], [30.4840, 50.4008]] },
  { osmWayId: 100070, name: 'вул. Теремківська', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.4860, 50.3980], [30.4880, 50.3992], [30.4900, 50.4003]] },

  // ── Vyshhorod direction ───────────────────────────────────────────────────
  { osmWayId: 100071, name: 'Вишгородська вулиця', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.4950, 50.5300], [30.4960, 50.5350], [30.4965, 50.5400], [30.4968, 50.5450]] },
  { osmWayId: 100072, name: 'Вишгородське шосе', roadType: 'trunk', surface: 'asphalt', speedLimit: 80,
    coords: [[30.4850, 50.5500], [30.4840, 50.5600], [30.4830, 50.5700], [30.4820, 50.5800]] },

  // ── Night market / industrial area ─────────────────────────────────────────
  { osmWayId: 100073, name: 'вул. Складська', roadType: 'service', surface: 'asphalt', speedLimit: 20,
    coords: [[30.5600, 50.4400], [30.5615, 50.4410], [30.5630, 50.4418]] },
  { osmWayId: 100074, name: 'проїзд промисловий', roadType: 'track', surface: 'gravel', speedLimit: 20,
    coords: [[30.5800, 50.4200], [30.5815, 50.4208], [30.5830, 50.4215]] },

  // ── Pozniaky / Osokorky ───────────────────────────────────────────────────
  { osmWayId: 100075, name: 'просп. Бажана', roadType: 'primary', surface: 'asphalt', speedLimit: 60,
    coords: [[30.6250, 50.3960], [30.6220, 50.3975], [30.6190, 50.3988], [30.6160, 50.3998]] },
  { osmWayId: 100076, name: 'вул. Ревуцького', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.6300, 50.4050], [30.6280, 50.4060], [30.6258, 50.4068]] },
  { osmWayId: 100077, name: 'вул. Осокорська', roadType: 'tertiary', surface: 'asphalt', speedLimit: 40,
    coords: [[30.6180, 50.3900], [30.6200, 50.3912], [30.6220, 50.3922]] },

  // ── Historic Kyiv / Pechersk Lavra ─────────────────────────────────────────
  { osmWayId: 100078, name: 'вул. Цитадельна', roadType: 'tertiary', surface: 'asphalt', speedLimit: 30,
    coords: [[30.5580, 50.4318], [30.5595, 50.4328], [30.5608, 50.4338]] },
  { osmWayId: 100079, name: 'вул. Мічуріна', roadType: 'residential', surface: 'asphalt', speedLimit: 30,
    coords: [[30.5490, 50.4290], [30.5505, 50.4300], [30.5520, 50.4308]] },
  { osmWayId: 100080, name: 'вул. Панаса Мирного', roadType: 'secondary', surface: 'asphalt', speedLimit: 50,
    coords: [[30.5385, 50.4345], [30.5400, 50.4358], [30.5415, 50.4370]] },
]

// ── Length calculation helpers ──────────────────────────────────────────────

function toRad(deg: number) { return (deg * Math.PI) / 180 }

/** Haversine distance between two [lon, lat] points in meters */
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function segmentLength(coords: [number, number][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i])
  return total
}

// ── Insert ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${SEED_SEGMENTS.length} road segments...`)

  let inserted = 0
  let skipped = 0

  for (const seg of SEED_SEGMENTS) {
    const lineString = `LINESTRING(${seg.coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`
    const lengthM = segmentLength(seg.coords)
    const baseScore = osmBaseScore({ roadType: seg.roadType, surface: seg.surface })

    // Upsert segment (idempotent)
    const [row] = await sql<{ id: string; created: boolean }>`
      INSERT INTO road_segments (osm_way_id, geom, road_type, surface, name, length_meters, speed_limit)
      VALUES (
        ${seg.osmWayId},
        ST_GeomFromText(${lineString}, 4326),
        ${seg.roadType},
        ${seg.surface},
        ${seg.name},
        ${Math.round(lengthM)},
        ${seg.speedLimit}
      )
      ON CONFLICT (osm_way_id) DO UPDATE
        SET name = EXCLUDED.name,
            length_meters = EXCLUDED.length_meters
      RETURNING id, (xmax = 0) AS created
    `

    if (row.created) {
      // New segment — insert initial quality score
      await sql`
        INSERT INTO quality_scores (segment_id, osm_base_score, dynamic_penalty, acc_penalty, temporal_penalty)
        VALUES (${row.id}, ${baseScore}, 0, 0, 0)
      `
      inserted++
    } else {
      // Existing — update score if it has changed
      await sql`
        UPDATE quality_scores
        SET osm_base_score = ${baseScore}, computed_at = NOW()
        WHERE segment_id = ${row.id}
          AND id = (SELECT id FROM quality_scores WHERE segment_id = ${row.id} ORDER BY computed_at DESC LIMIT 1)
      `
      skipped++
    }
  }

  console.log(`Done. Inserted: ${inserted}, updated: ${skipped}`)
  await sql.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
