// Assistant bot: a free, rule-based helper (no paid AI service needed).
//   1. It reads the visitor's message and looks for keywords (English + Swahili).
//   2. It answers using LIVE data from the database where useful
//      (departments, doctors, fees, the patient's own next appointment...).
//   3. It never gives medical advice. Emergencies get a clear "go to hospital now" reply.
// To teach it something new, add an entry to the `intents` list below.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');

const router = express.Router();
const limiter = rateLimit({
  windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many messages. Please wait a moment.' },
});

const L = (en, sw) => ({ en, sw });
const money = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 });
const niceDate = (iso, lang) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Lower-case, strip punctuation, pad with spaces so " hi " matches whole words.
const norm = (s) => ' ' + String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';

const HOSPITAL = {
  phone: process.env.HOSPITAL_PHONE || '',
  address: process.env.HOSPITAL_ADDRESS || '',
  hours: process.env.HOSPITAL_HOURS || '',
};

// Words that map a question to a department
const DEPT_WORDS = [
  { words: ['cardio', 'heart', 'moyo'], like: '%Cardio%' },
  { words: ['paed', 'pedia', 'child', 'kids', 'watoto', 'mtoto'], like: '%Paed%' },
  { words: ['derm', 'skin', 'ngozi'], like: '%Derm%' },
  { words: ['ortho', 'bone', 'joint', 'mifupa'], like: '%Ortho%' },
  { words: ['gyn', 'obstet', 'pregnan', 'maternity', 'uzazi', 'mjamzito'], like: '%Gynae%' },
  { words: ['general medicine', 'family', 'jumla'], like: 'General Medicine%' },
  { words: ['neuro', 'brain', 'ubongo'], like: '%Neuro%' },
  { words: ['oncolog', 'cancer', 'saratani'], like: '%Oncolog%' },
  { words: [' ent ', 'ear ', 'nose', 'throat', 'sikio', 'koo'], like: '%ENT%' },
  { words: ['eye', 'ophthal', 'macho', 'jicho'], like: '%Ophthal%' },
  { words: ['dental', 'dentist', 'tooth', 'teeth', 'meno', 'jino'], like: '%Dental%' },
  { words: ['psych', 'mental', 'depress', 'akili'], like: '%Psychiatr%' },
  { words: ['urolog', 'kidney', 'bladder', 'figo'], like: '%Urolog%' },
  { words: ['gastro', 'stomach', 'bowel', 'tumbo'], like: '%Gastro%' },
  { words: ['diabet', 'thyroid', 'endocrin', 'sukari'], like: '%Endocrin%' },
  { words: ['lung', 'chest', 'asthma', 'pulmon', 'pumu'], like: '%Pulmon%' },
  { words: ['surgery', 'surgeon', 'upasuaji'], like: '%Surgery%' },
  { words: ['physio', 'rehab', 'therapy'], like: '%Physical Therapy%' },
  { words: ['nutrition', 'diet', 'lishe'], like: '%Nutrition%' },
];

const suggestionsFor = (user, lang) => {
  if (user && user.role === 'patient') {
    return lang === 'sw'
      ? ['Miadi yangu ijayo', 'Dawa zangu', 'Nitaghairije miadi?', 'Madaktari bora']
      : ['My next appointment', 'My prescriptions', 'How do I cancel?', 'Best rated doctors'];
  }
  if (user && user.role === 'doctor') {
    return lang === 'sw' ? ['Foleni yangu leo', 'Nitaweka saa za kazi vipi?'] : ['My queue today', 'How do I set my working hours?'];
  }
  if (user && user.role === 'admin') {
    return lang === 'sw' ? ['Mapato ya leo', 'Dawa zinazokaribia kuisha'] : ['Revenue today', 'Which medicines are low?'];
  }
  return lang === 'sw'
    ? ['Nitaweka miadi vipi?', 'Mna idara gani?', 'Ada ya ushauri ni kiasi gani?', 'Nitajisajili vipi?']
    : ['How do I book an appointment?', 'Which departments do you have?', 'How much is a consultation?', 'How do I register?'];
};

