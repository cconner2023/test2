export interface medListTypes {
    icon: string,
    text: string,
    indication: string,
    contra: string,
    moi: string,
    adult: string,
    peds: string,
    preg: pregType[],
    adverse: string,
    aviation: aviationType[]
}

export interface pregType {
    icon: string,
    text: string
}

export interface aviationType {
    icon: string,
    text: string,
}

export const medList: medListTypes[] = [
    // index 0
    {
        icon: "Tylenol",
        text: "Acetaminophen",
        indication: "Pain or Fever",
        contra: "Hypersensitivity to acetaminophen or any component of the formulation; Hepatic impairment or liver disease",
        moi: "Analgesic effect believed to be related to serotonergic inhibitory pathways in the CNS; Antipyresis from inhibition of the hypothalamic heat-regulating center",
        adult: "325mg PO: Take 2 tabs every 6 hr daily as needed for fever or pain (Maximum 2.6g in 24hrs); 235-650mg PO: Every 4-6 hr or 1000mg 3-4 times daily (Maximum 4g in 24hrs)",
        peds: "15mg/kg/dose: Every 4-6 hr as needed (Maximum 2.6g in 24 hrs)",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Avoid use in patient suffering alcohol toxicity, known alcohol abuse, or renal impairment; Nausea, vomiting; G6PD deficiency",
        aviation: [
            {
                icon: "Class 1",
                text: "when used infrequently or in low dosage"
            }
        ]
    },
    // index 1
    {
        icon: "Acetasol HC",
        text: "Acetic Acid/Hydrocortisone",
        indication: "Otitis Externa",
        contra: "Hypersensitivity to acetic acid, propylene glycol, hydrocortisone or any components of the formulation; Perforated tympanic membrane; HSV or varicella infection; Local reaction/ irritation develops",
        moi: "Acetic acid has bacteriostatic and fungistatic properties; Hydrocortisone has anti-inflammatory, anti-pruritic, and vasoconstrictive properties; Hydrocortisone induces phospholipase A2 inhibitory proteins and inhibits the release of arachidonic acid decreasing the mediators of inflammation",
        adult: "ADTMC PREFERRED: AA2%, HC1% Otic: 5 drops in affected ear(s) every 6 hours; >3 years old: 3-5 drops in affected ear every 4-6 hrs while cotton wick inserted (24 hrs); 5 drops in affected ear every 6-8 hrs daily after 24 hours",
        peds: "None. >3 years old use adult dosing",
        preg: [
            {
                icon: "Class C",
                text: "Potential for Harm"
            }
        ],
        adverse: "Stinging of ear, burning sensation; Local irritation",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 2
    {
        icon: "Aspirin, Bayer",
        text: "Aspirin",
        indication: "Acute Coronary Syndrome; Unstable Angina; Non-ST Segment Elevated Myocardial Infarction",
        contra: "Hypersensitivity to salicylates, other NSAIDs, or any component of the formulation; Asthma, Rhinitis; History of stomach ulcer, bleeding problem, black or bloody stools; Children recovering from chickenpox or flu-like symptoms due to risk of Reye syndrome",
        moi: "Blocks cyclooxygenase (COX 1 and 2) enzymes, resulting in reduced formation of prostaglandin precursors; Blocks formation of prostaglandin derivative, thromboxane A2, resulting in inhibited platelet aggregation; Antipyretic, analgesic, and anti-inflammatory properties",
        adult: "81mg PO: Chew 4 nonenteric coated baby aspirin in a single dose (4 x 81mg)",
        peds: "N/A",
        preg: [
            {
                icon: "Class D",
                text: "Unsafe"
            }
        ],
        adverse: "Not for use on trauma patients in the combat environment; Risk of bleeding: Avoid use in patients with known or suspected, Bleeding disorders, GI Bleed, GI Ulcers, patients taking Coumadin, or within 24hrs of taking Alteplase (tPA) for suspected stroke",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 3
    {
        icon: "Differin Cream, 0.1% Gel is OTC",
        text: "Adapalene",
        indication: "Acne",
        contra: "Hypersensitivity to adapalene or any component of the formulation; Not approved for children under 12 years old; Avoid contact with mucous membranes (eyes, nose, mouth, vaginal, and anal mucosa); Avoid contact with broken, eczematous, or sunburned skin",
        moi: "Modulates cellular differentiation, keratinization, and the inflammatory process",
        adult: "0.1% Topical: Apply a thin film once daily at bedtime (nickel size amount for entire face); 0.1-0.3% Topical: Apply a thin film once daily at bedtime",
        peds: "N/A",
        preg: [
            {
                icon: "Class C",
                text: "Potential Harm"
            }
        ],
        adverse: "Dry skin, redness, burning or stinging of the skin, skin peeling; Skin itching; Increased susceptibility to sunburn",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 4
    {
        icon: "Proventil, Ventolin",
        text: "Albuterol",
        indication: "Bronchospasm",
        contra: "Hypersensitivity to albuterol or any component of the formulation; Symptomatic tachycardia",
        moi: "Beta2 Agonist (Bronchodilator); Synthetic sympathomimetic that relaxes bronchial smooth muscle, causing bronchodilation, with little cardiac impact",
        adult: "90 mcg/puff inhaler: 2 puffs every 6 hours as needed; 5.0mg Nebulizer: Every 6 hours as needed; 90mcg/puff inhaler: 4 puffs every 20min for up to 4hr then every 2hr as needed; 2.5-5.0mg Nebulizer: Every 20 min for 3 doses; then 2.5-10mg every 1-4 hrs as needed OR 10-15mg/hour continuous",
        peds: "90 mcg/puff inhaler: 4 puffs every 20 min for 3 doses; then every 1-4 hr as needed; 2.5-5.0mg Nebulizer: Every 4-8 hours as needed; 90mcg/puff inhaler: 4 puffs every 20min for 3 doses then every 1-4 hr as needed; 2.5-5.0mg Nebulizer: Every 20 min for 3 doses; then 0.15-0.3mg/kg every 1-4 hrs as needed (Maximum: 10mg) OR 0.5mg/kg/hour continuous",
        preg: [
            {
                icon: "Class C",
                text: "Uncertain safety"
            }
        ],
        adverse: "Risk of abortion during 1st or 2nd trimester; Headache, Dizziness, Flushing, Diaphoresis, Tremor, Weakness, Angina, A-Fib, Arrhythmia, Chest pain, Palpitations, Dyspnea, Bronchospasm in asthmatics",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 5
    {
        icon: "Domeboro's Solution, Boro-packs, Pedi-Boro",
        text: "Aluminum Acetate",
        indication: "Contact Dermatitis; Skin Irritation",
        contra: "Hypersensitivity to aluminum acetate or any component of the formulation",
        moi: "Astringent properties to relieve itching",
        adult: "1 packet topical: 1 packet/ 16 ounces water. Soak area or apply compress for 30 minutes. Repeat every 8 hours as needed. (1 Boro-Pack = 0.16%); 1 soak topical: Soak area every 8 hours as needed. Apply compress for 15-30 min as needed for itching. 1-3 packets/16 ounces water (depending on brand)",
        peds: "1-3 pkts topical: 1 packet/ 16 ounces water. Soak area every 8 hours as needed. Compress x 15-30 minutes as needed for itching (1 Boro-Pack = 0.13%)",
        preg: [
            {
                icon: "Unknown",
                text: ""
            }
        ],
        adverse: "Irritation or Rash; Avoid contact with eyes, mucous membranes",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 6
    {
        icon: "Zithromax",
        text: "Azithromycin",
        indication: "Cervicitis empiric therapy; Urethritis empiric therapy; Chlamydia trachomatis; Gonococcal infection",
        contra: "Hypersensitivity to azithromycin, erythromycin, other macrolide antibiotics or any component of the formulation; QT interval prolongation or history of arrhythmias; Liver Disease or Severe Renal Impairment",
        moi: "Macrolide Antibiotic; Inhibits RNA-dependent protein synthesis in susceptible organisms",
        adult: "1g PO: Give one dose and observe while it is being taken (Give with Ceftriaxone)",
        peds: "1g PO: if > 45.5kg 1g as single dose",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Diarrhea, nausea/ vomiting, GI upset",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 7
    {
        icon: "Baciguent",
        text: "Bacitracin",
        indication: "Skin infection; Cut, abrasion; Blister; Burn",
        contra: "Hypersensitivity to bacitracin or any component of the formulation",
        moi: "Inhibits bacterial cell wall synthesis by preventing the transfer of mucopeptides into the growing bacterial cell wall; Maintains a moist environment allowing for skin growth and repair",
        adult: "500 units/g Topical: Apply ointment 2-3 times per day to protect skin and help it heal; 500 units/g Topical: Apply 1-3 times per day",
        peds: "500 units/g Topical: Apply 1-3 times per day",
        preg: [
            {
                icon: "Considered Safe",
                text: ""
            }
        ],
        adverse: "Limit use to 1 week. If condition remains after 1 week, Soldier should be seen by a provider",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 8
    {
        icon: "Cepacol Lozenge",
        text: "Benzocaine",
        indication: "Sore Throat; Mouth Irritation",
        contra: "Hypersensitivity to benzocaine, para-aminobenzoic acid (PABA), or any component of the formulation; Children <5 years old, asthma, G6PD Deficiency due to risk of methemoglobinemia",
        moi: "Blocks the initiation and conduction of nerve impulses; Decreases the neuronal membrane's sodium ion permeability",
        adult: "1 lozenge PO: Allow 1 lozenge to dissolve slowly in mouth every 2 hours as needed; 1 Lozenge PO: Every 2 hours as needed for sore throat",
        peds: ">5 years old: Refer to Adult Dosing",
        preg: [
            {
                icon: "Presumed Safe",
                text: ""
            }
        ],
        adverse: "Methemoglobinemia: blue lips/ nails, dizziness, headache, lethargy, shortness of breath",
        aviation: [
            {
                icon: "Acceptable",
                text: "provided the lozenge contains no prohibited medication. Benzocaine (or similar analgesic) containing throat spray or lozenge is acceptable. Long term use (more than 3 days) must be approved by the local flight surgeon"
            }
        ]
    },
    // index 9
    {
        icon: "Acne-Clear, Acne Treatment",
        text: "Benzoyl Peroxide",
        indication: "Acne",
        contra: "Hypersensitivity to benzoyl peroxide or any other component of the formulation; Development of hives, itching, or signs of allergic reaction after use; Development of severe skin irritation after use",
        moi: "Release of free radical oxygen which oxidizes bacterial proteins; Decreases number of anaerobic bacteria and irritating free fatty acids",
        adult: "10% cream, gel topical: Apply to the affected area once a day in the morning for acne; 2-10% Topical: Start daily and titrate up to 2-3/day as needed",
        peds: "N/A",
        preg: [
            {
                icon: "Class C",
                text: "Potential Risk"
            }
        ],
        adverse: "Skin irritation, dry skin, skin peeling; Bleach hair, colored fabric; Combination with Dapsone may cause skin/ hair to turn a yellow/orange/tan color",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 10
    {
        icon: "Dulcolax",
        text: "Bisacodyl",
        indication: "Constipation",
        contra: "Hypersensitivity to bisacodyl or any of its components; Signs of intestinal obstruction or bowel perforation: nausea, vomiting, pain, distension, abdominal rigidity",
        moi: "Stimulated peristalsis by irritating the smooth muscles of the intestines and increases fluid accumulation in the intestines",
        adult: "5mg PO: Take 1-2 tabs daily (Maximum: 1 week use); 5mg PO: Take 1-3 tabs daily",
        peds: "6-11 years old: 5mg daily",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Abdominal cramps, Abdominal pain, nausea, vomiting, headache; Do Not take within 1 hour of antacids, milk, or dairy products; Swallow the tab whole",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 11
    {
        icon: "Maalox, Pepto-Bismol",
        text: "Bismuth Subsalicylate",
        indication: "Diarrhea; Indigestion",
        contra: "Hypersensitivity to salicylates or taking other salicylates; History of stomach ulcer, bleeding problem, black or bloody stools; Children recovering from chickenpox or flu-like symptoms due to risk of Reye syndrome",
        moi: "Salicylate has an antisecretory action; Bismuth has an antimicrobial activity against bacterial and viral gastrointestinal pathogens",
        adult: "262mg/15mL PO: Take 30mL every hour as needed for up to 2 days (Maximum: 8 doses/24 hours); 524mg PO: Take 1 dose every 30 minutes as needed (Maximum: 4,200mg or 8 doses)",
        peds: "N/A",
        preg: [
            {
                icon: "Unsafe",
                text: ""
            }
        ],
        adverse: "Anxiety, confusion, tinnitus; Shake well prior to use (liquid), chew tablets well before swallowing (chewable tablets); Can turn stools or tongue black",
        aviation: [
            {
                icon: "Antacid (Maalox): Class 3",
                text: "When used occasionally or infrequently. Chronic use is Class 3"
            },
            {
                icon: "Pepto Bismol: Acceptable",
                text: "If used for minor diarrhea conditions and free of side effects for 24 hours"
            }
        ]
    },
    // index 12
    {
        icon: "Caladryl, Calagesic",
        text: "Calamine/Zinc Oxide",
        indication: "Contact Dermatitis; Insect Bite",
        contra: "Hypersensitivity to Calamine, zinc oxide, or any of its components; Children less than 2 unless prescribed by a provider",
        moi: "Astringent and skin protectant properties to relieve itching",
        adult: "Dab Topical: Clean and dry area. Cover affected area and let dry. Repeat every 6 hours as needed for itching; Dab Topical: Apply as often as needed for itching",
        peds: "Dab Topical: Apply to the affected area every 6 hours as needed for itching",
        preg: [
            {
                icon: "Presumed Safe",
                text: ""
            }
        ],
        adverse: "Hives, Irritation, Allergic Reaction; Shake well before use; Avoid contact with eyes, mucous membranes, burns, or open wounds",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 13
    {
        icon: "Rocephin",
        text: "Ceftriaxone",
        indication: "Cervicitis empiric therapy; Urethritis empiric therapy; Chlamydia trachomatis; Gonococcal infection",
        contra: "Hypersensitivity to ceftriaxone, penicillin, or beta-lactam antibiotics; Do NOT use with neonates due to risk of hyperbilirubinemia; Do NOT use with calcium-containing solutions due to causing calcium-ceftriaxone precipitates",
        moi: "3rd Generation Cephalosporin; Inhibits bacterial cell wall synthesis; Bacteria eventually lyse due to cell wall autolytic enzyme activity without concomitant synthesis activity",
        adult: "250mg IM: Inject into a large muscle mass (gluteus) one time (Dilute with sterile water or 1% lidocaine); 250-500mg IM: One time injection (-250mg for initial therapy -500mg if failed initial therapy)",
        peds: "50mg/kg IM/IV: Disseminated infection <45kg Daily for 7 days (Max dose: 1,000mg); 1,000mg IM/IV: Disseminated, >45kg 1,000mg daily for 7 days",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Induration or warm sensation at injection site; Rash or Diarrhea; Pancreatitis, Hemolytic anemia, Elevated INR",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 14
    {
        icon: "Benadryl",
        text: "Diphenhydramine",
        indication: "Allergies; Hives; Motion Sickness; Anaphylactic Reaction",
        contra: "Hypersensitivity to diphenhydramine or any component of the formulation; Acute Asthma; Use on Neonates, premature infants, Nursing mothers",
        moi: "Competes with histamine for H1-receptor sites within the gastrointestinal tract, blood vessels, and respiratory tract; Produces anticholinergic and sedative effects",
        adult: "25mg PO: Take 1 tablet every 8 hrs or at bedtime; 50mg IV: ASAP after epinephrine auto-injector 50mg IV over 10minutes (Maximum: 300mg in 24hrs)",
        peds: "1.25 mg/kg PO/IM: 2-5y/o 6.25mg every 6 hrs; 1.25 mg/kg PO/IM: 6-12 y/o 12.5-25mg every 6 hrs; 1.25 mg/kg IV: ASAP after 0.15mg IM epinephrine (Maximum: 50mg dose)",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Normally causes sedation, but may cause paradoxical excitation; May have increased sedative effects when used with other sedatives or alcohol; May cause hypotension (use with caution in patient with cardiovascular disease); Dry mouth and may increase risk of heat injury",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 15
    {
        icon: "Colace",
        text: "Docusate Sodium",
        indication: "Constipation; Hemorrhoids; Anal Fissure",
        contra: "Hypersensitivity to docusate sodium or any component of the formulation; Children under the age of 2",
        moi: "Reduces surface tension of stool resulting in increased absorption of water and fat into stool",
        adult: "100mg PO: Take 1 capsule twice a day (Maximum: 7 days of use); 50-360mg PO: 50-360mg daily or in divided doses",
        peds: "50-150mg PO: Once daily or in divided doses",
        preg: [
            {
                icon: "Not Preferred",
                text: ""
            }
        ],
        adverse: "Ensure adequate fluid intake",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 16
    {
        icon: "Aoxa, Vibramycine",
        text: "Doxycycline",
        indication: "Acne; Malaria chemoprophylaxis; Cellulitis",
        contra: "Hypersensitivity to doxycycline, other tetracyclines, or any component of the formulation",
        moi: "Tetracycline Antibiotic; Inhibits protein synthesis of ribosomal subunits of susceptible bacteria",
        adult: "100mg PO (Acne): 100mg daily (used with topical agents); 100mg PO (Malaria chemoprophylaxis): 100mg daily, start 2 days before leaving; 100mg PO (Bite): 100mg Every 12 hrs x 3-5 days; 100mg PO (Cellulitis): 100mg Every 12 hrs x 7-14 days; 100mg PO (Lyme): 100mg Every 12 hrs x 10-28 days",
        peds: "< 45kg, 2-4mg/kg/day PO: 2-4mg/kg/day in 1-2 divided doses (maximum: 200mg/day); >45kg, 100mg PO: Refer to adult dosing",
        preg: [
            {
                icon: "Class D",
                text: "Unsafe"
            }
        ],
        adverse: "Take medication with food or 8oz water and sit-up for 30minutes after taking (prevent esophagitis); Photosensitivity with increased risk of sunburn; Diarrhea, Severe skin reactions, Liver toxicity, Intracranial hypertension (blurry vision, headache, double vision)",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 17
    {
        icon: "EpiPen",
        text: "Epinephrine",
        indication: "Anaphylactic Reaction",
        contra: "Uncontrolled hypertension is a relative contraindication in more mild reactions",
        moi: "Sympathomimetic, stimulates both alpha and beta adrenergic receptors, causing relaxation of the bronchial tree, cardiac stimulation (increasing myocardial oxygen consumption), and dilation of skeletal muscle blood vessels",
        adult: "1 EpiPen IM: Inject 1 epi pen into thigh and may repeat in 10 min if not improved; follow with diphenhydramine 50 mg IV and transport to emergency care; 0.3-0.5mg IM/IV: Every 5-15 min until improvement; follow with diphenhydramine 50 mg IV",
        peds: "0.01mg/kg IM: 0.01 mg/ kg of 1 mg/ mL dose follow with diphenhydramine 1.25 mg/ kg IV and transport to emergency care (Maximum single dose: 0.3 mg)",
        preg: [
            {
                icon: "Class C",
                text: "Unknown Safety"
            }
        ],
        adverse: "Chest Pain, Tachycardia, Arrhythmias, Palpitations, Sudden death; Anxiety, Cerebral Hemorrhage, Headache",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 18
    {
        icon: "Diflucan",
        text: "Fluconazole",
        indication: "Vaginal Yeast Infection",
        contra: "Hypersensitivity to fluconazole or any component of the formulation; QTc Prolongation, Heart Arrhythmia",
        moi: "Antifungal; Interferes with fungal cytochrome P450 activity inhibiting cell membrane formation",
        adult: "150mg PO: Take 1 tab by mouth one time; 150mg PO (Severe): 150 mg every 72 hrs for 2-3 doses; 150mg PO (Recurrent): 150 mg daily x 10-14 days, then 150 mg weekly x 6 months",
        peds: "N/A",
        preg: [
            {
                icon: "Unsafe",
                text: ""
            }
        ],
        adverse: "Dizziness or Seizures; Hepatotoxicity",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 19
    {
        icon: "GlucaGen/ Glucagon Emergency Kit",
        text: "Glucagon",
        indication: "Esophageal Food Impaction; Hypoglycemia",
        contra: "Hypersensitivity to glucagon or any component of the formulation; Insulinoma; Pheochromocytoma",
        moi: "Raises blood glucose levels by stimulating increased production of cyclic AMP; Promotes hepatic gluconeogenesis",
        adult: "1mg IV: Inject 1 mg IV with 10 cc Normal Saline flush (For Hypoglycemia, follow with Dextrose IV and may repeat once in 20 minutes); 1mg IM/IV: Every 20 minutes as needed (Hypoglycemia, give IV dextrose ASAP)",
        peds: "(<20kg) 0.5mg IV/IM: Every 20 min as needed (Adult dosing if over 20 kg)",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Should NOT be used as 1st line treatment for Hypoglycemia, AMS, or Food Bolus Impaction; Hypoglycemia patients should receive dextrose. If IV access cannot be established or if dextrose is not available, glucagon may be used as alternate until dextrose can be given; Thiamine should precede use in patient with suspected alcoholism or malnutrition",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 20
    {
        icon: "Mucinex Childrens, Robitussin, Tussin",
        text: "Guaifenesin",
        indication: "Cough",
        contra: "Hypersensitivity to guaifenesin or any component of the formulation; Do Not use extended release tablets in children under 12 years old; Chronic cough productive for phlegm",
        moi: "Increase the hydration of the respiratory tract, thus decreasing viscosity of respiratory mucous; Inhibits the cough reflex sensitivity in subjects with upper respiratory tract infections",
        adult: "100mg / 5ml PO: 1 tablespoon (15mL) every 6 hours as needed for excess mucous (Max: 8 tablespoons/24 hours); 600mg PO: 1-2 tabs every 12 hours as needed for excess mucous (Max: 2400 mg/24 hours)",
        peds: "2-3 y/o: 50-100mg PO: 50mg every 4 hr as needed; 4-5 y/o: 100mg every 4 hrs as needed (Maximum: 600mg / 24hrs)",
        preg: [
            {
                icon: "Presumed Safe",
                text: ""
            }
        ],
        adverse: "Dizziness, drowsiness",
        aviation: [
            {
                icon: "Must just be guaifenesin",
                text: "Many OTC cough syrups contain sedating antihistamines or Dextromethorphan (DM) and are prohibited for aviation duty"
            }
        ]
    },
    // index 21
    {
        icon: "Westcort Cream",
        text: "Hydrocortisone",
        indication: "Irritant Dermatitis; Contact Dermatitis; Skin Inflammation/ Irritation",
        contra: "Hypersensitivity to hydrocortisone or any component of its formulation; OTC hydrocortisone is not labeled for use in children under 2 years old; Diffuse areas larger than patient's hands, occlusive dressing, heating source can result in increased doses; Adrenal suppression can progress to adrenal crisis",
        moi: "Anti-inflammatory, anti-pruritic, and vasoconstrictive properties; Induces phospholipase A2 inhibitory proteins and inhibits the release of arachidonic acid decreasing the mediators of inflammation",
        adult: "1% Topical: Apply a thin film twice a day as needed for itching or inflammation (Max: 2 weeks); 1% Topical: Apply a thin film 2-3 time per day as needed for itching or inflammation",
        peds: ">2 years old: 1% Topical. Apply a thin film twice a day as needed for itching or inflammation",
        preg: [
            {
                icon: "Class C",
                text: "Potential for Harm"
            }
        ],
        adverse: "Skin atrophy, atrophic striae, hypopigmentation, burning sensation; Secondary skin infection",
        aviation: [
            {
                icon: "N/A",
                text: ""
            }
        ]
    },
    // index 22
    {
        icon: "Analpram- HC",
        text: "Hydrocortisone/Pramoxine",
        indication: "Hemorrhoid; Anal Itching",
        contra: "Hypersensitivity to hydrocortisone, pramoxine, or any component of the formulation; Caution when used in patients with heart disease or diabetes; Not approved for use in children <12 years old; Adrenal suppression can progress to adrenal crisis",
        moi: "Hydrocortisone has anti-inflammatory, anti-pruritic, and vasoconstrictive properties; Pramoxine is an anesthetic that interferes with pain signals sent from the nerves to the brain",
        adult: "1 dab Topical: Apply to clean, dry area 4 times/ day (Maximum: 1 week)",
        peds: "N/A",
        preg: [
            {
                icon: "Class C",
                text: "Potential for Harm (Hydrocortisone)"
            }
        ],
        adverse: "Skin atrophy, atrophic striae, hypopigmentation, burning sensation; Secondary skin infection",
        aviation: [
            {
                icon: "N/A",
                text: ""
            }
        ]
    },
    // index 23
    {
        icon: "Motrin, Advil",
        text: "Ibuprofen",
        indication: "Pain; Osteoarthritis; Rheumatoid Arthritis; Antipyretic",
        contra: "Hypersensitivity to ibuprofen or any component of the formulation; History of asthma, urticarial, or allergic-type reaction to aspirin or other NSAIDs; Aspirin triad (bronchial asthma, aspirin intolerance, rhinitis); Use in the setting of coronary artery bypass graft (CABG) surgery or gastrointestinal bleeding",
        moi: "Reversibly inhibits cyclooxygenase-1 and 2 (COX-1 and 2) enzymes, which results in decreased formation of prostaglandin precursors; Has antipyretic, analgesic, and anti-inflammatory properties",
        adult: "200mg PO: Take 2 tabs every 6 hours as needed for pain (Maximum: 1600 mg/ day); 200-800mg PO: Every 6 hours as needed (Maximum: 3200 mg/day)",
        peds: "10mg/kg/dose: Every 6 - 8 hrs as needed (Maximum single dose: 400 mg)",
        preg: [
            {
                icon: "Class C",
                text: "Avoid 1st, 3rd Trimester"
            }
        ],
        adverse: "Dizziness, headache, and tinnitus; Skin rash, itching; Epigastric pain, heartburn, and nausea",
        aviation: [
            {
                icon: "N/A",
                text: ""
            }
        ]
    },
    // index 24
    {
        icon: "Toradol",
        text: "Ketorolac",
        indication: "Moderate Pain",
        contra: "Hypersensitivity to ketorolac, aspirin, other NSAIDs or any component of the formulation; History of CABG, cardiovascular disease, gastrointestinal bleeding, cerebrovascular bleeding, or bleeding risk; History of asthma, urticarial, or allergic-type reaction to aspirin or other NSAIDs; Aspirin triad (bronchial asthma, aspirin intolerance, rhinitis); Renal disease or volume depletion, receiving other NSAIDs or aspirin; During labor and delivery",
        moi: "Inhibits cyclooxygenase-1 and 2 (COX-1 and 2) enzymes; Has antipyretic, analgesic, and anti-inflammatory properties",
        adult: "30mg IM: Inject one dose at presentation if needed for moderate pain; 30mg IM/IV: 30-60mg IM or 30mg IV every 6 hours as needed (Maximum: 120mg /day, 5 days total)",
        peds: "N/A",
        preg: [
            {
                icon: "Class C",
                text: "Unsafe"
            }
        ],
        adverse: "Headache; Gastrointestinal pain, heartburn, nausea; Drowsiness, dizziness, blurred vision",
        aviation: [
            {
                icon: "N/A",
                text: ""
            }
        ]
    },
    // index 25
    {
        icon: "Viscous Lidocaine 2%",
        text: "Lidocaine",
        indication: "Severe Sore Throat; Mouth Sores",
        contra: "Hypersensitivity to lidocaine to any component of the formulation; Do not use for teething in children. Seizures and death reported in children when not administered by strict adherence to dosing recommendations",
        moi: "Blocks the conduction of nerve impulses by decreasing the neuronal membrane's permeability to sodium ions, resulting in inhibition of depolarization and blockage of conduction",
        adult: "15mL PO: Swish and spit every 6 hours as needed for pain (Maximum: 4 doses/24hrs)",
        peds: "<1.2mL PO: Every 3 hours with cotton applicator (Maximum: 4 doses/ 12 hours); 4.5mg/kg: PO Every 3 hours swish and spit as needed. Do not swallow. (Maximum: 300mg/ dose, 4 doses/ 12 hours)",
        preg: [
            {
                icon: "Class B",
                text: "Limited Risk"
            }
        ],
        adverse: "Severely traumatized mucosa increases the risk of rapid systemic absorption; May impair swallowing and increase aspiration risk. Avoid food for 60min after use; Tongue/ buccal biting after use",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 26
    {
        icon: "Imodium",
        text: "Loperamide",
        indication: "Diarrhea",
        contra: "Hypersensitivity to loperamide or any component of the formulation; Doses higher than recommended can cause heart arrhythmia (Torsades de Pointes) and death; Children under 2 years of age; Dysentery, abdominal pain, ulcerative colitis, bacterial enterocolitis, antibiotic associated diarrhea",
        moi: "Anti-diarrheal; Inhibits peristalsis of intestinal muscles resulting in prolonged stool transit time and increased stool viscosity",
        adult: "2mg PO: Take 2 tabs and then 1 tab after each loose stool as needed (Maximum: 8 mg/ 4 tabs)",
        peds: "2-5 yrs (13-20 kg): 1 mg three times per day; 6-8 yrs (20-30 kg): 2 mg twice a day; 8-12 yrs (>30 kg): 2 mg three times per day",
        preg: [
            {
                icon: "Class C",
                text: "Potential Harm"
            }
        ],
        adverse: "Constipation, abdominal cramps, nausea; Dizziness, drowsiness",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 27
    {
        icon: "Claritin",
        text: "Loratadine",
        indication: "Seasonal Allergies; Hives",
        contra: "Hypersensitivity to loratadine or any component of the formulation",
        moi: "Competes with histamine for H1-receptor sites within the gastrointestinal tract, blood vessels, and respiratory tract; Second Generation, Less sedating than First Generation (diphenhydramine)",
        adult: "10mg PO: Take 1 tab daily for allergies",
        peds: "2-5 y/o: 5 mg PO once daily for allergies; 6+ y/o: use adult dosing",
        preg: [
            {
                icon: "Presumed Safe",
                text: ""
            }
        ],
        adverse: "Headache; Sedation and may have increased sedative effects when used with other sedatives or alcohol; In breast fed infant, monitor for drowsiness, irritability, agitation; May increase risk of heat injury",
        aviation: [
            {
                icon: "Short term use authorized",
                text: "aircrew member must report use of this medication to the FS/APA as soon as possible"
            }
        ]
    },
    // index 28
    {
        icon: "BenGay, Icy Hot",
        text: "Menthol",
        indication: "Pain, Muscle Soreness",
        contra: "Hypersensitivity to aspirin, NSAIDS, menthol or any component of the formulation; Signs or symptoms of pain, swelling, blistering after application",
        moi: "Analgesic and anti-inflammatory properties",
        adult: "Balm Topical: Apply every 6-8 hours as needed for muscle soreness; 1.5% menthol patch: Every 6-8 hrs as needed for pain (Do not leave in place for over 8 hrs); 3% Menthol Patch: Every 8-12 hours as needed for pain (Maximum: 2 uses/ day x 3 days)",
        peds: "None",
        preg: [
            {
                icon: "Do Not use",
                text: "in last 3 months of pregnancy"
            }
        ],
        adverse: "Do not apply to wounds, rashes, damaged skin, mucous membranes, or right after bathing; Do not use a heating pad after application; Can cause chemical burns at application site",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 29
    {
        icon: "Flagyl",
        text: "Metronidazole",
        indication: "Bacterial Vaginosis",
        contra: "Do Not use alcohol when taking or within 3 days of taking. Can cause disulfiram-like reaction (flushing, tachycardia, nausea, vomiting); Do not take during 1st Trimester of pregnancy; History of seizures",
        moi: "Cytotoxic to anaerobic bacteria; Disrupts DNA structure resulting in DNA strand breakage and inhibition of protein synthesis with resulting cell death in susceptible organisms",
        adult: "250mg PO: Take 2 tabs twice a day for 7 days; 250-1000mg PO: Different conditions: 250-1000 mg 2-4 times/ day",
        peds: "30-50mg/kg PO: Divided over 3 doses (Maximum: 2,250 mg/ day)",
        preg: [
            {
                icon: "Class B",
                text: "Not in 1st Trimester"
            }
        ],
        adverse: "GI: nausea, vomiting, diarrhea, constipation, stomach cramps, anorexia; Neuropathic: neuropathy, confusion, dizziness, metallic taste, headache",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 30
    {
        icon: "Aleve, Naprosyn",
        text: "Naproxen",
        indication: "Pain Osteoarthritis; Gout; Primary Dysmenorrhea",
        contra: "Hypersensitivity to naproxen or any component of the formulation; History of asthma, uricarial, or allergic-type reaction to aspirin or other NSAIDs; Aspirin triad (bronchial asthma, aspirin intolerance, rhinitis); Use in the setting of coronary artery bypass graft (CABG) surgery, kidney disease, or gastrointestinal bleeding",
        moi: "Reversibly inhibits cyclooxygenase-1 and 2 (COX-1 and 2) enzymes, which results in decreased formation of prostaglandin precursors; Has antipyretic, analgesic, and anti-inflammatory properties",
        adult: "ADTMC Preferred: 250mg PO: Take 1 tab every 12 hrs as needed for pain (Maximum: 500 mg/ day); 250-500mg PO: Every 12 hours as needed (Maximum: 1000 mg/ day)",
        peds: "Every 12 hours as needed (Maximum: 10 mg/ kg/ day)",
        preg: [
            {
                icon: "Avoid",
                text: "1st, 3rd Trimester"
            }
        ],
        adverse: "Dizziness, drowsiness, headache, and tinnitus; Skin rash, itching; Epigastric pain, heartburn, nausea, constipation",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 31
    {
        icon: "Macrobid",
        text: "Nitrofurantoin",
        indication: "Urinary Tract Infection",
        contra: "Hypersensitivity to Nitrofurantoin or any component of the formulation; Pregnancy close to term/ delivery and neonates due to risk of hemolytic anemia; Renal impairment (anuria, oliguria), history of cholestatic jaundice or hepatic dysfunction from previous use",
        moi: "Antibiotic; Alter bacterial ribosomal proteins inhibiting protein synthesis, aerobic energy metabolism, and cell wall synthesis",
        adult: "ADTMC PREFERRED: 100mg PO: Take 1 capsule twice a day for 5 days; Nitrofurantoin monohydrate: 100 mg every 12 hrs x 5 days; Nitrofurantoin macrocrystals: 50-100 mg every 6hrs x 7 days; UTI prophylaxis: 50-100 mg daily at Bedtime",
        peds: "6-7mg/kg/day PO: Nitrofurantoin macrocrystals: Divide in 4 doses (every 6 hrs) x 7 days (max: 400 mg /day)",
        preg: [
            {
                icon: "Class B",
                text: "Not at Term"
            }
        ],
        adverse: "Liver failure, Peripheral neuropathy, Pulmonary toxicity",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 32
    {
        icon: "Afrin",
        text: "Oxymetazoline",
        indication: "Nasal Congestion; Nosebleed",
        contra: "Hypersensitivity to oxymetazoline or any component of its formulation; Child 5 years old or younger- ingestion can cause coma, bradycardia, respiratory depression, sedation",
        moi: "Stimulates alpha-adrenergic receptors causing vasoconstriction",
        adult: "0.05% Nasal Spray: 2 sprays in affected side twice a day for 3 days (Max: 2 doses/ 24 hours)",
        peds: "None. > 6 refer to adult dosing",
        preg: [
            {
                icon: "Unknown",
                text: "Chronic Use Unsafe"
            }
        ],
        adverse: "Rebound nasal congestion from use >3 days; Nasal irritation, burning",
        aviation: [
            {
                icon: "Restricted",
                text: "to no more than 3 days. Use of oxymetazoline for longer than the above time must be validated and approved by a flight surgeon"
            }
        ]
    },
    // index 33
    {
        icon: "Nix",
        text: "Permethrin",
        indication: "Head Lice; Pubic Lice",
        contra: "Hypersensitivity to any pyrethrin or pyrethroid, or any component of the formulation; Do Not come in contact with mucosal surfaces (eyes, inside nose, mouth, ear, or vagina); Ragweed allergy- consult provider because can cause difficulty breathing",
        moi: "Antiparasitic Agent; Inhibits sodium membrane channels in parasites resulting in paralysis and death",
        adult: "1% Topical: Head Lice, leave on 10 min then rinse. Remove nits with comb. Repeat in 7 days; Pubic Lice- 1%, leave on 10 min then rinse",
        peds: "None. > 2 months old adult dosing",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Skin irritation; Localized numbness, tingling",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 34
    {
        icon: "Elimite",
        text: "Permethrin",
        indication: "Scabies",
        contra: "Hypersensitivity to any pyrethrin or pyrethroid, or any component of the formulation; Do Not come in contact with mucosal surfaces (eyes, inside nose, mouth, ear, or vagina); Ragweed allergy- consult provider because can cause difficulty breathing",
        moi: "Antiparasitic Agent; Inhibits sodium membrane channels in parasites resulting in paralysis and death",
        adult: "Scabies- 5%, apply 30 g from head to soles, leave on 8-14 hrs then rinse. May repeat in 14 days",
        peds: "None. >2 months old, adult dosing",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Skin irritation; Localized numbness, tingling",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 35
    {
        icon: "Pyridium",
        text: "Phenazopyridine",
        indication: "Dysuria",
        contra: "Hypersensitivity to phenazopyridine or any component of the formulation; Discontinue if skin or sclera develop a yellow color; Kidney Disease/ Renal Impairment; G6PD deficiency",
        moi: "An azo dye that is excreted in the urine and has analgesic effect on urinary tract mucosa; Unknown mechanism",
        adult: "100mg PO: Take 2 tabs every 8 hours after meals as needed for pain with urination; Use with an antibiotic (Maximum: 600 mg per day for 2 days)",
        peds: "None",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Headache, Dizziness; Stomach Cramps; Discolor urine, fabric or clothing, contacts (if touching after touching tablets)",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 36
    {
        icon: "Miralax",
        text: "Polyethylene Glycol",
        indication: "Constipation; Hemorrhoids; Anal Fissure",
        contra: "Hypersensitivity to polyethylene glycol or any component of the formulation; Suspected bowel obstruction (symptoms of nausea, vomiting, abdominal pain or distension); Renal impairment/ kidney disease due to risk of electrolyte imbalance",
        moi: "Osmotic agent causes water retention in the stool increasing stool frequency and decreasing stool consistency",
        adult: "17grams PO: 17 g (1 heaping tablespoon) in 4-8 ounces of beverage daily (Maximum: 2 weeks)",
        peds: "0.2-1gram/kg: Daily dose titrated to effect (Max: 17 g/ day)",
        preg: [
            {
                icon: "Unknown",
                text: ""
            }
        ],
        adverse: "Nausea, diarrhea, gas, stomach cramping, stomach bloating",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 37
    {
        icon: "Betadine",
        text: "Povidone-Iodine",
        indication: "Antiseptic",
        contra: "Hypersensitivity to iodine, shellfish, or any component of the formulation; Use with caution in patients with renal impairment or thyroid disorders; Do not use with deep puncture wounds or serious burns",
        moi: "Broad spectrum germicidal agent effective against bacteria, viruses, fungi, protozoa, and spores",
        adult: "Topical: Apply to affected area as needed to clean the skin/ as needed for antiseptic",
        peds: "N/A",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Irritation, itching, rash",
        aviation: [
            {
                icon: "N/A",
                text: ""
            }
        ]
    },
    // index 38
    {
        icon: "Systane Balance",
        text: "Artificial Tears",
        indication: "Dry Eyes",
        contra: "Hypersensitivity to any components of the formulation",
        moi: "Demulcents have protection and lubrication properties",
        adult: "1-2 drops ophthalmic: Apply 1-2 drops in affected eye every hour as needed",
        peds: "1-2 drops ophthalmic: Apply 1-2 drops in affected eye",
        preg: [
            {
                icon: "Safe",
                text: ""
            }
        ],
        adverse: "Mild stinging of eye, eyelid crusting, or blurred vision; Remove contact lenses prior to use; Do not touch tip of applicator to any surface to avoid contamination",
        aviation: [
            {
                icon: "Saline or other lubricating solution only",
                text: "Visine or other vasoconstrictor agents are prohibited for aviation duty"
            }
        ]
    },
    // index 39
    {
        icon: "Sudafed",
        text: "Pseudoephedrine",
        indication: "Nasal Congestion",
        contra: "Hypersensitivity to pseudoephedrine or any component of its formulation; Children <4 years old; Administering with or within 2 weeks of taking a MAO Inhibitor; Hypertension, Ischemic heart disease, Diabetes, Seizure disorder",
        moi: "Stimulates alpha-adrenergic receptors causing vasoconstriction",
        adult: "30mg PO: Take 2 tab every 6 hours as needed for congestion; 30mg PO: Take 60 mg every 4-6 hrs as needed for congestion; 120mg PO: Take 120 mg extended release every 12 hrs as needed for congestion",
        peds: "4-5 years old 15mg PO: 15 mg every 4-6 hrs as needed for congestion; 6-11 years old: 30mg PO every 4-6 hours as needed for congestion",
        preg: [
            {
                icon: "Unsafe",
                text: ""
            }
        ],
        adverse: "Palpitations, hypertension, tachycardia; Insomnia, feeling jittery; Urinary retention; Increased risk of heat injury",
        aviation: [
            {
                icon: "When used for mild nasal congestion",
                text: "in the presence of normal ventilation of the sinuses and middle ears (normal valsalva). Must notify supervising provider that patient is on flight status when requesting prescription"
            }
        ]
    },
    // index 40
    {
        icon: "Zantac",
        text: "Ranitidine",
        indication: "Heartburn; Gastroesophageal Reflux Disease (GERD); Erosive Esophagitis",
        contra: "Hypersensitivity to ranitidine or any component of the formulation",
        moi: "Competes with histamine for H2-receptor sites within the gastrointestinal tract; Inhibits gastric acid secretion and gastric volume",
        adult: "ADTMC PREFERRED: 150mg PO: Take 1 tab twice a day as needed for heartburn; 150mg PO: Take 1 tab 1-4 times daily as needed for GERD or erosive esophagitis",
        peds: "75mg-150mg PO 30 min before eating (Max 2 times/day. Max 14 days); 5-10 mg/kg/day PO: Divided into 2 doses 12 hrs apart (Maximum: 300mg/day)",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Vitamin B12 deficiency when used for over 2 years",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 41
    {
        icon: "Lamisil",
        text: "Terbinafine",
        indication: "Athlete's Foot (Tinea pedis); Jock Itch (Tinea cruris); Body Fungal Infection (Tinea corporis)",
        contra: "Local irritation develops; If dosage form contains benzyl alcohol, can cause a fatal toxicity in neonates",
        moi: "Synthetic allylamine derivative inhibits squalene epoxidase, a key enzyme in the sterol biosynthesis in fungi; Results in fungal cell death",
        adult: "1% Topical: Apply to affected area x 1 week Twice a day (Tinea pedis); 1% Topical: Apply to affected area x 1 week Daily (Tinea cruris, corporis); 1% Topical: Apply to affected area Twice a day x 2 weeks (sides and soles of feet)",
        peds: "N/A",
        preg: [
            {
                icon: "Safe",
                text: ""
            }
        ],
        adverse: "Contact dermatitis, burning sensation, irritation; Not intended for use on nails, scalp, or mucosa",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 42
    {
        icon: "Septra, Bactrim",
        text: "Trimethoprim/Sulfamethoxazole",
        indication: "Urinary Tract Infection; REVIEW LOCAL ANTIBIOGRAM FOR POTENTIAL RESISTANCE",
        contra: "Hypersensitivity to Trimethoprim sulfamethoxazole, sulfonamides antibiotics, G6PD deficiency, or any component of the formulation; Pregnancy during 1st Trimester or after 32 weeks, infant <2 months; Do Not use in patient with megaloblastic anemia from folate deficiency or Hyperkalemia",
        moi: "Antibiotic against aerobic gram positive and gram negative; Inhibits bacterial folic acid synthesis and growth",
        adult: "160mg/800mg PO: Take 1 double strength (DS) tab (160mg/800mg) twice a day for 3 days",
        peds: "6-12mg TMP/kg/day PO/IV: Divided over 2 doses (every 12 hours) (Maximum: 160mg TMP/dose)",
        preg: [
            {
                icon: "Class D",
                text: "not in 1st trimester"
            }
        ],
        adverse: "Nausea/ Vomiting; Rash/ Itching; Take with 8 oz of water",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    },
    // index 43
    {
        icon: "Valtrex",
        text: "Valacyclovir",
        indication: "Cold sores (Herpes labialis); Herpes simplex virus (HSV); Shingles (Herpes zoster); Treatment should start within 72hours of symptoms",
        contra: "Hypersensitivity to valcyclovir, acyclovir, or any component of the formulation",
        moi: "Converts to Acyclovir, Inhibits DHA synthesis and viral replication",
        adult: "2grams PO: Take 2 grams twice 12 hours apart; Cold Sores: 2g PO twice every 12 hours; HSV (initial): 1g twice a day x 10 days; HSV (recurrent): 1g daily x 5 days",
        peds: "Varicella > 2 y/o: 20mg/kg PO three times per day x 5 days (Maximum: 1 g/dose)",
        preg: [
            {
                icon: "Class B",
                text: "Presumed Safe"
            }
        ],
        adverse: "Headache, confusion, agitation; Nausea, abdominal pain",
        aviation: [
            {
                icon: "None",
                text: ""
            }
        ]
    }
];