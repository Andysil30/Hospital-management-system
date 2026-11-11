// A starter catalogue of ~220 commonly used (non-controlled) medicines.
// Format per line:  Category | Medicine name | unit price (KES, indicative) | reorder level
// IMPORTANT: prices here are rough placeholders. Set your real prices in the Pharmacy tab.
// Controlled drugs (e.g. morphine, diazepam, tramadol) are deliberately NOT included.
const RAW = `
Pain & Inflammation | Paracetamol 500mg | 5 | 150
Pain & Inflammation | Paracetamol Syrup 120mg/5ml | 120 | 20
Pain & Inflammation | Paracetamol Infusion 1g/100ml | 350 | 10
Pain & Inflammation | Ibuprofen 400mg | 8 | 80
Pain & Inflammation | Ibuprofen Syrup 100mg/5ml | 150 | 20
Pain & Inflammation | Diclofenac 50mg | 10 | 60
Pain & Inflammation | Diclofenac Injection 75mg | 60 | 20
Pain & Inflammation | Diclofenac Gel | 220 | 30
Pain & Inflammation | Naproxen 500mg | 20 | 40
Pain & Inflammation | Aspirin 75mg | 3 | 100
Pain & Inflammation | Aspirin 300mg | 4 | 60
Pain & Inflammation | Mefenamic Acid 500mg | 10 | 50
Pain & Inflammation | Celecoxib 200mg | 45 | 30
Pain & Inflammation | Etoricoxib 90mg | 60 | 30
Pain & Inflammation | Piroxicam 20mg | 20 | 30
Pain & Inflammation | Ketorolac Injection 30mg | 120 | 20
Pain & Inflammation | Methocarbamol 500mg | 25 | 30
Pain & Inflammation | Baclofen 10mg | 20 | 30
Pain & Inflammation | Colchicine 0.5mg | 20 | 20
Pain & Inflammation | Allopurinol 100mg | 8 | 40
Antibiotics | Amoxicillin 500mg | 20 | 100
Antibiotics | Amoxicillin Syrup 125mg/5ml | 180 | 20
Antibiotics | Amoxicillin/Clavulanate 625mg | 60 | 60
Antibiotics | Amoxicillin/Clavulanate Syrup 228mg/5ml | 650 | 10
Antibiotics | Azithromycin 500mg | 60 | 50
Antibiotics | Azithromycin Syrup 200mg/5ml | 550 | 10
Antibiotics | Ciprofloxacin 500mg | 25 | 50
Antibiotics | Levofloxacin 500mg | 70 | 30
Antibiotics | Cefuroxime 500mg | 90 | 30
Antibiotics | Cefixime 200mg | 85 | 30
Antibiotics | Cephalexin 500mg | 25 | 50
Antibiotics | Ceftriaxone Injection 1g | 180 | 40
Antibiotics | Cefazolin Injection 1g | 220 | 20
Antibiotics | Ampicillin Injection 500mg | 90 | 30
Antibiotics | Benzylpenicillin Injection 5MU | 150 | 20
Antibiotics | Flucloxacillin 500mg | 35 | 40
Antibiotics | Gentamicin Injection 80mg | 60 | 30
Antibiotics | Metronidazole 400mg | 8 | 100
Antibiotics | Metronidazole Infusion 500mg/100ml | 140 | 20
Antibiotics | Doxycycline 100mg | 12 | 60
Antibiotics | Erythromycin 250mg | 18 | 40
Antibiotics | Clarithromycin 500mg | 85 | 20
Antibiotics | Cotrimoxazole 480mg | 6 | 100
Antibiotics | Cotrimoxazole Syrup 240mg/5ml | 150 | 20
Antibiotics | Nitrofurantoin 100mg | 20 | 40
Antibiotics | Clindamycin 300mg | 60 | 30
Antibiotics | Vancomycin Injection 500mg | 650 | 5
Antibiotics | Meropenem Injection 1g | 1200 | 5
Antimalarials & Antiparasitics | Artemether/Lumefantrine | 120 | 60
Antimalarials & Antiparasitics | Artesunate Injection 60mg | 450 | 20
Antimalarials & Antiparasitics | Quinine 300mg | 25 | 30
Antimalarials & Antiparasitics | Sulfadoxine/Pyrimethamine 500/25mg | 40 | 30
Antimalarials & Antiparasitics | Albendazole 400mg | 30 | 60
Antimalarials & Antiparasitics | Mebendazole 100mg | 8 | 60
Antimalarials & Antiparasitics | Praziquantel 600mg | 80 | 20
Antimalarials & Antiparasitics | Ivermectin 3mg | 20 | 30
Antifungals & Antivirals | Fluconazole 150mg | 60 | 30
Antifungals & Antivirals | Fluconazole 200mg | 90 | 20
Antifungals & Antivirals | Clotrimazole Cream | 150 | 25
Antifungals & Antivirals | Clotrimazole Pessary 500mg | 80 | 20
Antifungals & Antivirals | Nystatin Oral Suspension | 220 | 15
Antifungals & Antivirals | Terbinafine 250mg | 55 | 20
Antifungals & Antivirals | Ketoconazole Cream | 240 | 15
Antifungals & Antivirals | Griseofulvin 500mg | 35 | 20
Antifungals & Antivirals | Acyclovir 400mg | 25 | 40
Antifungals & Antivirals | Acyclovir Cream 5% | 260 | 10
Antifungals & Antivirals | Oseltamivir 75mg | 180 | 10
Cardiovascular | Amlodipine 5mg | 9 | 100
Cardiovascular | Amlodipine 10mg | 12 | 60
Cardiovascular | Losartan 50mg | 14 | 80
Cardiovascular | Enalapril 5mg | 8 | 60
Cardiovascular | Lisinopril 10mg | 12 | 60
Cardiovascular | Atenolol 50mg | 8 | 60
Cardiovascular | Bisoprolol 5mg | 20 | 40
Cardiovascular | Carvedilol 6.25mg | 22 | 40
Cardiovascular | Hydrochlorothiazide 25mg | 5 | 60
Cardiovascular | Furosemide 40mg | 5 | 80
Cardiovascular | Furosemide Injection 20mg | 45 | 20
Cardiovascular | Spironolactone 25mg | 18 | 40
Cardiovascular | Nifedipine 20mg | 10 | 60
Cardiovascular | Methyldopa 250mg | 10 | 40
Cardiovascular | Atorvastatin 20mg | 18 | 60
Cardiovascular | Simvastatin 20mg | 10 | 60
Cardiovascular | Rosuvastatin 10mg | 35 | 30
Cardiovascular | Clopidogrel 75mg | 30 | 40
Cardiovascular | Warfarin 5mg | 12 | 30
Cardiovascular | Digoxin 0.25mg | 15 | 20
Cardiovascular | Glyceryl Trinitrate 0.5mg Sublingual | 20 | 20
Cardiovascular | Isosorbide Dinitrate 10mg | 10 | 30
Cardiovascular | Amiodarone 200mg | 45 | 15
Cardiovascular | Enoxaparin Injection 40mg | 750 | 10
Diabetes & Endocrine | Metformin 500mg | 6 | 150
Diabetes & Endocrine | Metformin 850mg | 8 | 100
Diabetes & Endocrine | Glibenclamide 5mg | 5 | 60
Diabetes & Endocrine | Gliclazide 80mg | 10 | 60
Diabetes & Endocrine | Glimepiride 2mg | 18 | 40
Diabetes & Endocrine | Pioglitazone 15mg | 25 | 30
Diabetes & Endocrine | Insulin Soluble (Regular) 100IU/ml | 750 | 10
Diabetes & Endocrine | Insulin Isophane (NPH) 100IU/ml | 800 | 10
Diabetes & Endocrine | Insulin Glargine 100IU/ml | 2200 | 5
Diabetes & Endocrine | Levothyroxine 50mcg | 8 | 40
Diabetes & Endocrine | Carbimazole 5mg | 10 | 20
Diabetes & Endocrine | Prednisolone 5mg | 4 | 100
Diabetes & Endocrine | Dexamethasone 4mg | 10 | 40
Diabetes & Endocrine | Dexamethasone Injection 4mg | 60 | 30
Diabetes & Endocrine | Hydrocortisone Injection 100mg | 150 | 20
Respiratory & Allergy | Salbutamol Inhaler | 350 | 20
Respiratory & Allergy | Salbutamol 4mg | 3 | 60
Respiratory & Allergy | Salbutamol Nebuliser Solution 5mg/ml | 180 | 20
Respiratory & Allergy | Beclometasone Inhaler 100mcg | 650 | 10
Respiratory & Allergy | Budesonide/Formoterol Inhaler | 1800 | 5
Respiratory & Allergy | Ipratropium Nebuliser 250mcg | 150 | 15
Respiratory & Allergy | Montelukast 10mg | 45 | 30
Respiratory & Allergy | Cetirizine 10mg | 4 | 100
Respiratory & Allergy | Loratadine 10mg | 6 | 60
Respiratory & Allergy | Chlorpheniramine 4mg | 2 | 100
Respiratory & Allergy | Promethazine 25mg | 6 | 40
Respiratory & Allergy | Promethazine Syrup 5mg/5ml | 120 | 15
Respiratory & Allergy | Bromhexine Syrup 4mg/5ml | 150 | 20
Respiratory & Allergy | Cough Syrup (Expectorant) | 130 | 20
Gastrointestinal | Omeprazole 20mg | 12 | 80
Gastrointestinal | Esomeprazole 40mg | 35 | 30
Gastrointestinal | Pantoprazole 40mg | 30 | 40
Gastrointestinal | Famotidine 20mg | 10 | 30
Gastrointestinal | Antacid Suspension (Aluminium/Magnesium) | 130 | 20
Gastrointestinal | Metoclopramide 10mg | 4 | 60
Gastrointestinal | Metoclopramide Injection 10mg | 50 | 20
Gastrointestinal | Ondansetron 4mg | 20 | 40
Gastrointestinal | Ondansetron Injection 4mg | 90 | 20
Gastrointestinal | Domperidone 10mg | 8 | 40
Gastrointestinal | Hyoscine Butylbromide 10mg | 10 | 60
Gastrointestinal | Hyoscine Injection 20mg | 80 | 20
Gastrointestinal | Loperamide 2mg | 5 | 60
Gastrointestinal | ORS Sachets | 15 | 100
Gastrointestinal | Zinc 20mg | 7 | 60
Gastrointestinal | Lactulose Syrup | 450 | 10
Gastrointestinal | Bisacodyl 5mg | 4 | 40
Gastrointestinal | Simethicone 40mg | 8 | 40
Vitamins & Supplements | Folic Acid 5mg | 3 | 150
Vitamins & Supplements | Ferrous Sulphate | 5 | 100
Vitamins & Supplements | Ferrous Fumarate/Folic Acid | 8 | 100
Vitamins & Supplements | Vitamin C 500mg | 3 | 100
Vitamins & Supplements | Vitamin B Complex | 2 | 100
Vitamins & Supplements | Vitamin D3 1000IU | 12 | 40
Vitamins & Supplements | Vitamin A 200,000IU | 20 | 30
Vitamins & Supplements | Calcium 500mg + Vitamin D | 10 | 60
Vitamins & Supplements | Multivitamin | 5 | 100
Vitamins & Supplements | Cyanocobalamin Injection 1000mcg | 60 | 20
Vitamins & Supplements | Vitamin K Injection 10mg | 120 | 15
Skin & Topical | Hydrocortisone Cream | 180 | 25
Skin & Topical | Betamethasone Cream 0.1% | 180 | 20
Skin & Topical | Calamine Lotion | 150 | 20
Skin & Topical | Silver Sulfadiazine Cream 1% | 350 | 15
Skin & Topical | Mupirocin Ointment 2% | 420 | 10
Skin & Topical | Fusidic Acid Cream | 400 | 10
Skin & Topical | Benzyl Benzoate Lotion | 200 | 15
Skin & Topical | Permethrin Cream 5% | 450 | 10
Skin & Topical | Povidone Iodine 10% | 180 | 30
Skin & Topical | Zinc Oxide Ointment | 120 | 15
Eye, Ear & Nose | Chloramphenicol Eye Drops 0.5% | 120 | 20
Eye, Ear & Nose | Ciprofloxacin Eye Drops | 160 | 15
Eye, Ear & Nose | Tobramycin/Dexamethasone Eye Drops | 420 | 10
Eye, Ear & Nose | Artificial Tears | 350 | 10
Eye, Ear & Nose | Ciprofloxacin Ear Drops | 180 | 10
Eye, Ear & Nose | Xylometazoline Nasal Drops | 130 | 20
Eye, Ear & Nose | Normal Saline Nasal Drops | 100 | 20
Women's Health & Urology | Combined Oral Contraceptive | 150 | 30
Women's Health & Urology | Levonorgestrel 1.5mg | 250 | 20
Women's Health & Urology | Medroxyprogesterone Injection 150mg | 250 | 20
Women's Health & Urology | Oxytocin Injection 10IU | 100 | 30
Women's Health & Urology | Misoprostol 200mcg | 90 | 20
Women's Health & Urology | Magnesium Sulphate Injection 50% | 120 | 20
Women's Health & Urology | Tranexamic Acid Injection 500mg | 120 | 15
Women's Health & Urology | Norethisterone 5mg | 20 | 20
Women's Health & Urology | Clomiphene 50mg | 60 | 10
Women's Health & Urology | Tamsulosin 0.4mg | 35 | 20
Women's Health & Urology | Finasteride 5mg | 30 | 20
Neurology & Mental Health | Carbamazepine 200mg | 8 | 60
Neurology & Mental Health | Phenytoin 100mg | 8 | 60
Neurology & Mental Health | Sodium Valproate 200mg | 12 | 60
Neurology & Mental Health | Amitriptyline 25mg | 4 | 60
Neurology & Mental Health | Fluoxetine 20mg | 12 | 40
Neurology & Mental Health | Sertraline 50mg | 25 | 30
Neurology & Mental Health | Haloperidol 5mg | 8 | 30
Neurology & Mental Health | Risperidone 2mg | 25 | 30
Neurology & Mental Health | Chlorpromazine 100mg | 8 | 30
Neurology & Mental Health | Gabapentin 300mg | 25 | 40
Neurology & Mental Health | Cinnarizine 25mg | 5 | 40
Neurology & Mental Health | Betahistine 16mg | 15 | 30
Neurology & Mental Health | Sumatriptan 50mg | 90 | 10
IV Fluids & Emergency | Normal Saline 0.9% 500ml | 150 | 100
IV Fluids & Emergency | Normal Saline 0.9% 1L | 180 | 80
IV Fluids & Emergency | Ringer's Lactate 500ml | 150 | 100
IV Fluids & Emergency | Ringer's Lactate 1L | 180 | 80
IV Fluids & Emergency | Dextrose 5% 500ml | 150 | 60
IV Fluids & Emergency | Dextrose 10% 500ml | 170 | 30
IV Fluids & Emergency | Dextrose 50% Injection | 120 | 15
IV Fluids & Emergency | Water for Injection 10ml | 20 | 100
IV Fluids & Emergency | Potassium Chloride Injection | 150 | 10
IV Fluids & Emergency | Sodium Bicarbonate Injection 8.4% | 160 | 10
IV Fluids & Emergency | Calcium Gluconate Injection 10% | 140 | 10
IV Fluids & Emergency | Adrenaline Injection 1mg | 120 | 20
IV Fluids & Emergency | Atropine Injection 1mg | 80 | 15
IV Fluids & Emergency | Naloxone Injection 0.4mg | 450 | 5
IV Fluids & Emergency | Lidocaine 2% Injection | 60 | 30
IV Fluids & Emergency | Lidocaine Gel 2% | 250 | 15
IV Fluids & Emergency | Activated Charcoal | 300 | 5
Dental & Oral | Chlorhexidine Mouthwash 0.2% | 250 | 15
Dental & Oral | Lidocaine/Adrenaline Dental Cartridge | 90 | 30
`;

const MEDICINES = RAW.trim().split('\n').map((line) => {
  const [category, name, price, reorder] = line.split('|').map((x) => x.trim());
  return { category, name, unit_price: Number(price), reorder_level: Number(reorder) };
});

module.exports = { MEDICINES };
