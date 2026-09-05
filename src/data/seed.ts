/**
 * RAKSHA seed data — realistic demo dataset with timestamps relative to "now",
 * so dashboards, overdue alerts and charts look alive on every fresh start.
 */
import type {
  DB, Facility, User, Patient, Visit, Vitals, Assessment, Consultation, Prescription,
  DiagnosticRecord, Referral, ReferralEvent, FollowUp, Appointment, Teleconsultation,
  EmergencyEvent, AppNotification, AuditLog, Role, RefStatus, Availability,
} from "../lib/types";
import { RULE_VERSION } from "../lib/triage";

const N = Date.now();
const d = (n: number) => N - n * 86400000;
const h = (n: number) => N - n * 3600000;
const mn = (n: number) => N - n * 60000;
const iso = (offsetDays: number) => new Date(N + offsetDays * 86400000).toISOString().slice(0, 10);

const ev = (ts: number, actorId: string, actorName: string, role: Role, from: RefStatus | null, to: RefStatus, facilityId: string, notes?: string): ReferralEvent =>
  ({ id: `rev-${ts}-${to}`, ts, actorId, actorName, role, from, to, facilityId, notes });

const dx = (names: [string, Availability][]): { name: string; status: Availability }[] => names.map(([name, status]) => ({ name, status }));