// ---------------------------------------------------------------------
// Intents are checked in order; the first whose keywords appear wins.
// `only` = silently skip unless the user has that role.
// `login` = if matched but the user is not that role, ask them to sign in.
// ---------------------------------------------------------------------
const intents = [
  {
    name: 'selfharm',
    kw: ['suicid', 'kill myself', 'self harm', 'end my life', 'kujiua', 'kujidhuru'],
    run: async () => L(
      "I'm really sorry you are going through this. You do not have to face it alone. Please go to the nearest emergency room or call 999 / 112 right now, or tell someone you trust to stay with you.",
      'Pole sana kwa unachopitia. Hauko peke yako. Tafadhali nenda kwenye chumba cha dharura kilicho karibu au piga 999 / 112 sasa hivi, au mwambie mtu unayemwamini akae nawe.'),
  },
  {
    name: 'emergency',
    kw: ['emergency', 'chest pain', 'cannot breathe', "can't breathe", 'cant breathe', 'bleeding heavily', 'unconscious', 'overdose', 'stroke', 'heart attack', 'seizure', 'dharura', 'maumivu makali ya kifua', 'siwezi kupumua', 'kutokwa na damu nyingi', 'amepoteza fahamu', 'kiharusi', 'degedege'],
    run: async () => L(
      'This could be an emergency. Please go to the nearest emergency room now or call 999 / 112 for an ambulance. Do not wait for an appointment. I am only an information assistant and cannot treat you.' + (HOSPITAL.phone ? ` Hospital line: ${HOSPITAL.phone}.` : ''),
      'Hii inaweza kuwa dharura. Tafadhali nenda kwenye chumba cha dharura kilicho karibu sasa hivi au piga 999 / 112 kuomba gari la wagonjwa. Usisubiri miadi. Mimi ni msaidizi wa taarifa tu na siwezi kukutibu.' + (HOSPITAL.phone ? ` Simu ya hospitali: ${HOSPITAL.phone}.` : '')),
  },
  {
    name: 'myappt', login: 'patient',
    kw: ['my appointment', 'my next appointment', 'next appointment', 'upcoming appointment', 'my booking', 'miadi yangu', 'miadi ijayo', 'miadi yangu ijayo'],
    run: async (ctx) => {
      if (!ctx.isRole('patient')) return L('Please sign in as a patient and I can show your next appointment.', 'Tafadhali ingia kama mgonjwa nikuonyeshe miadi yako ijayo.');
      const { rows } = await query(
        `SELECT a.appointment_date AS date, to_char(a.start_time,'HH24:MI') AS time, u.full_name AS doctor
         FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id JOIN users u ON u.id = d.user_id
         WHERE p.user_id = $1 AND a.status IN ('booked','checked_in')
           AND (a.appointment_date > CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.start_time >= LOCALTIME))
         ORDER BY a.appointment_date, a.start_time LIMIT 1`, [ctx.user.id]);
      if (!rows.length) return L('You have no upcoming appointments. Open "Find a doctor" to book one.', 'Huna miadi inayokuja. Fungua "Tafuta daktari" ili kuweka miadi.');
      const a = rows[0];
      return L(`Your next appointment is with ${a.doctor} on ${niceDate(a.date, 'en')} at ${a.time}.`,
        `Miadi yako ijayo ni na ${a.doctor} tarehe ${niceDate(a.date, 'sw')} saa ${a.time}.`);
    },
  },
  {
    name: 'myrx', login: 'patient',
    kw: ['my prescription', 'my medicine', 'my medication', 'dawa zangu', 'dawa nilizoandikiwa'],
    run: async (ctx) => {
      if (!ctx.isRole('patient')) return L('Please sign in as a patient and I can tell you about your prescriptions.', 'Tafadhali ingia kama mgonjwa nikueleze kuhusu dawa zako.');
      const { rows } = await query(
        `SELECT COUNT(*) AS n FROM prescriptions p JOIN patients pt ON pt.id = p.patient_id
         WHERE pt.user_id = $1 AND p.created_at::date + p.duration_days >= CURRENT_DATE`, [ctx.user.id]);
      const n = rows[0].n;
      return n
        ? L(`You have ${n} active prescription${n > 1 ? 's' : ''}. See the dose and end date under "History and prescriptions".`, `Una dawa ${n} zinazoendelea. Angalia kipimo na tarehe ya mwisho chini ya "Historia na dawa".`)
        : L('You have no active prescriptions right now.', 'Huna dawa zinazoendelea kwa sasa.');
    },
  },
  {
    name: 'docqueue', only: ['doctor'],
    kw: ['my queue', 'queue today', 'patients today', 'foleni yangu', 'foleni'],
    run: async (ctx) => {
      const { rows } = await query(
        `SELECT COUNT(*) FILTER (WHERE a.status IN ('booked','checked_in')) AS waiting,
                COUNT(*) FILTER (WHERE a.status = 'completed') AS done
         FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         WHERE d.user_id = $1 AND a.appointment_date = CURRENT_DATE`, [ctx.user.id]);
      const { waiting, done } = rows[0];
      return L(`Today you have ${waiting} patient(s) waiting and ${done} completed. Open "Today's queue" to start a consultation.`,
        `Leo una wagonjwa ${waiting} wanaosubiri na ${done} waliokamilika. Fungua "Foleni ya leo" kuanza ushauri.`);
    },
  },
  {
    name: 'adminrev', only: ['admin'],
    kw: ['revenue', 'income', 'sales', 'mapato'],
    run: async () => {
      const { rows } = await query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE paid_at::date = CURRENT_DATE),0) AS today,
                COALESCE(SUM(amount) FILTER (WHERE date_trunc('month', paid_at) = date_trunc('month', now())),0) AS month FROM payments`);
      return L(`Revenue today is ${money(rows[0].today)} and this month is ${money(rows[0].month)}. See the Overview tab for charts.`,
        `Mapato ya leo ni ${money(rows[0].today)} na mwezi huu ni ${money(rows[0].month)}. Angalia kichupo cha Muhtasari kwa michoro.`);
    },
  },
  {
    name: 'adminstock', only: ['admin'],
    kw: ['low stock', 'running out', 'medicines low', 'which medicines', 'expiring', 'dawa zinazokaribia', 'dawa chache'],
    run: async () => {
      const { rows } = await query(`SELECT name FROM medicines WHERE stock_qty <= reorder_level ORDER BY stock_qty LIMIT 6`);
      return rows.length
        ? L(`Low on stock: ${rows.map((r) => r.name).join(', ')}. Open the Pharmacy tab to restock.`, `Zinakaribia kuisha: ${rows.map((r) => r.name).join(', ')}. Fungua kichupo cha Famasia kuongeza.`)
        : L('No medicines are below their reorder level.', 'Hakuna dawa iliyo chini ya kiwango cha kuagiza upya.');
    },
  },
  {
    name: 'toprated',
    kw: ['best doctor', 'top doctor', 'top rated', 'best rated', 'highest rated', 'madaktari bora', 'daktari bora'],
    run: async () => {
      const { rows } = await query(
        `SELECT u.full_name, ROUND(AVG(f.rating)::numeric,1) AS avg, COUNT(*) AS n
         FROM feedback f JOIN doctors d ON d.id = f.doctor_id JOIN users u ON u.id = d.user_id AND u.is_active
         GROUP BY u.full_name HAVING COUNT(*) >= 3 ORDER BY AVG(f.rating) DESC, COUNT(*) DESC LIMIT 3`);
      if (!rows.length) return L('There are not enough patient reviews yet to rank doctors.', 'Bado hakuna maoni ya kutosha ya wagonjwa kuwapanga madaktari.');
      const en = rows.map((r) => `${r.full_name} (${r.avg}/5 from ${r.n} reviews)`).join('; ');
      const sw = rows.map((r) => `${r.full_name} (${r.avg}/5 kutoka maoni ${r.n})`).join('; ');
      return L(`Top rated doctors by patient reviews: ${en}.`, `Madaktari wenye alama za juu kutokana na maoni ya wagonjwa: ${sw}.`);
    },
  },
  {
    name: 'medical',
    kw: ['symptom', 'diagnos', 'headache', 'fever', 'pain', 'cough', 'rash', 'vomit', 'what is wrong', 'do i have', 'should i take', 'dalili', 'homa', 'maumivu', 'kikohozi', 'kutapika', 'nina ugonjwa'],
    run: async () => L(
      'I cannot give medical advice or diagnose. A doctor needs to examine you. You can book a consultation under "Find a doctor". If it feels urgent or severe, go to the emergency room or call 999 / 112.',
      'Siwezi kutoa ushauri wa kitabibu wala kugundua ugonjwa. Daktari anahitaji kukuchunguza. Unaweza kuweka miadi chini ya "Tafuta daktari". Ikiwa ni ya dharura au kali, nenda chumba cha dharura au piga 999 / 112.'),
  },
  {
    name: 'cancel',
    kw: ['cancel', 'reschedule', 'postpone', 'change my appointment', 'ghairi', 'kubadilisha miadi', 'kuahirisha'],
    run: async () => L(
      'To cancel: sign in, open "My appointments" and press Cancel next to the booking. To change the time, cancel it and book a new slot. Cancelling frees the slot for other patients.',
      'Kughairi: ingia, fungua "Miadi yangu" na bonyeza Ghairi kando ya miadi. Kubadilisha saa, ghairi kisha weka miadi mpya. Kughairi huwafungulia wagonjwa wengine nafasi.'),
  },
  {
    name: 'howbook',
    kw: ['book', 'appointment', 'schedule', 'reserve', 'weka miadi', 'miadi', 'kuonana na daktari', 'kumuona daktari'],
    run: async () => L(
      'To book: 1) Sign in (or register as a new patient). 2) Open "Find a doctor" and pick a department. 3) Press "Book appointment" on a doctor. 4) Choose a date and an open time, then confirm. You can see it under "My appointments".',
      'Kuweka miadi: 1) Ingia (au jisajili kama mgonjwa mpya). 2) Fungua "Tafuta daktari" na uchague idara. 3) Bonyeza "Weka miadi" kwa daktari. 4) Chagua tarehe na saa iliyo wazi, kisha thibitisha. Utaiona chini ya "Miadi yangu".'),
  },
  {
    name: 'register',
    kw: ['register', 'sign up', 'create account', 'new account', 'new patient', 'jisajili', 'fungua akaunti', 'akaunti mpya', 'mgonjwa mpya'],
    run: async () => L(
      'New patients: on the sign-in page choose "New patient", fill in your details and press "Review my details". Check everything, tick the confirmation box and press "Confirm and create account". Doctors and owners get their accounts from the hospital administrator.',
      'Wagonjwa wapya: kwenye ukurasa wa kuingia chagua "Mgonjwa mpya", jaza taarifa zako na bonyeza "Kagua taarifa zangu". Hakikisha kila kitu, weka alama ya uthibitisho kisha bonyeza "Thibitisha na ufungue akaunti". Madaktari na wamiliki hupewa akaunti na msimamizi wa hospitali.'),
  },
  {
    name: 'password',
    kw: ['password', 'forgot', 'reset', 'locked out', 'nenosiri', 'nimesahau'],
    run: async () => L(
      'If you cannot sign in, check your e-mail and password (use Show to see what you typed). If you forgot your password, please ask the hospital reception or administrator to help you reset it.',
      'Ikiwa huwezi kuingia, hakikisha barua pepe na nenosiri (tumia Onyesha kuona ulichoandika). Ukisahau nenosiri, tafadhali omba msaada kwa mapokezi ya hospitali au msimamizi.'),
  },
  {
    name: 'departments',
    kw: ['department', 'departments', 'idara', 'services', 'huduma', 'specialties', 'clinics'],
    run: async () => {
      const { rows } = await query(`SELECT name FROM departments WHERE bookable AND category <> 'admin' ORDER BY name`);
      const list = rows.map((r) => r.name).join(', ');
      return L(`You can book these clinics online: ${list}. Emergency, ICU, NICU and HDU are walk-in services open 24 hours (call 999 / 112 in an emergency). Radiology, the laboratory and the pharmacy work on a doctor's referral or prescription.`,
        `Unaweza kuweka miadi mtandaoni kwa kliniki hizi: ${list}. Dharura, ICU, NICU na HDU ni huduma za moja kwa moja saa 24 (dharura piga 999 / 112). Radiolojia, maabara na famasia hufanya kazi kwa rufaa au maagizo ya daktari.`);
    },
  },
  {
    name: 'doctors',
    kw: ['doctor', 'doctors', 'specialist', 'daktari', 'madaktari', 'mtaalamu', ...DEPT_WORDS.flatMap((d) => d.words)],
    run: async (ctx) => {
      const hit = DEPT_WORDS.find((d) => d.words.some((w) => ctx.q.includes(w)));
      const { rows } = await query(
        `SELECT u.full_name, d.specialty, dep.name AS dept FROM doctors d
         JOIN users u ON u.id = d.user_id AND u.is_active JOIN departments dep ON dep.id = d.department_id AND dep.bookable
         WHERE ($1::text IS NULL OR dep.name ILIKE $1) ORDER BY dep.name, u.full_name LIMIT 8`, [hit ? hit.like : null]);
      if (!rows.length) return L('I could not find doctors for that. Open "Find a doctor" to browse everyone.', 'Sikupata madaktari kwa hilo. Fungua "Tafuta daktari" kuona wote.');
      const list = rows.map((r) => `${r.full_name} (${r.specialty})`).join('; ');
      return L(`${list}. Open "Find a doctor" to see their qualifications, working hours and open time slots.`,
        `${list}. Fungua "Tafuta daktari" kuona sifa zao, saa za kazi na saa zilizo wazi.`);
    },
  },
  {
    name: 'fees',
    kw: ['fee', 'cost', 'price', 'how much', 'charge', 'payment', 'pay ', 'bei', 'gharama', 'ada ', 'malipo', 'kiasi gani'],
    run: async () => {
      const { rows } = await query(
        `SELECT MIN(consultation_fee) AS lo, MAX(consultation_fee) AS hi FROM doctors d JOIN users u ON u.id = d.user_id AND u.is_active`);
      const { lo, hi } = rows[0];
      return L(`Consultation fees range from ${money(lo)} to ${money(hi)} depending on the doctor. Each doctor's fee is shown on their card. Medicines are charged separately.`,
        `Ada za ushauri ni kati ya ${money(lo)} na ${money(hi)} kulingana na daktari. Ada ya kila daktari inaonekana kwenye kadi yake. Dawa hutozwa kando.`);
    },
  },
  {
    name: 'prescription',
    kw: ['prescription', 'medicine', 'drug', 'medication', 'dawa'],
    run: async () => L(
      'After a consultation your doctor records your diagnosis and prescriptions. You can see them, and whether they are still active, under "History and prescriptions".',
      'Baada ya ushauri daktari wako huandika uchunguzi na dawa. Unaweza kuziona, na kama bado zinaendelea, chini ya "Historia na dawa".'),
  },
  {
    name: 'feedback',
    kw: ['feedback', 'rate', 'rating', 'review', 'complain', 'maoni', 'tathmini', 'lalamiko'],
    run: async () => L(
      'After a completed visit, open "My appointments" and press "Rate this visit" to give 1 to 5 stars and a comment. Your ratings help the hospital recognise its best doctors.',
      'Baada ya ziara kukamilika, fungua "Miadi yangu" na bonyeza "Tathmini ziara hii" kutoa nyota 1 hadi 5 na maoni. Alama zako husaidia hospitali kuwatambua madaktari bora.'),
  },
  {
    name: 'contact',
    kw: ['contact', 'phone number', 'call you', 'address', 'location', 'where are you', 'anwani', 'wasiliana', 'mahali mlipo', 'nambari ya simu'],
    run: async () => {
      const en = [HOSPITAL.phone && `Phone: ${HOSPITAL.phone}`, HOSPITAL.address && `Address: ${HOSPITAL.address}`].filter(Boolean).join('. ');
      const sw = [HOSPITAL.phone && `Simu: ${HOSPITAL.phone}`, HOSPITAL.address && `Anwani: ${HOSPITAL.address}`].filter(Boolean).join('. ');
      return L(en ? en + '.' : 'Please ask at the hospital reception for our phone number and address.',
        sw ? sw + '.' : 'Tafadhali uliza mapokezi ya hospitali kupata nambari ya simu na anwani yetu.');
    },
  },
  {
    name: 'hours',
    kw: ['opening hours', 'working hours', 'open', 'hours', 'saa za kazi', 'mnafungua', 'mnafunguliwa'],
    run: async () => L(
      (HOSPITAL.hours ? `Hospital hours: ${HOSPITAL.hours}. ` : '') + "Each doctor's own working days and hours are shown on their card under \"Find a doctor\".",
      (HOSPITAL.hours ? `Saa za hospitali: ${HOSPITAL.hours}. ` : '') + 'Siku na saa za kazi za kila daktari zinaonekana kwenye kadi yake chini ya "Tafuta daktari".'),
  },
  {
    name: 'language',
    kw: ['swahili', 'kiswahili', 'english', 'language', 'lugha'],
    run: async () => L('Use the EN / SW buttons to switch between English and Kiswahili at any time.', 'Tumia vitufe vya EN / SW kubadilisha kati ya Kiingereza na Kiswahili wakati wowote.'),
  },
  {
    name: 'privacy',
    kw: ['privacy', 'secure', 'safe', 'confidential', 'faragha', 'usalama', 'siri'],
    run: async () => L(
      'Your records are private. Passwords are stored encrypted, and each account only sees what its role allows. Doctors can open the history only of patients who booked with them.',
      'Kumbukumbu zako ni siri. Manenosiri huhifadhiwa kwa usimbaji fiche, na kila akaunti huona tu kinachoruhusiwa na nafasi yake. Madaktari hufungua historia ya wagonjwa waliowawekea miadi tu.'),
  },
  {
    name: 'thanks',
    kw: ['thank', 'thanks', 'asante', 'shukran'],
    run: async () => L('You are welcome! Ask me anything else about the hospital.', 'Karibu sana! Niulize chochote kingine kuhusu hospitali.'),
  },
  {
    name: 'greeting',
    kw: [' hi ', ' hello ', ' hey ', 'good morning', 'good afternoon', 'good evening', 'habari', 'hujambo', 'mambo', 'salaam', 'shikamoo', 'help', 'msaada'],
    run: async () => L(
      'Hello! I am the hospital assistant. I can help with booking, doctors, departments, fees and using this system. What would you like to know?',
      'Habari! Mimi ni msaidizi wa hospitali. Naweza kusaidia kuhusu kuweka miadi, madaktari, idara, ada na kutumia mfumo huu. Ungependa kujua nini?'),
  },
];

