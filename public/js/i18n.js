// Language support (English / Kiswahili).
//  - In HTML:  <h1 data-i18n="some.key">  fills the text;  data-i18n-ph = placeholder,
//              data-i18n-aria = aria-label,  data-i18n-title = title.
//  - In JS:    t('some.key', { name: 'Amina' })  returns the text in the chosen language.
// To add a language or fix a translation, edit the DICT object below.

const DICT = {
  en: {
    'lang.label': 'Language',

    // ---- Front page ----
    'nav.services': 'Departments', 'nav.doctors': 'Our doctors', 'nav.how': 'How it works', 'nav.signin': 'Sign in',
    'menu.patient': 'Patient portal', 'menu.patient.d': 'Book visits and see your records',
    'menu.doctor': 'Doctor portal', 'menu.doctor.d': 'Your queue, records and hours',
    'menu.owner': 'Owner portal', 'menu.owner.d': 'Revenue, pharmacy and performance',
    'hero.eyebrow': 'Private hospital care',
    'hero.title': 'Healthcare that feels personal, run with precision.',
    'hero.sub': 'Book a doctor in minutes, follow your treatment, and let the hospital team work from one secure, always up-to-date system.',
    'hero.cta1': 'Book as a patient', 'hero.cta2': 'Staff sign in',
    'stats.doctors': 'Doctors', 'stats.depts': 'Departments', 'stats.rating': 'Average patient rating',
    'portals.title': 'Choose how you want to sign in', 'portals.sub': 'Each role has its own secure space.',
    'card.patient.t': "I'm a patient", 'card.patient.d': 'Book appointments, see your prescriptions and rate your doctor.',
    'card.patient.b': 'Patient sign in', 'card.patient.n': 'New here? Create an account',
    'card.doctor.t': "I'm a doctor", 'card.doctor.d': 'Run your queue, write medical records and set your working hours.',
    'card.doctor.b': 'Doctor sign in',
    'card.owner.t': "I'm the owner", 'card.owner.d': 'Follow revenue, pharmacy stock and your top-rated doctors.',
    'card.owner.b': 'Owner sign in',
    'cat.emergency': 'Emergency and critical care', 'cat.specialist': 'Specialist clinics', 'cat.surgical': 'Surgery', 'cat.diagnostic': 'Diagnostics and support',
    'tag.walkin': 'Walk-in, open 24 hours', 'tag.referral': 'By doctor referral',
    'svc.title': 'Our departments', 'svc.sub': 'Specialist care under one roof.', 'svc.doc1': '1 doctor', 'svc.docN': '{n} doctors', 'review.one': '1 review',
    'docs.title': 'Meet our top-rated doctors', 'docs.title.alt': 'Meet our doctors', 'docs.sub.alt': 'Specialists across our clinics.', 'docs.sub': 'Ranked by real patient feedback.', 'docs.empty': 'Our doctors will appear here soon.',
    'docs.book': 'Book a visit',
    'how.title': 'How it works',
    'how.1.t': 'Create your account', 'how.1.d': 'Register in a minute and confirm your details.',
    'how.2.t': 'Pick a doctor and a time', 'how.2.d': 'See open slots and book instantly.',
    'how.3.t': 'Get care, then rate it', 'how.3.d': 'Your records and prescriptions stay in your portal.',
    'foot.emergency': 'Emergency? Call 999 / 112 or go to the nearest emergency room.',
    'foot.staff': 'Staff', 'foot.rights': 'Hospital Management System',

    // ---- Separate sign-in pages ----
    'back.home': 'Back to home', 'switch.label': 'Not you? Use another portal:', 'login.sub': 'Enter your details to continue.',
    'portal.patient.eyebrow': 'Patient portal', 'portal.patient.hero': 'Your health, within easy reach.',
    'portal.patient.sub': 'Book visits, follow your prescriptions and tell us how we did.',
    'portal.patient.title': 'Patient sign in',
    'portal.patient.p1': 'Book a doctor in minutes', 'portal.patient.p2': 'See your records and prescriptions', 'portal.patient.p3': 'Rate your visit and help us improve',
    'portal.doctor.eyebrow': 'Doctor portal', 'portal.doctor.hero': 'Your day, organised.',
    'portal.doctor.sub': 'See your queue, write records and manage your working hours.',
    'portal.doctor.title': 'Doctor sign in',
    'portal.doctor.p1': "Today's queue at a glance", 'portal.doctor.p2': 'Medical records and prescriptions', 'portal.doctor.p3': 'Set your hours and days off',
    'portal.owner.eyebrow': 'Owner portal', 'portal.owner.hero': 'The whole hospital at a glance.',
    'portal.owner.sub': 'Revenue, pharmacy stock and staff performance, live.',
    'portal.owner.title': 'Owner sign in',
    'portal.owner.p1': 'Daily, weekly and monthly revenue', 'portal.owner.p2': 'Low-stock and expiry alerts', 'portal.owner.p3': 'Doctor of the period awards',

    // ---- Dashboard greetings ----
    'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
    'hero.p.sub': 'What would you like to do today?',
    'hero.d.sub': "Here is your queue and schedule for today.",
    'hero.o.sub': 'Here is how the hospital is doing.',
    'nav.logout': 'Log out',

    // ---- Login / registration ----
    'auth.tag': 'Private clinic suite',
    'auth.hero': 'Care, coordination and clarity in one place.',
    'pt.patients': 'Patients', 'pt.patients.d': 'Book visits, view prescriptions and rate your doctor.',
    'pt.doctors': 'Doctors', 'pt.doctors.d': "Run the day's queue, keep records and set working hours.",
    'pt.owners': 'Owners', 'pt.owners.d': 'Follow revenue, pharmacy stock and top-rated doctors live.',
    'auth.foot': 'Protected by role-based access. Every account sees only what its role allows.',
    'welcome.title': 'Welcome back', 'welcome.sub': 'Sign in to open your dashboard.',
    'create.title': 'Create your account', 'create.sub': 'Patients can register here to book visits online.',
    'review.title': 'Please confirm your details', 'review.sub': 'Check that everything is correct. These details are used on your medical records.',
    'tab.login': 'Sign in', 'tab.register': 'New patient',
    'f.email': 'E-mail address', 'f.password': 'Password', 'f.show': 'Show', 'f.hide': 'Hide',
    'f.name': 'Full name', 'f.dob': 'Date of birth', 'f.gender': 'Gender', 'f.nosay': 'Prefer not to say',
    'f.female': 'Female', 'f.male': 'Male', 'f.phone': 'Phone', 'f.passhint': '(at least 8 characters)',
    'f.notprovided': 'Not provided', 'f.hidden': 'Hidden for your safety',
    'ph.email': 'you@example.com',
    'btn.signin': 'Sign in', 'btn.review': 'Review my details', 'btn.edit': 'Edit details',
    'btn.confirm': 'Confirm and create account',
    'chk.confirm': 'I confirm that the details above are correct.',
    'auth.staffnote': 'Doctors and owners: your account is created by the hospital administrator.',
    'err.fillrequired': 'Please fill in your name, a valid e-mail and a password of at least 8 characters.',

    // ---- Patient portal ----
    'brand.patient': 'Hospital Management · Patient',
    'tab.find': 'Find a doctor', 'tab.appts': 'My appointments', 'tab.history': 'History and prescriptions',
    'dept.label': 'Department', 'dept.all': 'All departments',
    'book.btn': 'Book appointment', 'no.reviews': 'No reviews yet', 'reviews': '{n} reviews',
    'hours.none': 'No hours set', 'nodoc': 'No doctors in this department yet.',
    'book.with': 'Book with {name}', 'book.date': 'Choose a date', 'book.time': 'Choose a time',
    'book.reason': 'What is the visit for? (optional)', 'btn.cancel': 'Cancel',
    'btn.bookconfirm': 'Confirm booking', 'slots.full': 'All times are taken on this date.',
    'toast.booked': 'Appointment booked.',
    'th.date': 'Date', 'th.time': 'Time', 'th.doctor': 'Doctor', 'th.status': 'Status',
    'q.next': 'You are next', 'q.ahead': '{n} ahead of you today',
    'btn.rate': 'Rate this visit', 'thanks.fb': 'Thanks for your feedback',
    'empty.appts': 'No appointments yet. Find a doctor to book your first visit.',
    'confirm.cancel': 'Cancel this appointment?', 'toast.cancelled': 'Appointment cancelled.',
    'status.booked': 'Booked', 'status.checked_in': 'Checked in', 'status.completed': 'Completed',
    'status.cancelled': 'Cancelled', 'status.no_show': 'No-show',
    'fb.title': 'Rate your visit with {name}', 'fb.q': 'How was your experience?',
    'fb.comments': 'Comments (optional)', 'fb.send': 'Send feedback',
    'fb.pick': 'Please choose a star rating.', 'toast.fb': 'Thank you. Your feedback was sent.',
    'rx.title': 'Prescriptions', 'rx.sub': 'Active ones are still within their course.',
    'visits.title': 'Past visits', 'visits.sub': 'Diagnoses and notes from your doctors.',
    'rx.active': 'Active', 'rx.finished': 'Finished', 'rx.until': 'Until {date}', 'rx.prescribed': 'Prescribed {date}',
    'empty.visits': 'Your visit notes will appear here after your first consultation.',
    'empty.rx': 'No prescriptions yet.', 'days.n': '{n} days',
    'day.0': 'Sunday', 'day.1': 'Monday', 'day.2': 'Tuesday', 'day.3': 'Wednesday', 'day.4': 'Thursday', 'day.5': 'Friday', 'day.6': 'Saturday',
    'dayS.0': 'Sun', 'dayS.1': 'Mon', 'dayS.2': 'Tue', 'dayS.3': 'Wed', 'dayS.4': 'Thu', 'dayS.5': 'Fri', 'dayS.6': 'Sat',

    // ---- Assistant bot ----
    'bot.title': 'Hospital assistant', 'bot.open': 'Ask the assistant', 'bot.close': 'Close',
    'bot.ph': 'Type your question...', 'bot.send': 'Send', 'bot.typing': 'Typing...',
    'bot.note': 'I give hospital information only, not medical advice. In an emergency call 999 / 112.',
    'bot.error': 'Sorry, I could not answer just now. Please try again.',
  },

  sw: {
    'lang.label': 'Lugha',

    // ---- Front page ----
    'nav.services': 'Idara', 'nav.doctors': 'Madaktari wetu', 'nav.how': 'Jinsi inavyofanya kazi', 'nav.signin': 'Ingia',
    'menu.patient': 'Mlango wa mgonjwa', 'menu.patient.d': 'Weka miadi na uone kumbukumbu zako',
    'menu.doctor': 'Mlango wa daktari', 'menu.doctor.d': 'Foleni, kumbukumbu na saa zako',
    'menu.owner': 'Mlango wa mmiliki', 'menu.owner.d': 'Mapato, famasia na utendaji',
    'hero.eyebrow': 'Huduma ya hospitali binafsi',
    'hero.title': 'Huduma ya afya yenye utu, inayosimamiwa kwa umakini.',
    'hero.sub': 'Weka miadi na daktari kwa dakika chache, fuatilia matibabu yako, na acha timu ya hospitali ifanye kazi kwenye mfumo mmoja salama unaosasishwa kila wakati.',
    'hero.cta1': 'Weka miadi kama mgonjwa', 'hero.cta2': 'Wafanyakazi ingia',
    'stats.doctors': 'Madaktari', 'stats.depts': 'Idara', 'stats.rating': 'Wastani wa alama za wagonjwa',
    'portals.title': 'Chagua jinsi unavyotaka kuingia', 'portals.sub': 'Kila nafasi ina sehemu yake salama.',
    'card.patient.t': 'Mimi ni mgonjwa', 'card.patient.d': 'Weka miadi, angalia dawa zako na umtathmini daktari wako.',
    'card.patient.b': 'Mgonjwa: ingia', 'card.patient.n': 'Mpya hapa? Fungua akaunti',
    'card.doctor.t': 'Mimi ni daktari', 'card.doctor.d': 'Simamia foleni yako, andika kumbukumbu za matibabu na weka saa zako za kazi.',
    'card.doctor.b': 'Daktari: ingia',
    'card.owner.t': 'Mimi ni mmiliki', 'card.owner.d': 'Fuatilia mapato, hifadhi ya dawa na madaktari wako bora.',
    'card.owner.b': 'Mmiliki: ingia',
    'cat.emergency': 'Dharura na huduma za wagonjwa mahututi', 'cat.specialist': 'Kliniki za kitaalamu', 'cat.surgical': 'Upasuaji', 'cat.diagnostic': 'Uchunguzi na huduma saidizi',
    'tag.walkin': 'Moja kwa moja, saa 24', 'tag.referral': 'Kwa rufaa ya daktari',
    'svc.title': 'Idara zetu', 'svc.sub': 'Huduma za kitaalamu chini ya paa moja.', 'svc.doc1': 'daktari 1', 'svc.docN': 'madaktari {n}', 'review.one': 'maoni 1',
    'docs.title': 'Kutana na madaktari wetu bora', 'docs.title.alt': 'Kutana na madaktari wetu', 'docs.sub.alt': 'Wataalamu katika kliniki zetu.', 'docs.sub': 'Wamepangwa kwa maoni halisi ya wagonjwa.', 'docs.empty': 'Madaktari wetu wataonekana hapa hivi karibuni.',
    'docs.book': 'Weka ziara',
    'how.title': 'Inavyofanya kazi',
    'how.1.t': 'Fungua akaunti', 'how.1.d': 'Jisajili ndani ya dakika moja na uthibitishe taarifa zako.',
    'how.2.t': 'Chagua daktari na saa', 'how.2.d': 'Angalia saa zilizo wazi na uweke miadi mara moja.',
    'how.3.t': 'Pata huduma, kisha itathmini', 'how.3.d': 'Kumbukumbu na dawa zako hubaki kwenye mlango wako.',
    'foot.emergency': 'Dharura? Piga 999 / 112 au nenda chumba cha dharura kilicho karibu.',
    'foot.staff': 'Wafanyakazi', 'foot.rights': 'Mfumo wa Usimamizi wa Hospitali',

    'back.home': 'Rudi mwanzo', 'switch.label': 'Si wewe? Tumia mlango mwingine:', 'login.sub': 'Weka taarifa zako kuendelea.',
    'portal.patient.eyebrow': 'Mlango wa mgonjwa', 'portal.patient.hero': 'Afya yako, karibu nawe.',
    'portal.patient.sub': 'Weka miadi, fuatilia dawa zako na utuambie tulivyofanya.',
    'portal.patient.title': 'Mgonjwa: ingia',
    'portal.patient.p1': 'Weka miadi na daktari kwa dakika chache', 'portal.patient.p2': 'Angalia kumbukumbu na dawa zako', 'portal.patient.p3': 'Tathmini ziara yako utusaidie kuboresha',
    'portal.doctor.eyebrow': 'Mlango wa daktari', 'portal.doctor.hero': 'Siku yako, imepangwa.',
    'portal.doctor.sub': 'Ona foleni yako, andika kumbukumbu na simamia saa zako za kazi.',
    'portal.doctor.title': 'Daktari: ingia',
    'portal.doctor.p1': 'Foleni ya leo kwa mtazamo mmoja', 'portal.doctor.p2': 'Kumbukumbu za matibabu na dawa', 'portal.doctor.p3': 'Weka saa zako na siku za mapumziko',
    'portal.owner.eyebrow': 'Mlango wa mmiliki', 'portal.owner.hero': 'Hospitali nzima kwa mtazamo mmoja.',
    'portal.owner.sub': 'Mapato, hifadhi ya dawa na utendaji wa wafanyakazi, moja kwa moja.',
    'portal.owner.title': 'Mmiliki: ingia',
    'portal.owner.p1': 'Mapato ya kila siku, wiki na mwezi', 'portal.owner.p2': 'Tahadhari za dawa chache na zinazoisha muda', 'portal.owner.p3': 'Tuzo ya daktari bora wa kipindi',

    'greet.morning': 'Habari za asubuhi', 'greet.afternoon': 'Habari za mchana', 'greet.evening': 'Habari za jioni',
    'hero.p.sub': 'Ungependa kufanya nini leo?',
    'hero.d.sub': 'Hii ni foleni na ratiba yako ya leo.',
    'hero.o.sub': 'Hivi ndivyo hospitali inavyoendelea.',
    'nav.logout': 'Toka',

    'auth.tag': 'Mfumo wa kliniki binafsi',
    'auth.hero': 'Huduma, uratibu na uwazi, vyote mahali pamoja.',
    'pt.patients': 'Wagonjwa', 'pt.patients.d': 'Weka miadi, angalia dawa ulizoandikiwa na utoe maoni kuhusu daktari wako.',
    'pt.doctors': 'Madaktari', 'pt.doctors.d': 'Simamia foleni ya siku, tunza kumbukumbu na weka saa za kazi.',
    'pt.owners': 'Wamiliki', 'pt.owners.d': 'Fuatilia mapato, hifadhi ya dawa na madaktari bora kwa wakati halisi.',
    'auth.foot': 'Inalindwa kwa ufikiaji kulingana na nafasi. Kila akaunti huona tu kile ambacho nafasi yake inaruhusu.',
    'welcome.title': 'Karibu tena', 'welcome.sub': 'Ingia ili kufungua ukurasa wako.',
    'create.title': 'Fungua akaunti yako', 'create.sub': 'Wagonjwa wanaweza kujisajili hapa ili kuweka miadi mtandaoni.',
    'review.title': 'Tafadhali thibitisha taarifa zako', 'review.sub': 'Hakikisha kila kitu ni sahihi. Taarifa hizi zitatumika kwenye kumbukumbu zako za matibabu.',
    'tab.login': 'Ingia', 'tab.register': 'Mgonjwa mpya',
    'f.email': 'Barua pepe', 'f.password': 'Nenosiri', 'f.show': 'Onyesha', 'f.hide': 'Ficha',
    'f.name': 'Majina kamili', 'f.dob': 'Tarehe ya kuzaliwa', 'f.gender': 'Jinsia', 'f.nosay': 'Sipendi kusema',
    'f.female': 'Mwanamke', 'f.male': 'Mwanamume', 'f.phone': 'Simu', 'f.passhint': '(angalau herufi 8)',
    'f.notprovided': 'Haijatolewa', 'f.hidden': 'Imefichwa kwa usalama',
    'ph.email': 'wewe@mfano.com',
    'btn.signin': 'Ingia', 'btn.review': 'Kagua taarifa zangu', 'btn.edit': 'Hariri taarifa',
    'btn.confirm': 'Thibitisha na ufungue akaunti',
    'chk.confirm': 'Nathibitisha kuwa taarifa zilizo hapo juu ni sahihi.',
    'auth.staffnote': 'Madaktari na wamiliki: akaunti yako hufunguliwa na msimamizi wa hospitali.',
    'err.fillrequired': 'Tafadhali jaza jina lako, barua pepe halali na nenosiri lenye angalau herufi 8.',

    'brand.patient': 'Usimamizi wa Hospitali · Mgonjwa',
    'tab.find': 'Tafuta daktari', 'tab.appts': 'Miadi yangu', 'tab.history': 'Historia na dawa',
    'dept.label': 'Idara', 'dept.all': 'Idara zote',
    'book.btn': 'Weka miadi', 'no.reviews': 'Bado hakuna maoni', 'reviews': 'maoni {n}',
    'hours.none': 'Saa hazijawekwa', 'nodoc': 'Bado hakuna madaktari katika idara hii.',
    'book.with': 'Weka miadi na {name}', 'book.date': 'Chagua tarehe', 'book.time': 'Chagua saa',
    'book.reason': 'Ziara ni ya nini? (si lazima)', 'btn.cancel': 'Ghairi',
    'btn.bookconfirm': 'Thibitisha miadi', 'slots.full': 'Saa zote zimejaa katika tarehe hii.',
    'toast.booked': 'Miadi imewekwa.',
    'th.date': 'Tarehe', 'th.time': 'Saa', 'th.doctor': 'Daktari', 'th.status': 'Hali',
    'q.next': 'Wewe ndiye anayefuata', 'q.ahead': 'Watu {n} mbele yako leo',
    'btn.rate': 'Tathmini ziara hii', 'thanks.fb': 'Asante kwa maoni yako',
    'empty.appts': 'Bado huna miadi. Tafuta daktari ili uweke ziara yako ya kwanza.',
    'confirm.cancel': 'Ghairi miadi hii?', 'toast.cancelled': 'Miadi imeghairiwa.',
    'status.booked': 'Imewekwa', 'status.checked_in': 'Amefika', 'status.completed': 'Imekamilika',
    'status.cancelled': 'Imeghairiwa', 'status.no_show': 'Hakufika',
    'fb.title': 'Tathmini ziara yako kwa {name}', 'fb.q': 'Uzoefu wako ulikuwaje?',
    'fb.comments': 'Maoni (si lazima)', 'fb.send': 'Tuma maoni',
    'fb.pick': 'Tafadhali chagua nyota.', 'toast.fb': 'Asante. Maoni yako yametumwa.',
    'rx.title': 'Dawa ulizoandikiwa', 'rx.sub': 'Zinazoendelea bado ziko ndani ya muda wa matumizi.',
    'visits.title': 'Ziara za awali', 'visits.sub': 'Uchunguzi na maelezo kutoka kwa madaktari wako.',
    'rx.active': 'Inaendelea', 'rx.finished': 'Imeisha', 'rx.until': 'Hadi {date}', 'rx.prescribed': 'Iliandikwa {date}',
    'empty.visits': 'Maelezo ya ziara yako yataonekana hapa baada ya ushauri wako wa kwanza.',
    'empty.rx': 'Bado hakuna dawa.', 'days.n': 'siku {n}',
    'day.0': 'Jumapili', 'day.1': 'Jumatatu', 'day.2': 'Jumanne', 'day.3': 'Jumatano', 'day.4': 'Alhamisi', 'day.5': 'Ijumaa', 'day.6': 'Jumamosi',
    'dayS.0': 'Jpl', 'dayS.1': 'Jtt', 'dayS.2': 'Jnn', 'dayS.3': 'Jtn', 'dayS.4': 'Alh', 'dayS.5': 'Ijm', 'dayS.6': 'Jms',

    'bot.title': 'Msaidizi wa hospitali', 'bot.open': 'Uliza msaidizi', 'bot.close': 'Funga',
    'bot.ph': 'Andika swali lako...', 'bot.send': 'Tuma', 'bot.typing': 'Anaandika...',
    'bot.note': 'Natoa taarifa za hospitali tu, si ushauri wa kitabibu. Dharura piga 999 / 112.',
    'bot.error': 'Samahani, sikuweza kujibu sasa hivi. Tafadhali jaribu tena.',
  },
};