export function buildSeed(): DB {
  const facilities: Facility[] = [
    {
      id: "F-SC-01", name: "Sub-Centre Kolwadi", type: "SUBCENTRE", village: "Kolwadi", distanceKm: 0, phone: "0241-260001",
      totalBeds: 4, availableBeds: 3, icuBeds: 0, icuAvailable: 0, emergency: false, oxygen: "LIMITED", criticalCare: "UNAVAILABLE",
      diagnostics: dx([["RBS Test", "AVAILABLE"], ["Malaria Kit", "AVAILABLE"], ["Urine Strip", "LIMITED"]]),
      medicines: dx([["Paracetamol 500mg", "AVAILABLE"], ["ORS Sachets", "AVAILABLE"], ["Iron-Folate", "AVAILABLE"], ["Amoxicillin 250mg", "LIMITED"]]),
      specialists: [], workload: "LOW", mapX: 16, mapY: 30,
    },
    {
      id: "F-PHC-01", name: "PHC Demapur", type: "PHC", village: "Demapur", distanceKm: 6, phone: "0241-260002",
      totalBeds: 12, availableBeds: 5, icuBeds: 0, icuAvailable: 0, emergency: true, oxygen: "AVAILABLE", criticalCare: "LIMITED",
      diagnostics: dx([["CBC", "AVAILABLE"], ["RBS Test", "AVAILABLE"], ["Malaria Kit", "AVAILABLE"], ["X-Ray", "UNAVAILABLE"], ["ECG", "LIMITED"]]),
      medicines: dx([["Paracetamol 500mg", "AVAILABLE"], ["ORS Sachets", "AVAILABLE"], ["Amlodipine 5mg", "AVAILABLE"], ["Metformin 500mg", "LIMITED"], ["Insulin (Soluble)", "UNAVAILABLE"], ["Amoxicillin 250mg", "AVAILABLE"], ["Ceftriaxone Inj.", "LIMITED"]]),
      specialists: [], workload: "MODERATE", mapX: 38, mapY: 58,
    },
    {
      id: "F-PHC-02", name: "PHC Ashti", type: "PHC", village: "Ashti", distanceKm: 14, phone: "0241-260003",
      totalBeds: 10, availableBeds: 7, icuBeds: 0, icuAvailable: 0, emergency: true, oxygen: "LIMITED", criticalCare: "UNAVAILABLE",
      diagnostics: dx([["CBC", "LIMITED"], ["RBS Test", "AVAILABLE"], ["X-Ray", "UNAVAILABLE"], ["Ultrasound", "UNAVAILABLE"]]),
      medicines: dx([["Paracetamol 500mg", "AVAILABLE"], ["ORS Sachets", "LIMITED"], ["Metformin 500mg", "AVAILABLE"], ["Iron-Folate", "AVAILABLE"], ["Oxytocin Inj.", "AVAILABLE"]]),
      specialists: [], workload: "LOW", mapX: 28, mapY: 80,
    },
    {
      id: "F-CHC-01", name: "CHC Shirur", type: "CHC", village: "Shirur", distanceKm: 18, phone: "0241-260004",
      totalBeds: 40, availableBeds: 14, icuBeds: 4, icuAvailable: 2, emergency: true, oxygen: "AVAILABLE", criticalCare: "AVAILABLE",
      diagnostics: dx([["CBC", "AVAILABLE"], ["X-Ray", "AVAILABLE"], ["Ultrasound", "AVAILABLE"], ["ECG", "AVAILABLE"], ["RBS Test", "AVAILABLE"]]),
      medicines: dx([["Paracetamol 500mg", "AVAILABLE"], ["Ceftriaxone Inj.", "AVAILABLE"], ["Insulin (Soluble)", "LIMITED"], ["Amlodipine 5mg", "AVAILABLE"], ["Salbutamol Neb.", "AVAILABLE"], ["IV Fluids", "AVAILABLE"]]),
      specialists: [
        { specialty: "General Medicine", name: "Dr. Meera Joshi", available: true },
        { specialty: "Obstetrics & Gynaecology", name: "Dr. S. Naik", available: true },
        { specialty: "Paediatrics", name: "Dr. A. Deshpande", available: false },
      ],
      workload: "HIGH", mapX: 62, mapY: 38,
    },
    {
      id: "F-CHC-02", name: "Rural Hospital Wadgaon", type: "CHC", village: "Wadgaon", distanceKm: 22, phone: "0241-260005",
      totalBeds: 30, availableBeds: 18, icuBeds: 2, icuAvailable: 1, emergency: true, oxygen: "LIMITED", criticalCare: "LIMITED",
      diagnostics: dx([["CBC", "AVAILABLE"], ["X-Ray", "LIMITED"], ["Ultrasound", "AVAILABLE"], ["RBS Test", "AVAILABLE"]]),
      medicines: dx([["Paracetamol 500mg", "AVAILABLE"], ["ORS Sachets", "AVAILABLE"], ["Insulin (Soluble)", "UNAVAILABLE"], ["Methyldopa 250mg", "AVAILABLE"]]),
      specialists: [
        { specialty: "General Medicine", name: "Dr. P. Borkar", available: true },
        { specialty: "Obstetrics & Gynaecology", name: "Dr. R. Hiremath", available: true },
      ],
      workload: "MODERATE", mapX: 56, mapY: 76,
    },
    {
      id: "F-DH-01", name: "District Hospital Demapur", type: "DH", village: "Demapur", distanceKm: 26, phone: "0241-260006",
      totalBeds: 120, availableBeds: 31, icuBeds: 12, icuAvailable: 4, emergency: true, oxygen: "AVAILABLE", criticalCare: "AVAILABLE",
      diagnostics: dx([["CBC", "AVAILABLE"], ["X-Ray", "AVAILABLE"], ["Ultrasound", "AVAILABLE"], ["ECG", "AVAILABLE"], ["2D-Echo", "AVAILABLE"], ["CT Scan", "LIMITED"], ["Pathology Lab", "AVAILABLE"]]),
      medicines: dx([["Paracetamol 500mg", "AVAILABLE"], ["Insulin (Soluble)", "AVAILABLE"], ["Ceftriaxone Inj.", "AVAILABLE"], ["Streptokinase Inj.", "LIMITED"], ["IV Fluids", "AVAILABLE"], ["Amlodipine 5mg", "AVAILABLE"]]),
      specialists: [
        { specialty: "Internal Medicine", name: "Dr. Vikram Rao", available: true },
        { specialty: "Cardiology", name: "Dr. K. Iyer", available: true },
        { specialty: "Pulmonology", name: "Dr. F. Sheikh", available: true },
        { specialty: "Obstetrics & Gynaecology", name: "Dr. M. Ghule", available: true },
        { specialty: "Paediatrics", name: "Dr. T. Saraf", available: true },
      ],
      workload: "MODERATE", mapX: 84, mapY: 24,
    },
  ];

  const users: User[] = [
    { id: "u-sita", email: "patient@raksha.demo", password: "raksha123", name: "Sita Devi", role: "PATIENT", village: "Demapur", phone: "98220-10124" },
    { id: "u-asha1", email: "asha@raksha.demo", password: "raksha123", name: "Sunita Bai", role: "ASHA", facilityId: "F-SC-01", village: "Demapur", phone: "98220-20001" },
    { id: "u-asha2", email: "asha2@raksha.demo", password: "raksha123", name: "Rekha Kumari", role: "ASHA", facilityId: "F-PHC-02", village: "Ashti", phone: "98220-20002" },
    { id: "u-anm1", email: "anm@raksha.demo", password: "raksha123", name: "Kavita Pawar", role: "ANM", facilityId: "F-SC-01", village: "Kolwadi", phone: "98220-20003" },
    { id: "u-staff1", email: "phc.staff@raksha.demo", password: "raksha123", name: "Mahesh Raut", role: "PHC_STAFF", facilityId: "F-PHC-01", phone: "98220-30001" },
    { id: "u-phcdr", email: "phc.doctor@raksha.demo", password: "raksha123", name: "Dr. Anil Sharma", role: "PHC_DOCTOR", facilityId: "F-PHC-01", phone: "98220-40001" },
    { id: "u-chcdr", email: "chc.doctor@raksha.demo", password: "raksha123", name: "Dr. Meera Joshi", role: "CHC_DOCTOR", facilityId: "F-CHC-01", phone: "98220-50001" },
    { id: "u-spec", email: "specialist@raksha.demo", password: "raksha123", name: "Dr. Vikram Rao", role: "SPECIALIST", facilityId: "F-DH-01", specialty: "Internal Medicine", phone: "98220-60001" },
    { id: "u-admin", email: "admin@raksha.demo", password: "raksha123", name: "Dr. Nandini Kulkarni", role: "DISTRICT_ADMIN", phone: "98220-70001" },
  ];

  const patients: Patient[] = [
    {
      id: "p-sita", rakId: "RAK-PAT-2026-00124", name: "Sita Devi", dob: "1974-03-12", age: 52, gender: "FEMALE",
      phone: "98220-10124", village: "Demapur", address: "House 42, Main Road, Demapur",
      emergencyContact: "Ramesh Devi (son)", emergencyPhone: "98220-10125",
      conditions: ["Hypertension"], allergies: ["Penicillin"], bloodGroup: "B+",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE",
      abhaId: "ABHA-linked (demo)", createdAt: d(60),
    },
    {
      id: "p-arjun", rakId: "RAK-PAT-2026-00045", name: "Arjun Kale", dob: "1959-07-02", age: 67, gender: "MALE",
      phone: "98220-10045", village: "Kolwadi", address: "House 7, Kolwadi",
      emergencyContact: "Sneha Kale (daughter)", emergencyPhone: "98220-10046",
      conditions: ["Hypertension", "Asthma"], allergies: [], bloodGroup: "O+",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE", createdAt: d(48),
    },
    {
      id: "p-gita", rakId: "RAK-PAT-2026-00087", name: "Gita Bai", dob: "2000-01-20", age: 26, gender: "FEMALE",
      phone: "98220-10087", village: "Ashti", address: "House 19, Ashti",
      emergencyContact: "Mohan (husband)", emergencyPhone: "98220-10088",
      conditions: [], allergies: [], pregnant: true, bloodGroup: "A+",
      ashaId: "u-asha2", ashaName: "Rekha Kumari", phcId: "F-PHC-02", consent: "ACTIVE", createdAt: d(35),
    },
    {
      id: "p-ramesh", rakId: "RAK-PAT-2026-00031", name: "Ramesh Pawar", dob: "1968-11-05", age: 58, gender: "MALE",
      phone: "98220-10031", village: "Demapur", address: "House 3, Demapur",
      emergencyContact: "Priya Pawar (wife)", emergencyPhone: "98220-10032",
      conditions: ["Type 2 Diabetes", "Hypertension"], allergies: ["Sulfa drugs"], bloodGroup: "AB+",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE", createdAt: d(55),
    },
    {
      id: "p-vitthal", rakId: "RAK-PAT-2026-00068", name: "Vitthal Shinde", dob: "1980-05-14", age: 46, gender: "MALE",
      phone: "98220-10068", village: "Pimpalgaon", address: "House 22, Pimpalgaon",
      emergencyContact: "Anita Shinde (wife)", emergencyPhone: "98220-10069",
      conditions: [], allergies: [], bloodGroup: "B-",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE", createdAt: d(20),
    },
    {
      id: "p-lakshmi", rakId: "RAK-PAT-2026-00102", name: "Lakshmi More", dob: "1981-09-25", age: 45, gender: "FEMALE",
      phone: "98220-10102", village: "Shirur", address: "House 11, Shirur",
      emergencyContact: "Sagar More (son)", emergencyPhone: "98220-10103",
      conditions: ["Rheumatic heart disease"], allergies: [], bloodGroup: "O-",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE", createdAt: d(40),
    },
    {
      id: "p-suresh", rakId: "RAK-PAT-2026-00011", name: "Suresh Gaikwad", dob: "1975-12-01", age: 51, gender: "MALE",
      phone: "98220-10011", village: "Demapur", address: "House 30, Demapur",
      emergencyContact: "Neha Gaikwad (wife)", emergencyPhone: "98220-10012",
      conditions: ["Hypertension"], allergies: [], bloodGroup: "A-",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "LIMITED", createdAt: d(62),
    },
    {
      id: "p-meena", rakId: "RAK-PAT-2026-00150", name: "Meena Wagh", dob: "2025-06-10", age: 0, gender: "FEMALE",
      phone: "98220-10150", village: "Kolwadi", address: "House 15, Kolwadi",
      emergencyContact: "Ravi Wagh (father)", emergencyPhone: "98220-10151",
      conditions: [], allergies: [], bloodGroup: "O+",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE", createdAt: d(18),
    },
    {
      id: "p-baban", rakId: "RAK-PAT-2026-00077", name: "Baban Jadhav", dob: "1962-02-18", age: 64, gender: "MALE",
      phone: "98220-10077", village: "Shirur", address: "House 5, Shirur",
      emergencyContact: "Rohini Jadhav (wife)", emergencyPhone: "98220-10078",
      conditions: ["Type 2 Diabetes"], allergies: [], bloodGroup: "B+",
      ashaId: "u-asha1", ashaName: "Sunita Bai", phcId: "F-PHC-01", consent: "ACTIVE", createdAt: d(70),
    },
    {
      id: "p-kanta", rakId: "RAK-PAT-2026-00133", name: "Kanta Sonawane", dob: "1958-08-30", age: 68, gender: "FEMALE",
      phone: "98220-10133", village: "Wadgaon", address: "House 8, Wadgaon",
      emergencyContact: "Kiran Sonawane (son)", emergencyPhone: "98220-10134",
      conditions: ["Hypertension", "Type 2 Diabetes"], allergies: ["Aspirin"], bloodGroup: "A+",
      ashaId: "u-asha2", ashaName: "Rekha Kumari", phcId: "F-PHC-02", consent: "ACTIVE", createdAt: d(80),
    },
  ];

  const genNames: [string, "FEMALE" | "MALE"][] = [
    ["Priya Patil", "FEMALE"], ["Sagar Rathod", "MALE"], ["Anita Deshmukh", "FEMALE"], ["Vikas Chavan", "MALE"],
    ["Sneha Bansode", "FEMALE"], ["Ravi Thorat", "MALE"], ["Pooja Kamble", "FEMALE"], ["Mahesh Sathe", "MALE"],
    ["Divya Bhosale", "FEMALE"], ["Nitin Jagtap", "MALE"], ["Asha Tupe", "FEMALE"], ["Ganesh Lande", "MALE"],
    ["Neha Misal", "FEMALE"], ["Santosh Ghadge", "MALE"], ["Rohini Veer", "FEMALE"], ["Kiran Dhole", "MALE"],
    ["Vaishali Pawar", "FEMALE"], ["Dattatray Shete", "MALE"], ["Pallavi More", "FEMALE"], ["Rahul Kale", "MALE"],
  ];
  const genVillages = ["Demapur", "Kolwadi", "Ashti", "Pimpalgaon", "Wadgaon", "Shirur"];
  genNames.forEach(([name, gender], i) => {
    const village = genVillages[i % genVillages.length];
    patients.push({
      id: `p-g${i}`, rakId: `RAK-PAT-2026-${String(200 + i).padStart(5, "0")}`, name,
      dob: `${1960 + ((i * 3) % 45)}-0${(i % 8) + 1}-1${i % 9}`, age: 20 + ((i * 3) % 50), gender,
      phone: `98220-11${String(200 + i)}`, village, address: `House ${i + 1}, ${village}`,
      emergencyContact: "Family", emergencyPhone: `98220-12${String(200 + i)}`,
      conditions: i % 4 === 0 ? ["Hypertension"] : i % 5 === 0 ? ["Type 2 Diabetes"] : [],
      allergies: i % 7 === 0 ? ["Penicillin"] : [], pregnant: i === 4,
      bloodGroup: ["A+", "B+", "O+", "AB+"][i % 4],
      ashaId: i % 2 === 0 ? "u-asha1" : "u-asha2", ashaName: i % 2 === 0 ? "Sunita Bai" : "Rekha Kumari",
      phcId: i % 3 === 2 ? "F-PHC-02" : "F-PHC-01", consent: "ACTIVE",
      createdAt: d(5 + i * 4),
    });
  });

  const visits: Visit[] = [
    { id: "v-sita1", patientId: "p-sita", workerId: "u-asha1", workerName: "Sunita Bai", role: "ASHA", facilityId: "F-SC-01", location: "Demapur (home)", ts: d(30), type: "HOME_VISIT", symptoms: ["Headache", "Weakness / fatigue"], complaint: "Headache and tiredness for 3 days", observations: "BP raised on repeat check. Advised salt restriction.", notes: "Referred to PHC Demapur for physician review." },
    { id: "v-sita2", patientId: "p-sita", workerId: "u-asha1", workerName: "Sunita Bai", role: "ASHA", facilityId: "F-SC-01", location: "Demapur (home)", ts: d(12), type: "HOME_VISIT", symptoms: ["Weakness / fatigue"], complaint: "Follow-up visit after CHC evaluation", observations: "On regular medicines. BP improving.", notes: "Next follow-up due soon." },
    { id: "v-arjun1", patientId: "p-arjun", workerId: "u-asha1", workerName: "Sunita Bai", role: "ASHA", facilityId: "F-SC-01", location: "Kolwadi (home)", ts: h(5), type: "HOME_VISIT", symptoms: ["High fever", "Breathing difficulty", "Cough"], complaint: "Fever since 2 days, worsening breathlessness since last night", observations: "Patient looks distressed, speaking in short sentences.", notes: "Vitals recorded. Immediate risk assessment done." },
    { id: "v-gita1", patientId: "p-gita", workerId: "u-asha2", workerName: "Rekha Kumari", role: "ASHA", facilityId: "F-PHC-02", location: "Ashti (home)", ts: d(1), type: "HOME_VISIT", symptoms: ["Severe headache", "Swelling (feet/face)", "Reduced urine output"], complaint: "Severe headache and swelling, 28 weeks pregnant", observations: "BP elevated. Danger sign in pregnancy suspected.", notes: "Referral advised to CHC Wadgaon (OBG available)." },
    { id: "v-meena1", patientId: "p-meena", workerId: "u-asha1", workerName: "Sunita Bai", role: "ASHA", facilityId: "F-SC-01", location: "Kolwadi (home)", ts: d(1), type: "HOME_VISIT", symptoms: ["Fever", "Cough"], complaint: "Fever since yesterday evening in 8-month-old", observations: "Active, feeding reasonably well. Temperature 101°F.", notes: "Tepid sponging advised. Review tomorrow." },
    { id: "v-kanta1", patientId: "p-kanta", workerId: "u-asha2", workerName: "Rekha Kumari", role: "ASHA", facilityId: "F-PHC-02", location: "Wadgaon (home)", ts: d(4), type: "HOME_VISIT", symptoms: ["Weakness / fatigue", "Swelling (feet/face)"], complaint: "Tiredness, mild ankle swelling", observations: "BP 168/98 on two readings. Sugars not checked today.", notes: "Medicine adherence poor — counseled." },
    { id: "v-baban1", patientId: "p-baban", workerId: "u-asha1", workerName: "Sunita Bai", role: "ASHA", facilityId: "F-SC-01", location: "Shirur (home)", ts: d(16), type: "HOME_VISIT", symptoms: ["Persistent vomiting", "Weakness / fatigue"], complaint: "Vomiting and fatigue, known diabetic", observations: "RBS 260 mg/dL at sub-centre. Ketone smell not checked.", notes: "Escalated to PHC same day." },
  ];

  const vitals: Vitals[] = [
    { id: "vt-s1", patientId: "p-sita", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: d(60), sys: 158, dia: 98, temp: 98.4, spo2: 97, hr: 84, weight: 62, device: "OMRON-HBP1300" },
    { id: "vt-s2", patientId: "p-sita", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: d(30), sys: 152, dia: 95, temp: 98.6, spo2: 97, hr: 82, weight: 62, device: "OMRON-HBP1300" },
    { id: "vt-s3", patientId: "p-sita", workerId: "u-phcdr", workerName: "Dr. Anil Sharma", facilityId: "F-PHC-01", ts: d(28), sys: 148, dia: 92, temp: 98.2, spo2: 98, hr: 80, device: "PHC triage kit" },
    { id: "vt-s4", patientId: "p-sita", workerId: "u-chcdr", workerName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: d(26), sys: 146, dia: 90, temp: 98.4, spo2: 98, hr: 78, device: "CHC monitor" },
    { id: "vt-s5", patientId: "p-sita", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: d(12), sys: 142, dia: 90, temp: 98.5, spo2: 97, hr: 79, weight: 61, device: "OMRON-HBP1300" },
    { id: "vt-a1", patientId: "p-arjun", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: h(5), sys: 100, dia: 64, temp: 103.2, spo2: 86, hr: 128, rr: 32, device: "Pulse oximeter (field)" },
    { id: "vt-a2", patientId: "p-arjun", workerId: "u-chcdr", workerName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: h(3), sys: 96, dia: 60, temp: 102.8, spo2: 88, hr: 124, rr: 30, device: "CHC monitor" },
    { id: "vt-g1", patientId: "p-gita", workerId: "u-asha2", workerName: "Rekha Kumari", facilityId: "F-PHC-02", ts: d(1), sys: 148, dia: 96, temp: 98.8, spo2: 98, hr: 92, weight: 64, device: "PHC Ashti kit" },
    { id: "vt-r1", patientId: "p-ramesh", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: d(8), sys: 150, dia: 94, temp: 98.3, spo2: 97, hr: 86, weight: 71, device: "OMRON-HBP1300" },
    { id: "vt-m1", patientId: "p-meena", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: d(1), temp: 101.0, hr: 132, rr: 34, spo2: 96, weight: 7.4, device: "Digital thermometer" },
    { id: "vt-k1", patientId: "p-kanta", workerId: "u-asha2", workerName: "Rekha Kumari", facilityId: "F-PHC-02", ts: d(40), sys: 172, dia: 100, temp: 98.4, spo2: 96, hr: 88, device: "PHC Ashti kit" },
    { id: "vt-k2", patientId: "p-kanta", workerId: "u-asha2", workerName: "Rekha Kumari", facilityId: "F-PHC-02", ts: d(25), sys: 170, dia: 98, spo2: 96, hr: 86, device: "PHC Ashti kit" },
    { id: "vt-k3", patientId: "p-kanta", workerId: "u-asha2", workerName: "Rekha Kumari", facilityId: "F-PHC-02", ts: d(12), sys: 166, dia: 96, spo2: 97, hr: 84, device: "PHC Ashti kit" },
    { id: "vt-k4", patientId: "p-kanta", workerId: "u-asha2", workerName: "Rekha Kumari", facilityId: "F-PHC-02", ts: d(4), sys: 168, dia: 98, spo2: 96, hr: 87, weight: 58, device: "PHC Ashti kit" },
    { id: "vt-l1", patientId: "p-lakshmi", workerId: "u-asha1", workerName: "Sunita Bai", facilityId: "F-SC-01", ts: d(7), sys: 118, dia: 76, spo2: 97, hr: 72, device: "OMRON-HBP1300" },
  ];

  const assessments: Assessment[] = [
    {
      id: "as-arjun", patientId: "p-arjun", workerId: "u-chcdr", workerName: "Dr. Meera Joshi", role: "CHC_DOCTOR", ts: h(3),
      inputs: { symptoms: ["High fever", "Breathing difficulty", "Cough"], sys: 96, dia: 60, temp: 102.8, spo2: 88, hr: 124, age: 67, conditions: ["Hypertension", "Asthma"], severity: "SEVERE" },
      level: "CRITICAL", version: RULE_VERSION, confirmed: true, confirmedBy: "Dr. Meera Joshi", confirmedAt: h(3),
      factors: [
        { label: "Very low oxygen saturation", detail: "SpO₂ 88% is below 90%.", severity: "critical" },
        { label: "High-grade fever", detail: "Temperature 102.8°F exceeds 102.5°F.", severity: "high" },
        { label: "Breathing difficulty reported", detail: "Respiratory symptoms detected. Clinical evaluation is recommended.", severity: "high" },
        { label: "Markedly fast heart rate", detail: "Heart rate 124/min exceeds 120/min.", severity: "high" },
      ],
      recommendation: "Immediate emergency evaluation required. Arrange transport to an emergency facility and alert the receiving team in advance.",
    },
    {
      id: "as-gita", patientId: "p-gita", workerId: "u-asha2", workerName: "Rekha Kumari", role: "ASHA", ts: d(1),
      inputs: { symptoms: ["Severe headache", "Swelling (feet/face)", "Reduced urine output"], sys: 148, dia: 96, temp: 98.8, spo2: 98, hr: 92, age: 26, pregnant: true, conditions: [], severity: "MODERATE" },
      level: "HIGH", version: RULE_VERSION, confirmed: true, confirmedBy: "Rekha Kumari", confirmedAt: d(1),
      factors: [
        { label: "Severe headache reported", detail: "Warrants clinical evaluation, especially with high BP or pregnancy.", severity: "high" },
        { label: "Possible danger sign in pregnancy", detail: "Reported symptoms during pregnancy require urgent obstetric review.", severity: "high" },
        { label: "Elevated blood pressure", detail: "BP 148/96 mmHg exceeds 160/100 threshold zone.", severity: "warn" },
      ],
      recommendation: "Priority clinical evaluation recommended. Referral to a higher facility should be considered without delay.",
    },
    {
      id: "as-meena", patientId: "p-meena", workerId: "u-asha1", workerName: "Sunita Bai", role: "ASHA", ts: d(1),
      inputs: { symptoms: ["Fever", "Cough"], temp: 101.0, hr: 132, spo2: 96, age: 0, conditions: [], severity: "MILD" },
      level: "MEDIUM", version: RULE_VERSION, confirmed: true, confirmedBy: "Sunita Bai", confirmedAt: d(1),
      factors: [
        { label: "Elevated temperature", detail: "Temperature 101°F exceeds 100.4°F.", severity: "warn" },
        { label: "Fever reported", detail: "Monitor temperature; evaluate if persistent.", severity: "warn" },
      ],
      recommendation: "Same-day evaluation by a Medical Officer at the PHC is advised.",
    },
  ];

  const consultations: Consultation[] = [
    { id: "c-sita-phc", patientId: "p-sita", doctorId: "u-phcdr", doctorName: "Dr. Anil Sharma", facilityId: "F-PHC-01", ts: d(28), complaint: "Headache, known raised BP readings by ASHA", findings: "BP 148/92, no papilloedema signs, normal heart sounds", assessment: "Stage 1 hypertension — needs specialist confirmation and titration", plan: "Start Amlodipine 5mg OD, salt restriction, refer to CHC for evaluation", followUpDate: iso(-12) },
    { id: "c-sita-chc", patientId: "p-sita", doctorId: "u-chcdr", doctorName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: d(26), complaint: "Referred from PHC Demapur for hypertension evaluation", findings: "BP 146/90 on arrival, ECG: LVH strain pattern", assessment: "Hypertensive heart disease (early) — continue therapy", plan: "Continue Amlodipine, add lifestyle advice, ECG copy attached to record", followUpDate: iso(-12) },
    { id: "c-arjun", patientId: "p-arjun", doctorId: "u-chcdr", doctorName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: h(2), complaint: "Fever with severe breathlessness, referred by ASHA", findings: "SpO₂ 88% on room air, bilateral crepitations, tachypnoea", assessment: "Severe acute respiratory illness with hypoxia — case marked CRITICAL", plan: "Oxygen started, IV access, escalate to District Hospital immediately" },
    { id: "c-baban", patientId: "p-baban", doctorId: "u-phcdr", doctorName: "Dr. Anil Sharma", facilityId: "F-PHC-01", ts: d(16), complaint: "Vomiting, fatigue, known diabetic", findings: "RBS 260, mild dehydration", assessment: "Uncontrolled diabetes with ketosis risk", plan: "IV fluids at PHC, insulin referral to CHC, sugar chart" },
    { id: "c-baban-chc", patientId: "p-baban", doctorId: "u-chcdr", doctorName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: d(15), complaint: "Referred for diabetic management", findings: "Sugars settling on sliding scale", assessment: "Type 2 diabetes — insulin initiation done", plan: "Insulin teaching to family, diet chart, follow-up with ASHA" },
    { id: "c-lakshmi-dh", patientId: "p-lakshmi", doctorId: "u-spec", doctorName: "Dr. Vikram Rao", specialty: "Internal Medicine", facilityId: "F-DH-01", ts: d(6), complaint: "Referred from CHC Shirur — exertional breathlessness", findings: "Grade II/VI murmur, 2D-Echo: moderate mitral stenosis", assessment: "Rheumatic mitral stenosis — stable for now", plan: "Continue penicillin prophylaxis, cardiology review, teleconsult booked" },
  ];

  const prescriptions: Prescription[] = [
    { id: "rx-sita1", patientId: "p-sita", doctorId: "u-phcdr", doctorName: "Dr. Anil Sharma", facilityId: "F-PHC-01", ts: d(28), meds: [{ name: "Amlodipine 5mg", dose: "1-0-0", duration: "30 days" }, { name: "Paracetamol 500mg", dose: "SOS", duration: "5 days" }] },
    { id: "rx-sita2", patientId: "p-sita", doctorId: "u-chcdr", doctorName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: d(26), meds: [{ name: "Amlodipine 5mg", dose: "1-0-0", duration: "30 days" }], notes: "Continue same dose; review with BP diary." },
    { id: "rx-baban", patientId: "p-baban", doctorId: "u-chcdr", doctorName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: d(15), meds: [{ name: "Insulin (Soluble)", dose: "8U BD (sliding)", duration: "30 days" }, { name: "Metformin 500mg", dose: "0-1-0", duration: "30 days" }] },
    { id: "rx-meena", patientId: "p-meena", doctorId: "u-phcdr", doctorName: "Dr. Anil Sharma", facilityId: "F-PHC-01", ts: d(1), meds: [{ name: "Paracetamol drops", dose: "0.8 ml TDS", duration: "3 days" }], notes: "Tepid sponging if temp >100°F." },
  ];

  const diagnostics: DiagnosticRecord[] = [
    { id: "dg-sita-ecg", patientId: "p-sita", orderedById: "u-chcdr", orderedByName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: d(26), test: "ECG", result: "Sinus rhythm, LVH strain pattern", status: "COMPLETED" },
    { id: "dg-baban-rbs", patientId: "p-baban", orderedById: "u-phcdr", orderedByName: "Dr. Anil Sharma", facilityId: "F-PHC-01", ts: d(16), test: "RBS Test", result: "260 mg/dL", status: "COMPLETED" },
    { id: "dg-arjun-cbc", patientId: "p-arjun", orderedById: "u-chcdr", orderedByName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: h(2), test: "CBC", result: "TLC 16,400 — raised", status: "COMPLETED" },
    { id: "dg-arjun-xray", patientId: "p-arjun", orderedById: "u-chcdr", orderedByName: "Dr. Meera Joshi", facilityId: "F-CHC-01", ts: h(2), test: "X-Ray Chest", status: "ORDERED" },
    { id: "dg-gita-usg", patientId: "p-gita", orderedById: "u-asha2", orderedByName: "Rekha Kumari", facilityId: "F-CHC-02", ts: d(1), test: "Ultrasound (OBG)", status: "ORDERED" },
    { id: "dg-lakshmi-echo", patientId: "p-lakshmi", orderedById: "u-spec", orderedByName: "Dr. Vikram Rao", facilityId: "F-DH-01", ts: d(6), test: "2D-Echo", result: "Moderate mitral stenosis (MVA 1.4 cm²)", status: "COMPLETED" },
  ];

  const referrals: Referral[] = [
    {
      id: "ref-arjun", code: "RAK-REF-2026-00211", patientId: "p-arjun", fromFacilityId: "F-CHC-01", toFacilityId: "F-DH-01",
      createdBy: "u-chcdr", createdByName: "Dr. Meera Joshi", creatorRole: "CHC_DOCTOR", ts: h(4),
      reason: "Severe respiratory distress with hypoxia — needs ICU-level care", priority: "EMERGENCY",
      clinicalSummary: "67M, known asthma + HTN. Fever ×2 days, worsening dyspnoea. SpO₂ 86–88%, HR 124, RR 30–32. Bilateral crepitations. Oxygen and IV access initiated at CHC. ASHA triage flagged CRITICAL.",
      vitalsSnapshot: "SpO₂ 88% · Temp 102.8°F · HR 124 · BP 96/60 · RR 30", expectedDate: iso(0), status: "ARRIVED",
      events: [
        ev(h(4), "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", null, "CREATED", "F-CHC-01", "Emergency escalation after CRITICAL assessment"),
        ev(h(4) + 120000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "CREATED", "SENT", "F-CHC-01", "Ambulance arranged"),
        ev(h(3), "u-spec", "Dr. Vikram Rao", "SPECIALIST", "SENT", "ACKNOWLEDGED", "F-DH-01", "ICU bed reserved"),
        ev(h(2), "u-spec", "Dr. Vikram Rao", "SPECIALIST", "ACKNOWLEDGED", "ACCEPTED", "F-DH-01"),
        ev(h(1), "u-asha1", "Sunita Bai", "ASHA", "ACCEPTED", "ARRIVED", "F-DH-01", "Accompanied patient in ambulance"),
      ],
    },
    {
      id: "ref-gita", code: "RAK-REF-2026-00208", patientId: "p-gita", fromFacilityId: "F-PHC-02", toFacilityId: "F-CHC-02",
      createdBy: "u-asha2", createdByName: "Rekha Kumari", creatorRole: "ASHA", ts: h(22),
      reason: "Suspected danger sign in pregnancy (28 weeks) — severe headache, swelling, high BP", priority: "URGENT",
      clinicalSummary: "26F, G1P0, 28 weeks. Severe headache, facial swelling, reduced urine output. BP 148/96. AI-assisted assessment: HIGH.",
      vitalsSnapshot: "BP 148/96 · Temp 98.8°F · HR 92 · SpO₂ 98%", expectedDate: iso(0), status: "SENT",
      events: [
        ev(h(22), "u-asha2", "Rekha Kumari", "ASHA", null, "CREATED", "F-PHC-02"),
        ev(h(22) + 300000, "u-asha2", "Rekha Kumari", "ASHA", "CREATED", "SENT", "F-PHC-02", "Called CHC Wadgaon — no answer, referral sent via RAKSHA"),
      ],
    },
    {
      id: "ref-ramesh", code: "RAK-REF-2026-00204", patientId: "p-ramesh", fromFacilityId: "F-PHC-01", toFacilityId: "F-CHC-01",
      createdBy: "u-phcdr", createdByName: "Dr. Anil Sharma", creatorRole: "PHC_DOCTOR", ts: d(2),
      reason: "Uncontrolled sugars on Metformin — needs insulin evaluation", priority: "PRIORITY",
      clinicalSummary: "58M, T2DM + HTN. Fasting sugars 180–220 despite adherence. No ketosis signs.",
      vitalsSnapshot: "BP 150/94 · RBS 210", expectedDate: iso(1), status: "ACCEPTED",
      events: [
        ev(d(2), "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", null, "CREATED", "F-PHC-01"),
        ev(d(2) + 600000, "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", "CREATED", "SENT", "F-PHC-01"),
        ev(d(1), "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "SENT", "ACKNOWLEDGED", "F-CHC-01"),
        ev(h(20), "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ACKNOWLEDGED", "ACCEPTED", "F-CHC-01", "Slot reserved for tomorrow OPD"),
      ],
    },
    {
      id: "ref-vitthal", code: "RAK-REF-2026-00198", patientId: "p-vitthal", fromFacilityId: "F-PHC-01", toFacilityId: "F-CHC-01",
      createdBy: "u-phcdr", createdByName: "Dr. Anil Sharma", creatorRole: "PHC_DOCTOR", ts: d(4),
      reason: "Persistent abdominal pain — needs ultrasound and surgical opinion", priority: "PRIORITY",
      clinicalSummary: "46M, persistent right upper abdominal pain ×10 days. No jaundice. USG advised.",
      expectedDate: iso(-2), status: "ACCEPTED",
      events: [
        ev(d(4), "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", null, "CREATED", "F-PHC-01"),
        ev(d(4) + 300000, "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", "CREATED", "SENT", "F-PHC-01"),
        ev(d(3), "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "SENT", "ACKNOWLEDGED", "F-CHC-01"),
        ev(d(3) + 3600000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ACKNOWLEDGED", "ACCEPTED", "F-CHC-01"),
      ],
    },
    {
      id: "ref-sita-old", code: "RAK-REF-2026-00176", patientId: "p-sita", fromFacilityId: "F-PHC-01", toFacilityId: "F-CHC-01",
      createdBy: "u-phcdr", createdByName: "Dr. Anil Sharma", creatorRole: "PHC_DOCTOR", ts: d(27),
      reason: "Newly detected hypertension — needs evaluation and ECG", priority: "ROUTINE",
      clinicalSummary: "52F, repeated BP 148–158/92–98 on ASHA visits. Headaches. No end-organ symptoms.",
      vitalsSnapshot: "BP 148/92 · HR 80", expectedDate: iso(-26), status: "COMPLETED", completedAt: d(26), followUpDate: iso(-12),
      events: [
        ev(d(27), "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", null, "CREATED", "F-PHC-01"),
        ev(d(27) + 600000, "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", "CREATED", "SENT", "F-PHC-01"),
        ev(d(27) + 3000000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "SENT", "ACKNOWLEDGED", "F-CHC-01"),
        ev(d(27) + 5400000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ACKNOWLEDGED", "ACCEPTED", "F-CHC-01"),
        ev(d(26), "u-asha1", "Sunita Bai", "ASHA", "ACCEPTED", "ARRIVED", "F-CHC-01"),
        ev(d(26) + 1200000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ARRIVED", "IN_CONSULTATION", "F-CHC-01"),
        ev(d(26) + 4200000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "IN_CONSULTATION", "TREATMENT", "F-CHC-01", "Amlodipine started, ECG done"),
        ev(d(26) + 5400000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "TREATMENT", "COMPLETED", "F-CHC-01", "Follow-up in 2 weeks via ASHA"),
      ],
    },
    {
      id: "ref-lakshmi", code: "RAK-REF-2026-00183", patientId: "p-lakshmi", fromFacilityId: "F-CHC-01", toFacilityId: "F-DH-01",
      createdBy: "u-chcdr", createdByName: "Dr. Meera Joshi", creatorRole: "CHC_DOCTOR", ts: d(8),
      reason: "Exertional breathlessness with murmur — needs 2D-Echo and specialist review", priority: "PRIORITY",
      clinicalSummary: "45F, progressive dyspnoea on exertion. Grade II/VI diastolic murmur. Rheumatic origin suspected.",
      expectedDate: iso(-6), status: "COMPLETED", completedAt: d(6), followUpDate: iso(6),
      events: [
        ev(d(8), "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", null, "CREATED", "F-CHC-01"),
        ev(d(8) + 900000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "CREATED", "SENT", "F-CHC-01"),
        ev(d(7), "u-spec", "Dr. Vikram Rao", "SPECIALIST", "SENT", "ACKNOWLEDGED", "F-DH-01"),
        ev(d(7) + 3600000, "u-spec", "Dr. Vikram Rao", "SPECIALIST", "ACKNOWLEDGED", "ACCEPTED", "F-DH-01"),
        ev(d(6), "u-asha1", "Sunita Bai", "ASHA", "ACCEPTED", "ARRIVED", "F-DH-01"),
        ev(d(6) + 1800000, "u-spec", "Dr. Vikram Rao", "SPECIALIST", "ARRIVED", "IN_CONSULTATION", "F-DH-01"),
        ev(d(6) + 5400000, "u-spec", "Dr. Vikram Rao", "SPECIALIST", "IN_CONSULTATION", "TREATMENT", "F-DH-01", "Echo completed"),
        ev(d(6) + 7200000, "u-spec", "Dr. Vikram Rao", "SPECIALIST", "TREATMENT", "COMPLETED", "F-DH-01", "Teleconsult follow-up booked"),
      ],
    },
    {
      id: "ref-baban", code: "RAK-REF-2026-00170", patientId: "p-baban", fromFacilityId: "F-PHC-01", toFacilityId: "F-CHC-01",
      createdBy: "u-phcdr", createdByName: "Dr. Anil Sharma", creatorRole: "PHC_DOCTOR", ts: d(16),
      reason: "Uncontrolled diabetes with vomiting — insulin initiation", priority: "URGENT",
      clinicalSummary: "64M, RBS 260 with vomiting and dehydration. Ketosis ruled out at PHC.",
      expectedDate: iso(-15), status: "COMPLETED", completedAt: d(15), followUpDate: iso(-5),
      events: [
        ev(d(16), "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", null, "CREATED", "F-PHC-01"),
        ev(d(16) + 300000, "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", "CREATED", "SENT", "F-PHC-01"),
        ev(d(16) + 2400000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "SENT", "ACKNOWLEDGED", "F-CHC-01"),
        ev(d(16) + 3600000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ACKNOWLEDGED", "ACCEPTED", "F-CHC-01"),
        ev(d(15), "u-asha1", "Sunita Bai", "ASHA", "ACCEPTED", "ARRIVED", "F-CHC-01"),
        ev(d(15) + 1500000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ARRIVED", "IN_CONSULTATION", "F-CHC-01"),
        ev(d(15) + 5400000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "IN_CONSULTATION", "TREATMENT", "F-CHC-01"),
        ev(d(15) + 7200000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "TREATMENT", "COMPLETED", "F-CHC-01"),
      ],
    },
  ];

  // Generated referral history so analytics look alive (completed loops across facilities)
  for (let i = 0; i < 9; i++) {
    const pat = patients[10 + (i % 12)];
    const from = ["F-PHC-01", "F-PHC-02", "F-PHC-01", "F-CHC-01"][i % 4];
    const to = from.startsWith("F-CHC") ? "F-DH-01" : i % 3 === 0 ? "F-DH-01" : "F-CHC-01";
    const started = d(9 + i * 5);
    const done = started + 86400000 * (0.5 + (i % 3) * 0.7);
    referrals.push({
      id: `ref-g${i}`, code: `RAK-REF-2026-00${140 + i}`, patientId: pat.id, fromFacilityId: from, toFacilityId: to,
      createdBy: "u-phcdr", createdByName: "Dr. Anil Sharma", creatorRole: "PHC_DOCTOR", ts: started,
      reason: ["BP review", "Sugar titration", "Persistent fever", "Antenatal check", "Skin infection", "Joint pain", "Anaemia workup", "ENT review", "Eye check"][i % 9],
      priority: i % 4 === 0 ? "URGENT" : i % 2 === 0 ? "PRIORITY" : "ROUTINE",
      clinicalSummary: "Programmatic demo referral — closed loop completed.",
      expectedDate: new Date(started + 86400000).toISOString().slice(0, 10),
      status: "COMPLETED", completedAt: done, followUpDate: new Date(done + 7 * 86400000).toISOString().slice(0, 10),
      events: [
        ev(started, "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", null, "CREATED", from),
        ev(started + 600000, "u-phcdr", "Dr. Anil Sharma", "PHC_DOCTOR", "CREATED", "SENT", from),
        ev(started + 3600000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "SENT", "ACKNOWLEDGED", to),
        ev(started + 7200000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ACKNOWLEDGED", "ACCEPTED", to),
        ev(started + 86400000, "u-asha1", "Sunita Bai", "ASHA", "ACCEPTED", "ARRIVED", to),
        ev(started + 90000000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "ARRIVED", "IN_CONSULTATION", to),
        ev(started + 93600000, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "IN_CONSULTATION", "TREATMENT", to),
        ev(done, "u-chcdr", "Dr. Meera Joshi", "CHC_DOCTOR", "TREATMENT", "COMPLETED", to),
      ],
    });
  }

  const followups: FollowUp[] = [
    { id: "fu-gita", patientId: "p-gita", referralId: "ref-gita", date: iso(-1), assigneeRole: "ASHA", assigneeId: "u-asha2", notes: "Confirm Gita Bai reached CHC Wadgaon; check BP daily", status: "SCHEDULED" },
    { id: "fu-ramesh", patientId: "p-ramesh", referralId: "ref-ramesh", date: iso(1), assigneeRole: "ASHA", assigneeId: "u-asha1", notes: "Escort to CHC Shirur OPD tomorrow", status: "SCHEDULED" },
    { id: "fu-meena", patientId: "p-meena", date: iso(0), assigneeRole: "ASHA", assigneeId: "u-asha1", notes: "Recheck temperature of infant Meena", status: "SCHEDULED" },
    { id: "fu-kanta", patientId: "p-kanta", date: iso(-3), assigneeRole: "ASHA", assigneeId: "u-asha2", notes: "BP recheck — last reading 168/98", status: "SCHEDULED" },
    { id: "fu-sita-done", patientId: "p-sita", referralId: "ref-sita-old", date: iso(-12), assigneeRole: "ASHA", assigneeId: "u-asha1", notes: "Post-CHC BP check with medicine diary", status: "COMPLETED", completedAt: d(12), completedBy: "Sunita Bai" },
    { id: "fu-baban-done", patientId: "p-baban", referralId: "ref-baban", date: iso(-5), assigneeRole: "ASHA", assigneeId: "u-asha1", notes: "Insulin technique check with family", status: "COMPLETED", completedAt: d(5), completedBy: "Sunita Bai" },
  ];

  const appointments: Appointment[] = [
    { id: "ap-sita", patientId: "p-sita", facilityId: "F-PHC-01", date: iso(1), time: "10:30", purpose: "BP review with Medical Officer", status: "CONFIRMED" },
    { id: "ap-ramesh", patientId: "p-ramesh", facilityId: "F-PHC-01", date: iso(0), time: "11:00", purpose: "Sugar test before CHC visit", status: "IN_QUEUE", queuePos: 3 },
    { id: "ap-meena", patientId: "p-meena", facilityId: "F-PHC-01", date: iso(2), time: "09:30", purpose: "Infant fever review", status: "REQUESTED" },
    { id: "ap-suresh", patientId: "p-suresh", facilityId: "F-PHC-01", date: iso(-6), time: "12:00", purpose: "BP medicine refill", status: "COMPLETED" },
  ];

  const teles: Teleconsultation[] = [
    { id: "tl-lakshmi", patientId: "p-lakshmi", doctorId: "u-spec", doctorName: "Dr. Vikram Rao", specialty: "Internal Medicine", facilityId: "F-DH-01", scheduledAt: N + 86400000 + 39600000, status: "SCHEDULED", roomCode: "RAK-TL-4821" },
    { id: "tl-kanta", patientId: "p-kanta", doctorId: "u-spec", doctorName: "Dr. Vikram Rao", specialty: "Internal Medicine", facilityId: "F-DH-01", scheduledAt: d(20), status: "COMPLETED", roomCode: "RAK-TL-4509", startedAt: d(20), completedAt: d(20) + 1500000, summary: "Reviewed BP chart shared by ASHA. No red flags beyond persistent elevation.", recommendation: "Change Amlodipine to 10mg, low-salt diet, repeat BP after 2 weeks via ASHA.", followUp: "BP recheck by ASHA in 2 weeks" },
    { id: "tl-arjun-old", patientId: "p-arjun", doctorId: "u-spec", doctorName: "Dr. Vikram Rao", specialty: "Internal Medicine", facilityId: "F-DH-01", scheduledAt: d(30), status: "COMPLETED", roomCode: "RAK-TL-4102", startedAt: d(30), completedAt: d(30) + 1200000, summary: "Asthma control reviewed after monsoon exacerbation.", recommendation: "Continue inhaler technique training; spacer advised.", followUp: "Review if symptoms recur" },
  ];

  const emergencies: EmergencyEvent[] = [
    {
      id: "emg-arjun", code: "EMG-RAK-2026-00021", patientId: "p-arjun", doctorId: "u-chcdr", doctorName: "Dr. Meera Joshi",
      facilityId: "F-CHC-01", ts: h(3), severity: "CRITICAL",
      clinicalNote: "Severe hypoxia (SpO₂ 88%) with respiratory distress — escalation to District Hospital ICU initiated.",
      status: "ACTIVE", smsToken: "4F7K2Q", smsExpiresAt: h(-1), smsRedeemed: false,
      smsLog: [`${new Date(h(3)).toISOString()} — token generated (expires in 10 min)`, `${new Date(h(3) + 5000).toISOString()} — push notification dispatched (FCM adapter, demo)`],
    },
  ];

  const notifications: AppNotification[] = [
    { id: "n1", ts: mn(50), targetRole: "SPECIALIST", targetFacilityId: "F-DH-01", title: "Emergency referral arriving", body: "Arjun Kale (RAK-PAT-2026-00045) — severe respiratory distress. Ambulance en route.", kind: "critical", read: false, link: "/app/referrals/ref-arjun" },
    { id: "n2", ts: h(3), targetRole: "DISTRICT_ADMIN", title: "CRITICAL case flagged", body: "EMG-RAK-2026-00021 created at CHC Shirur for Arjun Kale.", kind: "critical", read: false, link: "/app/dashboard" },
    { id: "n3", ts: h(22), targetRole: "CHC_DOCTOR", targetFacilityId: "F-CHC-02", title: "Referral awaiting acknowledgement", body: "Gita Bai — suspected danger sign in pregnancy referred from PHC Ashti (URGENT).", kind: "warning", read: false, link: "/app/referrals/ref-gita" },
    { id: "n4", ts: h(20), targetRole: "PHC_DOCTOR", targetFacilityId: "F-PHC-01", title: "Referral accepted", body: "CHC Shirur accepted referral RAK-REF-2026-00204 (Ramesh Pawar).", kind: "success", read: false, link: "/app/referrals/ref-ramesh" },
    { id: "n5", ts: d(1), targetRole: "ASHA", targetUserId: "u-asha2", title: "Follow-up overdue", body: "Gita Bai follow-up was expected yesterday. Please verify she reached CHC Wadgaon.", kind: "warning", read: false, link: "/app/followups" },
    { id: "n6", ts: d(1), targetRole: "ASHA", targetUserId: "u-asha1", title: "Follow-up due today", body: "Infant Meena Wagh — recheck temperature today.", kind: "info", read: false, link: "/app/followups" },
    { id: "n7", ts: h(5), targetUserId: "u-sita", targetRole: "PATIENT", title: "Appointment confirmed", body: "BP review at PHC Demapur tomorrow, 10:30.", kind: "info", read: false, link: "/app/appointments" },
    { id: "n8", ts: d(2), targetRole: "SPECIALIST", targetUserId: "u-spec", title: "Teleconsultation scheduled", body: "Lakshmi More — post-echo cardiology review tomorrow 11:00 (RAK-TL-4821).", kind: "info", read: true, link: "/app/tele" },
    { id: "n9", ts: h(2), targetRole: "PHC_STAFF", targetFacilityId: "F-PHC-01", title: "Queue update", body: "Ramesh Pawar checked in — position #3 in OPD queue.", kind: "info", read: true },
  ];

  const audit: AuditLog[] = [
    { id: "al1", ts: h(26), actorId: "u-admin", actorName: "Dr. Nandini Kulkarni", role: "DISTRICT_ADMIN", action: "LOGIN", resource: "auth" },
    { id: "al2", ts: h(24), actorId: "u-chcdr", actorName: "Dr. Meera Joshi", role: "CHC_DOCTOR", action: "VIEW_RECORD", resource: "patient", patientId: "p-lakshmi", purpose: "Referral consultation" },
    { id: "al3", ts: h(22), actorId: "u-asha2", actorName: "Rekha Kumari", role: "ASHA", action: "CREATE_REFERRAL", resource: "referral", patientId: "p-gita", details: "RAK-REF-2026-00208 PHC Ashti → RH Wadgaon" },
    { id: "al4", ts: h(5), actorId: "u-asha1", actorName: "Sunita Bai", role: "ASHA", action: "CREATE_VISIT", resource: "visit", patientId: "p-arjun" },
    { id: "al5", ts: h(4), actorId: "u-chcdr", actorName: "Dr. Meera Joshi", role: "CHC_DOCTOR", action: "CREATE_REFERRAL", resource: "referral", patientId: "p-arjun", details: "RAK-REF-2026-00211 CHC Shirur → District Hospital" },
    { id: "al6", ts: h(3), actorId: "u-chcdr", actorName: "Dr. Meera Joshi", role: "CHC_DOCTOR", action: "CREATE_EMERGENCY", resource: "emergency", patientId: "p-arjun", details: "EMG-RAK-2026-00021" },
    { id: "al7", ts: h(3), actorId: "SYSTEM", actorName: "RAKSHA Sync", role: "SYSTEM", action: "SYNC_BATCH", resource: "sync", details: "14 operations synchronized" },
    { id: "al8", ts: d(1), actorId: "u-suresh", actorName: "Suresh Gaikwad", role: "PATIENT", action: "CONSENT_CHANGE", resource: "consent", patientId: "p-suresh", details: "Consent set to LIMITED — record visible only with explicit purpose" },
    { id: "al9", ts: d(1), actorId: "u-asha2", actorName: "Rekha Kumari", role: "ASHA", action: "TRIAGE_ASSESS", resource: "triage", patientId: "p-gita", details: "HIGH — 3 factors" },
    { id: "al10", ts: d(2), actorId: "u-phcdr", actorName: "Dr. Anil Sharma", role: "PHC_DOCTOR", action: "CREATE_PRESCRIPTION", resource: "prescription", patientId: "p-meena" },
  ];

  return {
    version: 1, seededAt: N,
    users, patients, visits, vitals, assessments, consultations, prescriptions, diagnostics,
    referrals, followups, appointments, teles, emergencies, notifications, facilities, audit,
    sync: [
      { id: "op-f1", ts: h(7), entity: "vitals.batch", label: "Vitals batch — Kanta Sonawane", status: "FAILED", attempts: 2, error: "Gateway timeout (simulated)" },
      { id: "op-1", ts: h(6), entity: "visit", label: "Visit — Meena Wagh", status: "SYNCED", attempts: 1 },
      { id: "op-2", ts: h(5), entity: "visit", label: "Visit — Arjun Kale", status: "SYNCED", attempts: 1 },
      { id: "op-3", ts: h(5), entity: "vitals", label: "Vitals — Arjun Kale", status: "SYNCED", attempts: 1 },
      { id: "op-4", ts: h(4), entity: "referral", label: "Referral — Arjun Kale", status: "SYNCED", attempts: 1 },
      { id: "op-5", ts: h(3), entity: "triage", label: "Triage — Arjun Kale", status: "SYNCED", attempts: 1 },
    ],
    syncBaseline: { synced: 27 },
    lastSyncAt: h(3),
  };
}
