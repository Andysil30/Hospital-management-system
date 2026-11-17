// E-prescription: loads a visit's prescription and draws it as a PDF with a QR code.
// Scanning the QR code opens /verify/<code>, a public page that confirms the prescription is genuine.
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { query } = require('./db');

const CLINIC = 'AfyaCare Clinic';
const CODE_SET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 10 }, () => CODE_SET[crypto.randomInt(CODE_SET.length)]).join('');

// Returns everything needed for the PDF, or null. The CALLER must already have checked
// that the person is allowed to see this record (owner of the record or its doctor).
async function loadPrescription(recordId) {
  const r = (await query(
    `SELECT r.id, r.verify_code, r.diagnosis, r.created_at, r.patient_id, r.doctor_id, a.appointment_date AS date,
            pu.full_name AS patient, p.gender, EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age,
            du.full_name AS doctor, d.specialty, d.qualifications, dep.name AS department
     FROM medical_records r
     JOIN appointments a ON a.id = r.appointment_id
     JOIN patients p ON p.id = r.patient_id JOIN users pu ON pu.id = p.user_id
     JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     WHERE r.id = $1`, [recordId])).rows[0];
  if (!r) return null;
  if (!r.verify_code) {
    // Older records get their code the first time a PDF is requested
    for (let i = 0; i < 5 && !r.verify_code; i++) {
      try {
        r.verify_code = (await query('UPDATE medical_records SET verify_code = $1 WHERE id = $2 AND verify_code IS NULL RETURNING verify_code', [newCode(), recordId])).rows[0]?.verify_code
          || (await query('SELECT verify_code FROM medical_records WHERE id = $1', [recordId])).rows[0].verify_code;
      } catch (e) { if (e.code !== '23505') throw e; }
    }
  }
  r.items = (await query(
    `SELECT m.name AS medicine, p.dosage, p.frequency, p.duration_days, p.quantity, p.instructions
     FROM prescriptions p JOIN medicines m ON m.id = p.medicine_id WHERE p.record_id = $1 ORDER BY p.id`, [recordId])).rows;
  return r;
}

// Draws the PDF. Returns the PDFKit document (call .pipe(res) on it).
async function buildPrescriptionPdf(rx, baseUrl) {
  const url = `${baseUrl}/verify/${rx.verify_code}`;
  const qr = await QRCode.toBuffer(url, { margin: 1, width: 240 });
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Prescription ${rx.verify_code}`, Author: CLINIC } });
  const W = doc.page.width - 96;
  const ink = '#0f2742', muted = '#5d7089', blue = '#1d74d6', line = '#d5e0ec';
  const dateText = new Date(rx.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Header
  doc.rect(0, 0, doc.page.width, 92).fill(blue);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(24).text(CLINIC, 48, 28);
  doc.font('Helvetica').fontSize(10).text('Hospital Management System' + (process.env.HOSPITAL_ADDRESS ? '  |  ' + process.env.HOSPITAL_ADDRESS : '') + (process.env.HOSPITAL_PHONE ? '  |  ' + process.env.HOSPITAL_PHONE : ''), 48, 60);

  doc.fillColor(ink).font('Helvetica-Bold').fontSize(16).text('PRESCRIPTION', 48, 114);
  doc.font('Helvetica').fontSize(10).fillColor(muted).text(`Date: ${dateText}      Rx no: ${rx.verify_code}`, 48, 135);

  // Patient and doctor
  let y = 164;
  doc.roundedRect(48, y, W, 62, 6).strokeColor(line).stroke();
  doc.fillColor(muted).fontSize(9).text('PATIENT', 60, y + 10).text('PRESCRIBED BY', 60 + W / 2, y + 10);
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text(rx.patient, 60, y + 24).text(rx.doctor, 60 + W / 2, y + 24);
  doc.font('Helvetica').fontSize(10).fillColor(muted)
    .text(`${rx.age != null ? rx.age + ' years' : ''}${rx.age != null && rx.gender ? ', ' : ''}${rx.gender || ''}`, 60, y + 42)
    .text(`${rx.specialty}, ${rx.department}`, 60 + W / 2, y + 42);

  // Diagnosis
  y += 82;
  doc.fillColor(muted).fontSize(9).text('DIAGNOSIS', 48, y);
  doc.fillColor(ink).fontSize(11).text(rx.diagnosis, 48, y + 14, { width: W });
  y = doc.y + 18;

  // Medicines table
  const cols = [{ t: '#', x: 48, w: 22 }, { t: 'Medicine', x: 72, w: 190 }, { t: 'Dose', x: 264, w: 80 }, { t: 'How often', x: 346, w: 90 }, { t: 'Days', x: 438, w: 34 }, { t: 'Qty', x: 474, w: 42 }];
  doc.rect(48, y, W, 22).fill('#e8f1fb');
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(9.5);
  cols.forEach((c) => doc.text(c.t, c.x + 4, y + 7, { width: c.w }));
  y += 24;
  doc.font('Helvetica').fontSize(10);
  if (!rx.items.length) {
    doc.fillColor(muted).text('No medicines were prescribed at this visit.', 52, y + 6);
    y += 30;
  }
  rx.items.forEach((it, i) => {
    if (y > 640) { doc.addPage(); y = 60; }
    const startY = y;
    doc.fillColor(ink);
    doc.text(String(i + 1), cols[0].x + 4, y + 4, { width: cols[0].w });
    doc.font('Helvetica-Bold').text(it.medicine, cols[1].x + 4, y + 4, { width: cols[1].w - 6 }); doc.font('Helvetica');
    const medEnd = doc.y;
    doc.text(it.dosage, cols[2].x + 4, y + 4, { width: cols[2].w - 4 });
    doc.text(it.frequency, cols[3].x + 4, y + 4, { width: cols[3].w - 4 });
    doc.text(String(it.duration_days), cols[4].x + 4, y + 4, { width: cols[4].w });
    doc.text(String(it.quantity), cols[5].x + 4, y + 4, { width: cols[5].w });
    y = Math.max(medEnd, startY + 22);
    if (it.instructions) { doc.fillColor(muted).fontSize(9).text('Note: ' + it.instructions, cols[1].x + 4, y, { width: 360 }); y = doc.y; doc.fontSize(10); }
    y += 6;
    doc.moveTo(48, y).lineTo(48 + W, y).strokeColor(line).stroke();
    y += 4;
  });

  // Signature, QR code and footer
  const bottom = Math.max(y + 30, 640);
  if (bottom > 740) { doc.addPage(); }
  const by = bottom > 740 ? 60 : bottom;
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(11).text(rx.doctor, 48, by + 40);
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(rx.qualifications, 48, by + 55, { width: 280 });
  doc.moveTo(48, by + 34).lineTo(228, by + 34).strokeColor(ink).stroke();
  doc.image(qr, 48 + W - 96, by, { width: 96 });
  doc.fontSize(8).fillColor(muted).text('Scan to verify', 48 + W - 96, by + 98, { width: 96, align: 'center' });
  doc.fontSize(8).fillColor(muted).text('This prescription is valid only if the verification page (QR code) confirms it. ' + url, 48, 772, { width: W - 110, lineBreak: true });
  doc.end();
  return doc;
}

module.exports = { loadPrescription, buildPrescriptionPdf, newCode, CLINIC };