// Messages that come from the server (always English) -> Kiswahili.
const SERVER_MESSAGES_SW = {
  'Incorrect e-mail or password.': 'Barua pepe au nenosiri si sahihi.',
  'Too many login attempts. Please try again in 15 minutes.': 'Majaribio mengi ya kuingia. Jaribu tena baada ya dakika 15.',
  'This account has been disabled. Contact the hospital administrator.': 'Akaunti hii imezimwa. Wasiliana na msimamizi wa hospitali.',
  'That e-mail is already registered.': 'Barua pepe hiyo tayari imesajiliwa.',
  'Please enter your full name.': 'Tafadhali weka majina yako kamili.',
  'Please enter a valid e-mail address.': 'Tafadhali weka barua pepe halali.',
  'Password must be at least 8 characters.': 'Nenosiri lazima liwe na angalau herufi 8.',
  'Please enter a valid phone number.': 'Tafadhali weka nambari halali ya simu.',
  'Please confirm that your details are correct.': 'Tafadhali thibitisha kuwa taarifa zako ni sahihi.',
  'Sorry, that slot was just taken. Please pick another.': 'Samahani, saa hiyo imechukuliwa. Tafadhali chagua nyingine.',
  'That time is not offered by the doctor.': 'Saa hiyo haitolewi na daktari.',
  'Doctor, date and time are required.': 'Daktari, tarehe na saa vinahitajika.',
  'This appointment cannot be cancelled.': 'Miadi hii haiwezi kughairiwa.',
  'The doctor is off on this day.': 'Daktari hayupo siku hii.',
  'The doctor does not work on this day.': 'Daktari hafanyi kazi siku hii.',
  'This date has already passed.': 'Tarehe hii imepita.',
  'Bookings open 60 days ahead.': 'Miadi inaweza kuwekwa hadi siku 60 mbele.',
  'You can only review your own completed visits.': 'Unaweza kutathmini ziara zako zilizokamilika pekee.',
  'You already reviewed this visit.': 'Tayari ulishatathmini ziara hii.',
  'Please choose a rating from 1 to 5.': 'Tafadhali chagua alama kutoka 1 hadi 5.',
  'Too many messages. Please wait a moment.': 'Ujumbe mwingi. Tafadhali subiri kidogo.',
  'Something went wrong on our side. Please try again.': 'Hitilafu imetokea upande wetu. Tafadhali jaribu tena.',
  'Something went wrong.': 'Kuna tatizo lililotokea.',
  'This is a patient account. Please use the Patient sign-in page.': 'Hii ni akaunti ya mgonjwa. Tafadhali tumia ukurasa wa kuingia wa Mgonjwa.',
  'This is a doctor account. Please use the Doctor sign-in page.': 'Hii ni akaunti ya daktari. Tafadhali tumia ukurasa wa kuingia wa Daktari.',
  'This is an owner account. Please use the Owner sign-in page.': 'Hii ni akaunti ya mmiliki. Tafadhali tumia ukurasa wa kuingia wa Mmiliki.',
};

