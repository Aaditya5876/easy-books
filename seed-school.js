// EasyBooks School Seed Script
// Run: node seed-school.js [admin_email] [admin_password]
// Default credentials match SUPER_ADMIN in backend/.env
// Make sure backend is running on http://localhost:3000
//
// Creates 4 SCHOOL-type companies, each with 10 classes / 100 students and a
// full spread of demo data (fees, hostel, transport, exams, attendance,
// timetable, homework, notices, events, library) so the school-management
// UI (gated on Company.businessType === 'SCHOOL') has something to show.

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL    = process.argv[2] || 'geoinfosys.np@gmail.com';
const ADMIN_PASSWORD = process.argv[3] || 'Test@123';

let cookies = '';
let passed = 0;
let failed = 0;

// ─── HTTP helpers (same pattern as seed.js) ───────────────────────────────────

function extractCookies(res) {
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') || '').split(/,(?=[^ ])/);
  return raw.map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

// Backend's global ThrottlerModule allows 200 req/min per IP — pace requests to stay well
// under that, and back off on 429 in case dev-server activity elsewhere eats into the window.
const REQUEST_DELAY_MS = 350;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function request(method, path, body, auth = true, attempt = 0) {
  await sleep(REQUEST_DELAY_MS);
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && cookies) headers['Cookie'] = cookies;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const newCookies = extractCookies(res);
  if (newCookies) cookies = newCookies;
  const data = await res.json().catch(() => ({}));
  if (res.status === 429 && attempt < 5) {
    const retryAfterSec = Number(res.headers.get('retry-after')) || 10;
    await sleep(retryAfterSec * 1000);
    return request(method, path, body, auth, attempt + 1);
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const post  = (path, body, auth = true) => request('POST', path, body, auth);
const patch = (path, body, auth = true) => request('PATCH', path, body, auth);
const get   = (path, auth = true) => request('GET', path, undefined, auth);

function arr(data) {
  return Array.isArray(data) ? data : (data?.data || data?.items || []);
}

async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${label}`);
    passed++;
    return result;
  } catch (err) {
    console.log(`  ❌ ${label}: ${err.message}`);
    failed++;
    return null;
  }
}

// ─── Demo data generators ──────────────────────────────────────────────────────

const MALE_NAMES   = ['Aayush', 'Bishal', 'Sujan', 'Prakash', 'Nabin', 'Rajesh', 'Kiran', 'Suman', 'Anish', 'Bikash', 'Deepak', 'Rohit', 'Sandip', 'Nischal', 'Ujjwal', 'Yogesh', 'Sagar', 'Manish', 'Prabin', 'Ramesh'];
const FEMALE_NAMES = ['Sunita', 'Anjali', 'Priya', 'Sabina', 'Sarita', 'Manisha', 'Kabita', 'Rita', 'Sristi', 'Puja', 'Bina', 'Nisha', 'Rekha', 'Sarika', 'Anisha', 'Sunayana', 'Kalpana', 'Anita', 'Shristi', 'Roshani'];
const LAST_NAMES    = ['Sharma', 'Shrestha', 'Gurung', 'Tamang', 'Rai', 'Magar', 'Thapa', 'Basnet', 'Karki', 'Bhattarai', 'Adhikari', 'Poudel', 'Khadka', 'Lama', 'Chettri', 'Joshi', 'Pandey', 'Regmi', 'Neupane', 'Bhandari'];
const SUBJECTS_DEF  = [
  { name: 'Mathematics',    code: 'MATH' },
  { name: 'English',        code: 'ENG' },
  { name: 'Science',        code: 'SCI' },
  { name: 'Nepali',         code: 'NEP' },
  { name: 'Social Studies', code: 'SOC' },
];

function pick(arrList) { return arrList[Math.floor(Math.random() * arrList.length)]; }
function pad2(n) { return String(n).padStart(2, '0'); }

function marksToGrade(marks) {
  if (marks >= 90) return 'A+';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B+';
  if (marks >= 60) return 'B';
  if (marks >= 50) return 'C+';
  return 'C';
}

function buildStudentRows() {
  const rows = [];
  for (let grade = 1; grade <= 5; grade++) {
    for (const section of ['A', 'B']) {
      for (let i = 1; i <= 10; i++) {
        const isMale = Math.random() < 0.5;
        const first = isMale ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
        const last = pick(LAST_NAMES);
        const birthYear = 2026 - (5 + grade);
        rows.push({
          name: `${first} ${last}`,
          rollNumber: `${grade}${section}-${pad2(i)}`,
          class: `Grade ${grade}`,
          section,
          gender: isMale ? 'Male' : 'Female',
          guardianName: `${pick(isMale ? FEMALE_NAMES : MALE_NAMES)} ${last}`,
          guardianPhone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
          guardianEmail: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
          address: pick(['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Butwal', 'Biratnagar']),
          dateOfBirth: `${birthYear}-${pad2(1 + Math.floor(Math.random() * 12))}-${pad2(1 + Math.floor(Math.random() * 27))}`,
        });
      }
    }
  }
  return rows;
}

// ─── Per-school seeding ────────────────────────────────────────────────────────

const SCHOOLS = [
  { name: 'Everest Academy',                address: 'Baneshwor, Kathmandu', phone: '9851000001', email: 'info@everestacademy.edu.np',  panVat: '600100001' },
  { name: 'Mount Annapurna English School', address: 'Lakeside, Pokhara',    phone: '9851000002', email: 'info@annapurnaschool.edu.np', panVat: '600100002' },
  { name: 'Himalayan Public School',        address: 'Adarsha Nagar, Biratnagar', phone: '9851000003', email: 'info@himalayanpublic.edu.np', panVat: '600100003' },
  { name: 'Gandaki Secondary School',       address: 'Traffic Chowk, Butwal', phone: '9851000004', email: 'info@gandakischool.edu.np',   panVat: '600100004' },
];

async function seedSchool(def) {
  console.log(`\n🏫 ${def.name}`);

  const company = await run(`Create company: ${def.name}`, () => post('/api/v1/companies', { ...def, businessType: 'SCHOOL' }));
  if (!company?.id) return;
  const companyId = company.id;

  // ── Employees ──
  await run('Bulk import employees', () => post('/api/v1/bulk/employees', {
    companyId,
    rows: [
      { name: `${pick(MALE_NAMES)} ${pick(LAST_NAMES)}`, employeeId: 'TCH-001', designation: 'Teacher',    department: 'Academics', basicSalary: 25000, dateOfJoining: '2023-04-01' },
      { name: `${pick(FEMALE_NAMES)} ${pick(LAST_NAMES)}`, employeeId: 'TCH-002', designation: 'Teacher',   department: 'Academics', basicSalary: 24000, dateOfJoining: '2023-06-01' },
      { name: `${pick(FEMALE_NAMES)} ${pick(LAST_NAMES)}`, employeeId: 'LIB-001', designation: 'Librarian', department: 'Library',   basicSalary: 18000, dateOfJoining: '2024-01-15' },
      { name: `${pick(MALE_NAMES)} ${pick(LAST_NAMES)}`, employeeId: 'ACC-001', designation: 'Accountant',  department: 'Finance',   basicSalary: 26000, dateOfJoining: '2023-02-01' },
    ],
  }));

  // ── Fee heads ──
  await run('Create default fee heads', () => post('/api/v1/school/fee-heads/defaults', { companyId }));
  const feeHeads = arr(await run('Fetch fee heads', () => get(`/api/v1/school/fee-heads?companyId=${companyId}`)) || []);
  const tuitionHead = feeHeads.find(h => /tuition/i.test(h.name));
  const computerHead = feeHeads.find(h => /computer/i.test(h.name));

  // ── Students + classes (bulk import auto-creates the 10 classes) ──
  await run('Bulk import 100 students (auto-creates 10 classes)', () => post('/api/v1/bulk/students', { companyId, rows: buildStudentRows() }));

  const classes = arr(await run('Fetch classes', () => get(`/api/v1/school/classes?companyId=${companyId}`)) || []);
  const classIds = classes.map(c => c.id);

  let allStudents = [];
  for (const cls of classes) {
    const res = await run(`Fetch students: ${cls.name} ${cls.section || ''}`.trim(), () => get(`/api/v1/school/students?companyId=${companyId}&classId=${cls.id}&pageSize=50`));
    allStudents.push(...arr(res || []).map(s => ({ ...s, classId: cls.id, className: cls.name })));
  }

  // ── Subjects (linked to every class) ──
  const subjects = [];
  for (const s of SUBJECTS_DEF) {
    const subj = await run(`Subject: ${s.name}`, () => post('/api/v1/school/subjects', { companyId, name: s.name, code: s.code, classIds }));
    if (subj?.id) subjects.push(subj);
  }
  const mathSubject = subjects.find(s => s.name === 'Mathematics');
  const engSubject = subjects.find(s => s.name === 'English');

  // ── Fee structures (Tuition + Computer, monthly, per class) ──
  for (const cls of classes) {
    const gradeMatch = /\d+/.exec(cls.name);
    const grade = gradeMatch ? parseInt(gradeMatch[0], 10) : 1;
    if (tuitionHead) {
      await run(`Fee structure: Tuition — ${cls.name} ${cls.section || ''}`, () => post('/api/v1/school/fee-structures', {
        companyId, classId: cls.id, feeHeadId: tuitionHead.id, name: 'Tuition Fee', amount: 2000 + grade * 300, frequency: 'MONTHLY',
      }));
    }
    if (computerHead) {
      await run(`Fee structure: Computer — ${cls.name} ${cls.section || ''}`, () => post('/api/v1/school/fee-structures', {
        companyId, classId: cls.id, feeHeadId: computerHead.id, name: 'Computer Fee', amount: 300, frequency: 'MONTHLY',
      }));
    }
  }

  // ── Fee package (present for browsing, not assigned) ──
  if (tuitionHead && computerHead) {
    await run('Fee package: Standard Package', () => post('/api/v1/school/fee-packages', {
      companyId, name: 'Standard Package', price: 3000, feeHeadIds: [tuitionHead.id, computerHead.id],
    }));
  }

  // ── Hostel ──
  const hostelRooms = [];
  for (let i = 1; i <= 4; i++) {
    const room = await run(`Hostel room: A-${100 + i}`, () => post('/api/v1/school/hostel/rooms', {
      companyId, roomNumber: `A-${100 + i}`, floor: String(1 + (i % 2)), capacity: 4, monthlyFee: 3000, facilities: 'Bed, Wardrobe, Attached Bathroom',
    }));
    if (room?.id) hostelRooms.push(room);
  }
  const hostelStudents = allStudents.slice(0, 12);
  for (let i = 0; i < hostelStudents.length; i++) {
    const room = hostelRooms[i % hostelRooms.length];
    if (!room) continue;
    await run(`Hostel allocation: ${hostelStudents[i].name}`, () => post('/api/v1/school/hostel/allocations', {
      companyId, roomId: room.id, studentId: hostelStudents[i].id, startDate: '2025-04-14',
    }));
  }

  // ── Transport ──
  const routes = [];
  const routeDefs = [
    { routeName: 'Route 1 - City Center', driverName: 'Hari Bahadur Thapa', vehicleNumber: 'BA 1 KHA 1234' },
    { routeName: 'Route 2 - Ring Road',   driverName: 'Krishna Bahadur Rai', vehicleNumber: 'BA 1 KHA 5678' },
    { routeName: 'Route 3 - Suburb',      driverName: 'Gopal Prasad Sharma', vehicleNumber: 'BA 1 KHA 9012' },
  ];
  for (const r of routeDefs) {
    const route = await run(`Transport route: ${r.routeName}`, () => post('/api/v1/school/transport/routes', { companyId, ...r, monthlyFee: 1500 }));
    if (route?.id) routes.push(route);
  }
  const transportStudents = allStudents.slice(12, 37);
  for (let i = 0; i < transportStudents.length; i++) {
    const route = routes[i % routes.length];
    if (!route) continue;
    await run(`Transport assignment: ${transportStudents[i].name}`, () => post('/api/v1/school/transport/assignments', {
      companyId, routeId: route.id, studentId: transportStudents[i].id, pickupStop: `Stop ${1 + (i % 5)}`,
    }));
  }

  // ── Scholarships ──
  const scholarshipStudents = allStudents.slice(37, 45);
  for (const st of scholarshipStudents) {
    await run(`Scholarship: ${st.name}`, () => post(`/api/v1/school/students/${st.id}/scholarships?companyId=${companyId}`, {
      name: 'Merit Scholarship', type: 'PERCENT', value: 15,
    }));
  }

  // ── Billing run (2 months) ──
  await run('Billing run: 2082-Falgun', () => post('/api/v1/school/billing-run', { companyId, month: '2082-Falgun', dueDate: '2026-03-10' }));
  await run('Billing run: 2082-Chaitra', () => post('/api/v1/school/billing-run', { companyId, month: '2082-Chaitra', dueDate: '2026-04-10' }));

  // ── Payments (settle most of the older month, leave the newer mostly pending) ──
  const invoices = arr(await run('Fetch invoices', () => get(`/api/v1/school/fee-invoices?companyId=${companyId}&pageSize=250`)) || []);
  const falgunInvoices = invoices.filter(i => i.month === '2082-Falgun');
  for (const inv of falgunInvoices) {
    const full = Math.random() < 0.75;
    const amount = full ? inv.totalAmount : Math.round(inv.totalAmount * 0.5);
    if (amount > 0) {
      await run(`Payment: ${inv.month} invoice (${full ? 'full' : 'partial'})`, () => patch(`/api/v1/school/fee-invoices/${inv.id}/payment?companyId=${companyId}`, {
        amount, method: pick(['CASH', 'CASH', 'ESEWA', 'KHALTI']),
      }));
    }
  }
  const chaitraInvoices = invoices.filter(i => i.month === '2082-Chaitra');
  for (const inv of chaitraInvoices.slice(0, Math.floor(chaitraInvoices.length * 0.2))) {
    await run(`Payment: ${inv.month} invoice (partial)`, () => patch(`/api/v1/school/fee-invoices/${inv.id}/payment?companyId=${companyId}`, {
      amount: Math.round(inv.totalAmount * 0.5), method: 'CASH',
    }));
  }

  // ── Attendance (3 recent dates, per class) ──
  const attendanceDates = ['2026-07-14', '2026-07-15', '2026-07-16'];
  for (const cls of classes) {
    const classStudents = allStudents.filter(s => s.classId === cls.id);
    for (const date of attendanceDates) {
      const entries = classStudents.map(s => {
        const roll = Math.random();
        const status = roll < 0.85 ? 'PRESENT' : roll < 0.93 ? 'ABSENT' : roll < 0.97 ? 'LATE' : 'EXCUSED';
        return { studentId: s.id, status };
      });
      await run(`Attendance: ${cls.name} ${cls.section || ''} — ${date}`.trim(), () => post('/api/v1/school/attendance', { companyId, classId: cls.id, date, entries }));
    }
  }

  // ── Exams ──
  const exam = await run('Exam: First Terminal Examination', () => post('/api/v1/school/exams', { companyId, name: 'First Terminal Examination', examDate: '2026-07-20' }));
  for (const cls of classes) {
    await run(`Exam schedule: ${cls.name} ${cls.section || ''}`.trim(), () => post('/api/v1/school/exam-schedules/bulk', {
      companyId, classId: cls.id, examName: 'First Terminal Examination',
      rows: [
        { subjectId: mathSubject?.id, examDate: '2026-07-20', startTime: '10:00', endTime: '12:00', roomNumber: cls.name },
        { subjectId: engSubject?.id,  examDate: '2026-07-21', startTime: '10:00', endTime: '12:00', roomNumber: cls.name },
      ],
    }));
  }
  if (exam?.id) {
    // Sample rather than all 100 students — enough to populate report cards without
    // ballooning request count under the pacing needed to respect the global rate limit.
    for (const st of allStudents.slice(0, 40)) {
      for (const subj of [mathSubject, engSubject]) {
        if (!subj) continue;
        const marks = 40 + Math.floor(Math.random() * 56);
        await run(`Exam result: ${st.name} — ${subj.name}`, () => post('/api/v1/school/exam-results', {
          companyId, studentId: st.id, subjectId: subj.id, examId: exam.id, marksObtained: marks, totalMarks: 100, grade: marksToGrade(marks),
        }));
      }
    }
  }

  // ── Timetable (Monday, periods 1-4) ──
  for (const cls of classes) {
    for (let period = 1; period <= 4; period++) {
      const subj = subjects[(period - 1) % subjects.length];
      const startHour = 9 + (period - 1);
      await run(`Timetable: ${cls.name} ${cls.section || ''} — period ${period}`.trim(), () => post('/api/v1/school/timetable', {
        companyId, classId: cls.id, subjectId: subj?.id, dayOfWeek: 1, periodNumber: period,
        startTime: `${pad2(startHour)}:00`, endTime: `${pad2(startHour)}:45`, roomNumber: cls.name,
      }));
    }
  }

  // ── Homework + study materials ──
  for (const cls of classes) {
    await run(`Homework: ${cls.name} ${cls.section || ''} — Math`.trim(), () => post('/api/v1/school/homework', {
      companyId, classId: cls.id, subjectId: mathSubject?.id, title: 'Chapter 3 exercises', description: 'Complete odd-numbered problems.', dueDate: '2026-07-25',
    }));
    await run(`Homework: ${cls.name} ${cls.section || ''} — English`.trim(), () => post('/api/v1/school/homework', {
      companyId, classId: cls.id, subjectId: engSubject?.id, title: 'Essay writing', description: 'Write a 200-word essay on "My School".', dueDate: '2026-07-27',
    }));
    await run(`Study material: ${cls.name} ${cls.section || ''}`.trim(), () => post('/api/v1/school/study-materials', {
      companyId, title: `${cls.name} Notes`, fileUrl: 'https://example.com/notes.pdf', fileType: 'pdf', classId: cls.id, description: 'Reference notes for the term.',
    }));
  }

  // ── Notices + events ──
  const notices = [
    { title: 'Winter Break Notice',      content: 'School will remain closed from Poush 15 to Magh 1 for winter break.', targetAudience: 'ALL' },
    { title: 'Parent-Teacher Meeting',   content: 'PTM scheduled for all grades next Saturday.',                        targetAudience: 'PARENTS' },
    { title: 'Exam Routine Published',   content: 'First Terminal exam routine has been published on the notice board.', targetAudience: 'STUDENTS' },
    { title: 'Staff Meeting',            content: 'Monthly staff meeting on Friday at 3 PM.',                          targetAudience: 'TEACHERS' },
  ];
  for (const n of notices) await run(`Notice: ${n.title}`, () => post('/api/v1/school/notices', { companyId, ...n, isPublished: true }));

  const events = [
    { title: 'Annual Sports Day',       startDate: '2026-11-10', eventType: 'SPORTS' },
    { title: 'Annual Cultural Program', startDate: '2026-12-05', eventType: 'CULTURAL' },
    { title: 'Republic Day Holiday',    startDate: '2026-08-19', eventType: 'HOLIDAY' },
  ];
  for (const e of events) await run(`Event: ${e.title}`, () => post('/api/v1/school/events', { companyId, ...e, description: e.title }));

  // ── Library ──
  await run('Bulk import library books', () => post('/api/v1/bulk/books', {
    companyId,
    rows: [
      { title: 'A Brief History of Time',   author: 'Stephen Hawking',    category: 'Science',  totalCopies: 5 },
      { title: 'Wings of Fire',             author: 'A.P.J. Abdul Kalam', category: 'Biography', totalCopies: 4 },
      { title: 'Muna Madan',                author: 'Laxmi Prasad Devkota', category: 'Literature', totalCopies: 6 },
      { title: 'The Alchemist',             author: 'Paulo Coelho',       category: 'Fiction',   totalCopies: 3 },
      { title: 'Nepal: A Historical Study', author: 'D.R. Regmi',         category: 'History',   totalCopies: 3 },
      { title: 'Basic Mathematics',         author: 'R.D. Sharma',        category: 'Textbook',  totalCopies: 8 },
      { title: 'English Grammar in Use',    author: 'Raymond Murphy',     category: 'Textbook',  totalCopies: 8 },
      { title: 'Panchatantra Tales',        author: 'Vishnu Sharma',      category: 'Children',  totalCopies: 5 },
    ],
  }));
  const books = arr(await run('Fetch library books', () => get(`/api/v1/school/library/books?companyId=${companyId}`)) || []);
  const libraryStudents = allStudents.slice(45, 55);
  for (let i = 0; i < libraryStudents.length && books.length; i++) {
    const book = books[i % books.length];
    await run(`Library issue: ${libraryStudents[i].name} — ${book.title}`, () => post('/api/v1/school/library/issues', {
      companyId, bookId: book.id, studentId: libraryStudents[i].id, dueDate: '2026-08-15',
    }));
  }

  console.log(`\n📌 ${def.name} ID: ${companyId} (${classes.length} classes, ${allStudents.length} students)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🏫 EasyBooks School Seed Script');
  console.log('===============================');

  console.log('\n🔐 Auth');
  await run(`Login as ${ADMIN_EMAIL}`, async () => {
    await post('/api/v1/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, false);
    if (!cookies) throw new Error('No cookies set — login failed');
  });
  if (!cookies) {
    console.log('\n❌ Cannot continue without auth. Is the backend running?');
    process.exit(1);
  }

  try {
    for (const def of SCHOOLS) {
      await seedSchool(def);
    }
  } catch (err) {
    console.error('\n💥 Fatal error:', err.message);
  }

  console.log('\n===============================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total:  ${passed + failed}`);
  console.log('===============================\n');
}

main();