router.post('/ask', limiter, async (req, res) => {
  const lang = req.body.lang === 'sw' ? 'sw' : 'en';
  const text = String(req.body.message || '').slice(0, 300);
  const user = req.session.user || null;
  const q = norm(text);
  const ctx = { q, user, lang, isRole: (r) => !!user && user.role === r };
  const suggestions = suggestionsFor(user, lang);

  const hello = L(
    'Hello! I am the hospital assistant. Ask me about booking, doctors, departments, fees or how to use the system.',
    'Habari! Mimi ni msaidizi wa hospitali. Niulize kuhusu kuweka miadi, madaktari, idara, ada au jinsi ya kutumia mfumo.');
  if (!q.trim()) return res.json({ reply: hello[lang], suggestions });

  for (const it of intents) {
    if (it.only && !(user && it.only.includes(user.role))) continue;
    if (!it.kw.some((k) => q.includes(k))) continue;
    const answer = await it.run(ctx);
    return res.json({ reply: answer[lang], suggestions });
  }
  const fallback = L(
    'I am not sure about that yet. I can help with booking, doctors, departments, fees, prescriptions and using the system. For medical questions please book a consultation.',
    'Sina uhakika kuhusu hilo bado. Naweza kusaidia kuhusu miadi, madaktari, idara, ada, dawa na kutumia mfumo. Kwa maswali ya kitabibu tafadhali weka miadi ya ushauri.');
  res.json({ reply: fallback[lang], suggestions });
});

module.exports = router;