let currentLang = 'en';
try {
  const saved = localStorage.getItem('lang');
  currentLang = saved === 'sw' || saved === 'en' ? saved : (navigator.language || '').toLowerCase().startsWith('sw') ? 'sw' : 'en';
} catch (e) { /* storage blocked: stay with English */ }

const getLang = () => currentLang;
// Doctor / owner pages are English-only for now (<body data-page-i18n="off">).
// The assistant bot still follows the chosen language on those pages.
const pageTranslated = () => !document.body || document.body.dataset.pageI18n !== 'off';
const dateLocale = () => (currentLang === 'sw' && pageTranslated() ? 'sw-KE' : 'en-GB');

function t(key, vars) {
  let s = (DICT[currentLang] && DICT[currentLang][key]) ?? DICT.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const reviewsText = (n) => (n === 1 ? t('review.one') : t('reviews', { n }));
const tr = (msg) => (currentLang === 'sw' && pageTranslated() && SERVER_MESSAGES_SW[msg]) || msg;
const dayName = (n) => t('day.' + (n % 7));
const dayShort = (n) => t('dayS.' + (n % 7));

function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-lang-switch] button').forEach((b) => {
    const on = b.dataset.lang === currentLang;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function setLang(lang) {
  if (lang !== 'en' && lang !== 'sw') return;
  currentLang = lang;
  try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
  applyI18n();
  document.dispatchEvent(new Event('langchange'));
}

// Build every <div data-lang-switch> into an EN | SW toggle.
function buildLangSwitches() {
  document.querySelectorAll('[data-lang-switch]').forEach((box) => {
    if (box.children.length) return;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language / Lugha');
    box.innerHTML = '<button type="button" data-lang="en">EN</button><button type="button" data-lang="sw">SW</button>';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-lang]');
      if (b) setLang(b.dataset.lang);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => { buildLangSwitches(); applyI18n(); });
