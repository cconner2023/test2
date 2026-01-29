import type { catDataTypes, sideMenuDataType, subjectAreaArray, medcom } from "../Types/CatTypes";

export const menuData: sideMenuDataType[] = [
    {
        text: "Medications",
        icon: 'pill',
        action: 'medications'
    },
    {
        text: "Import Note",
        icon: 'import',
        action: 'import'
    },
    {
        text: "Toggle Theme",
        icon: 'light',
        action: 'toggleTheme'
    },
]

export const medcomTrainingData: medcom[] = [
    {
        id: 0,
        icon: "pg.67 b.(1)",
        text: "Per Provider Order, Administers And Records Appropriate Immunisations"
    },
    {
        id: 1,
        icon: "pg.67(2)",
        text: "Administer Allergy Shots/Skin Testing"
    },
    {
        id: 2,
        icon: "pg.67(3)(a)",
        text: "Administer Topical Ointment/Lotions"
    },
    {
        id: 3,
        icon: "pg.67(3)(b)",
        text: "Administer Otic Medications"
    },
    {
        id: 4,
        icon: "pg.67(3)( c)",
        text: "Administer Ophthalmic Medication"
    },
    {
        id: 5,
        icon: "pg.67(3)(g)",
        text: "Administer Antiemetic"
    },
    {
        id: 6,
        icon: "pg.67(3)(j)",
        text: "Administer Antihistamines"
    },
    {
        id: 7,
        icon: "pg.67(k)",
        text: "All Medication Protocols Associated with 68W Training and Certifications"
    },
    {
        id: 8,
        icon: "pg.68(5)",
        text: "Assists Privileged Provider To Perform Invasive Procedures"
    },
    {
        id: 9,
        icon: "pg.68(7)",
        text: "Sets Up and Maintains A Sterile Field"
    },
    {
        id: 10,
        icon: "pg.68(11)",
        text: "Perform Suturing"
    },
    {
        id: 11,
        icon: "pg.68(13)",
        text: "Obtain a Throat Culture"
    },
    {
        id: 12,
        icon: "pg.68(14)",
        text: "Removes Skin Warts On Extremities As Ordered"
    },
    {
        id: 13,
        icon: "pg.68(k)",
        text: "All Medication Protocols Associated with 68W Training and Certifications"
    },
    {
        id: 14,
        icon: "pg.69 (2)(d)",
        text: "Initial Management of Fractures/Spinal Injury"
    },
    {
        id: 15,
        icon: "pg.69(2)(a)",
        text: "Initiate an Intravenous Infusion"
    },
    {
        id: 16,
        icon: "pg.69(2)(c)",
        text: "Identifies, reports and Treats Hypovolemia"
    },
    {
        id: 17,
        icon: "pg.69(2)(e)",
        text: "Initial Treatment of Environmental Injuries"
    },
    {
        id: 18,
        icon: "pg.69(2)(f)",
        text: "Obtain Blood Glucose Levels"
    },
    {
        id: 19,
        icon: "pg.69(2)(h)",
        text: "Provide Oxygen"
    },
    {
        id: 20,
        icon: "pg.69(2)(i)",
        text: "Examines Eye Using Fluorescein Strip"
    },
    {
        id: 21,
        icon: "pg.69-70(2)(k)",
        text: "Obtain Laboratory Specimens(urine for HcG)"
    },
    {
        id: 22,
        icon: "pg.69-70 (2)(n)",
        text: "Gathers Sexually Transmitted Infection Specimen"
    },
    {
        id: 23,
        icon: "pg.69-70(2)(k)",
        text: "Obtain Laboratory Specimens"
    },
    {
        id: 24,
        icon: "pg.69-70(2)(o-p)",
        text: "Performs 12-lead Electrocardiogram"
    },
    {
        id: 25,
        icon: "pg.70(k)",
        text: "Obtain Laboratory Specimen"
    },
    {
        id: 26,
        icon: "pg.70(l)",
        text: "Perform Wound Care"
    },
    {
        id: 27,
        icon: "pg.70(r)",
        text: "Assists With The Administration of Local Anesthesia"
    },
    {
        id: 28,
        icon: "pg.70(s)",
        text: "Assists In Performing Digital Block Procedures"
    },
    {
        id: 29,
        icon: "pg.70(t)",
        text: "Perform Toenail Removal"
    },
    {
        id: 30,
        icon: "pg.70(2)(i)",
        text: "Perform Wound Care"
    }
]

export const TrainingStpData: subjectAreaArray[] = [
    {
        id: 0,
        icon: "Subject Area 1",
        text: "Vital Signs",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0012",
                text: "Measure a Patient's Blood Pressure",
                isParent: false,
                parentId: 0
            }
        ]
    },
    {
        id: 1,
        icon: "Subject Area 2",
        text: "Medical Treatment",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0004",
                text: "Initiate Treatment for a Poisoned Casualty",
                isParent: false,
                parentId: 1
            },
            {
                id: 1,
                icon: "081-833-0063",
                text: "Initiate Treatment for a Soft Tissue Injury",
                isParent: false,
                parentId: 1
            }
        ]
    },
    {
        id: 2,
        icon: "Subject Area 3",
        text: "Trauma Treatment",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0091",
                text: "Initiate Treatment for Neck Wounds",
                isParent: false,
                parentId: 2
            },
            {
                id: 1,
                icon: "081-833-0177",
                text: "Apply a Cervical Collar",
                isParent: false,
                parentId: 2
            },
            {
                id: 2,
                icon: "081-833-0181",
                text: "Apply a Long Spine Board",
                isParent: false,
                parentId: 2
            }
        ]
    },
    {
        id: 3,
        icon: "Subject Area 4",
        text: "Airway Management",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0158",
                text: "Administer Oxygen",
                isParent: false,
                parentId: 3
            }
        ]
    },
    {
        id: 4,
        icon: "Subject Area 5",
        text: "Venipuncture and IV Therapy",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0033",
                text: "Initiate an Intravenous Infusion",
                isParent: false,
                parentId: 4
            }
        ]
    },
    {
        id: 5,
        icon: "Subject Area 6",
        text: "Primary Care",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0193",
                text: "Perform Visual Acuity Testing",
                isParent: false,
                parentId: 5
            },
            {
                id: 1,
                icon: "081-833-0125",
                text: "Treat Skin Disorders",
                isParent: false,
                parentId: 5
            },
            {
                id: 2,
                icon: "081-833-0241",
                text: "Provide Treatment for Common Ear Infections",
                isParent: false,
                parentId: 5
            },
            {
                id: 3,
                icon: "081-833-0242",
                text: "Provide Treatment for Sinus Infections",
                isParent: false,
                parentId: 5
            },
            {
                id: 4,
                icon: "081-833-0243",
                text: "Provide Care for Common Throat Infections",
                isParent: false,
                parentId: 5
            },
            {
                id: 5,
                icon: "081-833-0245",
                text: "Provide Care for Common Respiratory Disorders",
                isParent: false,
                parentId: 5
            },
            {
                id: 6,
                icon: "081-833-0246",
                text: "Provide Treatment for a Behavioral Emergency",
                isParent: false,
                parentId: 5
            },
            {
                id: 7,
                icon: "081-833-0247",
                text: "Perform a Military Acute Concussion Evaluation 2 (MACE 2) Screening for mild Traumatic Brain Injury",
                isParent: false,
                parentId: 5
            },
            {
                id: 8,
                icon: "081-833-0254",
                text: "Perform a head, eyes, ears, nose, and throat (HEENT) Exam",
                isParent: false,
                parentId: 5
            },
            {
                id: 9,
                icon: "081-833-0239",
                text: "Provide Treatment for Abdominal Disorders",
                isParent: false,
                parentId: 5
            }
        ]
    },
    // index 6
    {
        id: 6,
        icon: "Subject Area 7",
        text: "Musculoskeletal",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0222",
                text: "Treat Common Musculoskeletal Disorders",
                isParent: false,
                parentId: 6
            },
            {
                id: 1,
                icon: "081-833-0263",
                text: "Apply a Rigid Splint",
                isParent: false,
                parentId: 6
            },
            {
                id: 2,
                icon: "081-833-0264",
                text: "Apply an Elastic Bandage",
                isParent: false,
                parentId: 6
            },
            {
                id: 3,
                icon: "081-833-0266",
                text: "Immobilize the Pelvis",
                isParent: false,
                parentId: 6
            },
            {
                id: 4,
                icon: "081-833-0268",
                text: "Perform an Examination of the Knee",
                isParent: false,
                parentId: 6
            },
            {
                id: 5,
                icon: "081-833-0269",
                text: "Perform an Examination of the Shoulder",
                isParent: false,
                parentId: 6
            },
            {
                id: 6,
                icon: "081-833-0270",
                text: "Perform an Examination of the Elbow",
                isParent: false,
                parentId: 6
            },
            {
                id: 7,
                icon: "081-833-0272",
                text: "Perform an Examination of the Ankle",
                isParent: false,
                parentId: 6
            },
            {
                id: 8,
                icon: "081-833-0273",
                text: "Perform an Examination of the Wrist",
                isParent: false,
                parentId: 6
            },
            {
                id: 9,
                icon: "081-833-0274",
                text: "Perform an Examination of the Hip",
                isParent: false,
                parentId: 6
            }
        ]
    },
    // index 7
    {
        id: 7,
        icon: "Subject Area 11",
        text: "Force Health Protection",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0038",
                text: "Initiate Treatment for a Heat Injury",
                isParent: false,
                parentId: 7
            },
            {
                id: 1,
                icon: "081-833-0039",
                text: "Treat a Casualty for a Cold Injury",
                isParent: false,
                parentId: 7
            }
        ]
    },
    // index 8
    {
        id: 8,
        icon: "Subject Area 12",
        text: "Medical Treatment",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-3007",
                text: "Obtain an Electrocardiogram",
                isParent: false,
                parentId: 8
            }
        ]
    },
    {
        id: 9,
        icon: "Subject Area 15",
        text: "Primary Care",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0059",
                text: "Irrigate an Obstructed Ear",
                isParent: false,
                parentId: 9
            },
            {
                id: 1,
                icon: "081-833-0248",
                text: "Obtain a Throat Culture",
                isParent: false,
                parentId: 9
            },
            {
                id: 2,
                icon: "081-833-0255",
                text: "Utilize a Urine Test Strip",
                isParent: false,
                parentId: 9
            },
            {
                id: 3,
                icon: "081-833-0256",
                text: "Test a Stool Sample",
                isParent: false,
                parentId: 9
            },
            {
                id: 4,
                icon: "081-833-0257",
                text: "Operate a Glucometer",
                isParent: false,
                parentId: 9
            }
        ]
    },
    {
        id: 10,
        icon: "Subject Area 16",
        text: "CBRN",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0280",
                text: "Provide Treatment for a Radiation Casualty",
                isParent: false,
                parentId: 10
            }
        ]
    },
    {
        id: 11,
        icon: "Subject Area 18",
        text: "Medication Administration",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0015",
                text: "Administer Eye Medications",
                isParent: false,
                parentId: 11
            },
            {
                id: 1,
                icon: "081-833-0020",
                text: "Administer Ear Medications",
                isParent: false,
                parentId: 11
            },
            {
                id: 2,
                icon: "081-833-3020",
                text: "Administer Topical Medications",
                isParent: false,
                parentId: 11
            }
        ]
    },
    {
        id: 12,
        icon: "Subject Area 20",
        text: "Medical Treatment",
        isParent: true,
        options: [
            {
                id: 0,
                icon: "081-833-0026",
                text: "Perform Suture Removal",
                isParent: false,
                parentId: 12
            }
        ]
    }
]
//Complaints - nested here to use in SearchHook
export const catData: catDataTypes[] = [
    {
        id: 1,
        icon: "A.",
        text: "EAR, NOSE, THROAT",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "A-1",
                text: "Sore Throat/Hoarseness ",
                gen: [{}],
                medcom: [medcomTrainingData[11]],
                stp: [
                    TrainingStpData[5].options[4],
                    TrainingStpData[5].options[8],
                    TrainingStpData[9].options[1]
                ],
                redFlags: [
                    { text: "SOB" },
                    { text: "Stridor" },
                    { text: "Deviated Uvula" },
                    { text: "Drooling/ Trouble Swallowing" },
                    { text: "Stiff Neck" }
                ],
                DDX: [
                    { text: "Viral Infections" },
                    { text: "Bacterial Infection" },
                    { text: "Meningitis" },
                    { text: "Neck Deep Tissue Infection" },
                    { text: "Candida infection" },
                    { text: "Strep Throat" }
                ]
            },
            {
                id: 2,
                icon: "A-2",
                text: "Ear Pain/Drainage/Trauma",
                gen: [{}],
                medcom: [medcomTrainingData[3]],
                stp: [
                    TrainingStpData[5].options[8],
                    TrainingStpData[5].options[2],
                    TrainingStpData[11].options[1]
                ],
                redFlags: [
                    { text: "Stiff Neck AND Fever" },
                    { text: "Posterior ear pain and/or mastoid erythema" }
                ],
                DDX: [
                    { text: "Otitis Media/Externa" },
                    { text: "Eustachian tube dysfunction" },
                    { text: "Nasopharyngeal pathology" },
                    { text: "Deep space head/neck infections" },
                    { text: "Meningitis" },
                    { text: "Mastoiditis" },
                    { text: "Ruptured Ear Drum" },
                    { text: "TMJ Dysfunction" }
                ]
            },
            {
                id: 3,
                icon: "A-3",
                text: "Cold Symptoms /Allergies /Cough",
                gen: [{}],
                medcom: [
                    medcomTrainingData[6],
                    medcomTrainingData[1],
                    medcomTrainingData[19]
                ],
                stp: [
                    TrainingStpData[5].options[8],
                    TrainingStpData[5].options[3],
                    TrainingStpData[5].options[4],
                    TrainingStpData[5].options[5]
                ],
                redFlags: [
                    { text: "Abnormal Vital Signs" },
                    { text: "Shortness of Breath" },
                    { text: "Stiff Neck" },
                    { text: "Altered Mental Status" },
                    { text: "Coughing up blood clots or frank blood" }
                ],
                DDX: [
                    { text: "Allergic or seasonal rhinitis" },
                    { text: "Bacterial pharyngitis or tonsillitis" },
                    { text: "Acute bacterial rhinosinusitis" },
                    { text: "Influenza" },
                    { text: "Pertussis" }
                ]
            },
            {
                id: 4,
                icon: "A-4",
                text: "Ringing in the Ears/Hearing Problems ",
                gen: [{}],
                medcom: [medcomTrainingData[3]],
                stp: [
                    TrainingStpData[5].options[8],
                    TrainingStpData[5].options[2],
                    TrainingStpData[9].options[0],
                    TrainingStpData[11].options[1]
                ],
                redFlags: [
                    { text: "Altered Mental Status" },
                    { text: "Focal Neurological Symptom or Sign" },
                    { text: "Dizziness" }
                ],
                DDX: [
                    { text: "Cerumen Impaction" },
                    { text: "Otitis Media" },
                    { text: "Otosclerosis" },
                    { text: "Ruptured Ear Drum" },
                    { text: "Eustachian Tube Dysfunction" },
                    { text: "Hearing Loss" },
                    { text: "Disorders of the Jaw Joint" },
                    { text: "Severe Anxiety" },
                    { text: "Neck Injuries" }
                ]
            },
            {
                id: 5,
                icon: "A-5",
                text: "Nosebleed/Nose Trauma ",
                gen: [{}],
                medcom: [],
                stp: [TrainingStpData[5].options[8]],
                redFlags: [
                    { text: "Airway Compromise" },
                    { text: "Orthostatic Hypotension" },
                    { text: "Bleeding from Gums" },
                    { text: "Inability to Move Eye" }
                ],
                DDX: [
                    { text: "Upper Respiratory Infections" },
                    { text: "Allergic or Viral Rhinitis" },
                    { text: "Trauma" },
                    { text: "Bleeding Disorder" },
                    { text: "Foreign Body" }
                ]
            }
        ]
    },
    {
        id: 2,
        icon: "B.",
        text: "MUSCULOSKELETAL",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "B-1",
                text: "Back Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [TrainingStpData[6].options[0]],
                redFlags: [
                    { text: "Fever" },
                    { text: "Saddle Anesthesia" },
                    { text: "Urinary Retention/Incontinence" },
                    { text: "Fecal Incontinence" },
                    { text: "Motor Deficits" },
                    { text: "Trauma with Vertebral Tenderness or Neuropathy" },
                    { text: "Dysuria/Frequency" },
                    { text: "Chest/Abdominal Pain" }
                ],
                DDX: [
                    { text: "Muscle Sprain/Strain" },
                    { text: "Fracture" },
                    { text: "Infection" },
                    { text: "Renal Stone/UTI" },
                    { text: "Arthritis" },
                    { text: "Cauda Equina Syndrome" }
                ]
            },
            {
                id: 2,
                icon: "B-2",
                text: "Neck Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[0],
                    TrainingStpData[2].options[0],
                    TrainingStpData[2].options[1],
                    TrainingStpData[2].options[2]
                ],
                redFlags: [
                    { text: "Bony step off/midline tenderness to palpation" },
                    { text: "Inability to flex neck" },
                    { text: "Fever" },
                    { text: "Recent HEENT or dental infection" }
                ],
                DDX: [
                    { text: "Muscle Strain" },
                    { text: "Fracture" },
                    { text: "Meningitis" },
                    { text: "Flu" },
                    { text: "Deep neck space infection" }
                ]
            },
            {
                id: 3,
                icon: "B-3",
                text: "Shoulder Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[5],
                    TrainingStpData[6].options[0]
                ],
                redFlags: [
                    { text: "Distal Pulses Abnormal" },
                    { text: "Distal Sensation Abnormal" },
                    { text: "Deformity" },
                    { text: "Cardiac Symptoms" }
                ],
                DDX: [
                    { text: "Tendon inflammation/tear" },
                    { text: "Instability (dislocation)" },
                    { text: "Arthritis" },
                    { text: "Fracture" },
                    { text: "Myocardial Infarction" }
                ]
            },
            {
                id: 4,
                icon: "B-4",
                text: "Elbow Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[6],
                    TrainingStpData[6].options[0]
                ],
                redFlags: [
                    { text: "Distal Pulses Abnormal" },
                    { text: "Distal Sensation Abnormal" },
                    { text: "Deformity" }
                ],
                DDX: [
                    { text: "Muscle Strain" },
                    { text: "Fracture" },
                    { text: "Dislocation" },
                    { text: "Tendonitis" },
                    { text: "Bursitis" }
                ]
            },
            {
                id: 5,
                icon: "B-5",
                text: "Wrist Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[8]
                ],
                redFlags: [
                    { text: "Distal Pulses Abnormal" },
                    { text: "Distal Sensation Abnormal" },
                    { text: "Deformity" },
                    { text: "Open Fracture" }
                ],
                DDX: [
                    { text: "Fracture" },
                    { text: "Carpal Tunnel" },
                    { text: "Arthritis" },
                    { text: "Bursitis" },
                    { text: "Tendonitis" },
                    { text: "Muscle Strain" }
                ]
            },
            {
                id: 6,
                icon: "B-6",
                text: "Hand Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[1],
                    TrainingStpData[6].options[2]
                ],
                redFlags: [
                    { text: "Abnormal Capillary Refill" },
                    { text: "Abnormal Distal Sensation" },
                    { text: "Palmar Infection" },
                    { text: "Deformity" },
                    { text: "Significant Burn" }
                ],
                DDX: [
                    { text: "Fracture/Dislocation" },
                    { text: "Gout" },
                    { text: "Carpal Tunnel Syndrome" },
                    { text: "Arthritis" },
                    { text: "Tendonitis" },
                    { text: "Muscle Strain" }
                ]
            },
            {
                id: 7,
                icon: "B-7",
                text: "Hip Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[9],
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[3]
                ],
                redFlags: [
                    { text: "Abnormal PMS" },
                    { text: "Deformity" },
                    { text: "High Energy Trauma" },
                    { text: "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" },
                    { text: "Severe Pain" }
                ],
                DDX: [
                    { text: "Arthritis" },
                    { text: "Stress Fracture" },
                    { text: "Trochanteric Bursitis" },
                    { text: "Tendinitis" },
                    { text: "Muscle Strain" },
                    { text: "Hernia" },
                    { text: "Referred Pain" }
                ]
            },
            {
                id: 8,
                icon: "B-8",
                text: "Knee Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[4],
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[1],
                    TrainingStpData[6].options[2]
                ],
                redFlags: [
                    { text: "Abnormal PMS" },
                    { text: "Deformity" },
                    { text: "High Energy Trauma" }
                ],
                DDX: [
                    { text: "Ligament or Cartilage Injury" },
                    { text: "Arthritis" },
                    { text: "Overuse Injury" },
                    { text: "Infection/Inflammation" },
                    { text: "Bursitis" }
                ]
            },
            {
                id: 9,
                icon: "B-9",
                text: "Ankle Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[7],
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[1],
                    TrainingStpData[6].options[2]
                ],
                redFlags: [
                    { text: "Abnormal Distal Pulse" },
                    { text: "Abnormal Sensation" },
                    { text: "Deformity" }
                ],
                DDX: [
                    { text: "Sprain/Strain" },
                    { text: "Fracture" },
                    { text: "Tendon Rupture" },
                    { text: "Arthritis" },
                    { text: "Bursitis" },
                    { text: "Tendinopathy" }
                ]
            },
            {
                id: 10,
                icon: "B-10",
                text: "Foot Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[1],
                    TrainingStpData[6].options[2]
                ],
                redFlags: [
                    { text: "Abnormal Distal Pulse" },
                    { text: "Abnormal Sensation" },
                    { text: "Deformity" },
                    { text: "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" }
                ],
                DDX: [
                    { text: "Injury" },
                    { text: "Overuse" },
                    { text: "Plantar Fasciitis" },
                    { text: "Tarsal Tunnel Syndrome" },
                    { text: "Achilles Tendinopathy" },
                    { text: "Ingrown Toenail" },
                    { text: "Bunion" }
                ]
            },
            {
                id: 11,
                icon: "B-11",
                text: "Extremity, Non-joint Pain",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[6].options[0],
                    TrainingStpData[6].options[2]
                ],
                redFlags: [
                    { text: "Abnormal Distal Pulse" },
                    { text: "Abnormal Sensation" },
                    { text: "Deformity" },
                    { text: "Cola Colored Urine" },
                    { text: "Inability to Urinate" }
                ],
                DDX: [
                    { text: "Fracture" },
                    { text: "Laceration" },
                    { text: "Bruise" },
                    { text: "Stress Reaction" }
                ]
            }
        ]
    },
    {
        id: 3,
        icon: "C.",
        text: "GASTROINTESTINAL",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "C-1",
                text: "Nausea/Vomiting",
                gen: [{}],
                medcom: [
                    medcomTrainingData[5],
                    medcomTrainingData[23]
                ],
                stp: [],
                redFlags: [
                    { text: "Vomiting Blood or Coffee Grinds, Melena" },
                    { text: "Neurologic Symptoms" },
                    { text: "Chest Pain" },
                    { text: "Abdominal Pain followed by Nausea" },
                    { text: "Abdominal Distension" }
                ],
                DDX: [
                    { text: "Medication" },
                    { text: "Infection" },
                    { text: "Intense Pain" },
                    { text: "Pregnancy" },
                    { text: "Concussion" },
                    { text: "Heartburn" }
                ]
            },
            {
                id: 2,
                icon: "C-2",
                text: "Diarrhea",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [
                    TrainingStpData[1].options[0],
                    TrainingStpData[5].options[9],
                    TrainingStpData[10].options[0]
                ],
                redFlags: [
                    { text: "Vomiting Blood or Coffee Grinds, Melena" },
                    { text: "Severe abdominal pain" },
                    { text: "Significant weight loss" }
                ],
                DDX: [
                    { text: "Food Intolerance" },
                    { text: "Medication" },
                    { text: "Infection (Viral/Bacterial)" },
                    { text: "Dizziness" },
                    { text: "Chest Pain" },
                    { text: "Ear Pain" },
                    { text: "Heartburn" }
                ]
            },
            {
                id: 3,
                icon: "C-3",
                text: "Abdominal and Flank Pain",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [TrainingStpData[5].options[9]],
                redFlags: [
                    { text: "Abnormal Vitals" },
                    { text: "Abdominal rigidity/rebound (bump chair)" },
                    { text: "Severe pain" },
                    { text: "Fever with jaundice and RUQ pain" },
                    { text: "Confirmed Pregnancy" },
                    { text: "Alcoholism" },
                    { text: "Immunocompromised" },
                    { text: "RLQ Pain" }
                ],
                DDX: [
                    { text: "MI, AAA" },
                    { text: "Appendicitis" },
                    { text: "Pancreatitis, Hepatitis" },
                    { text: "Heartburn" },
                    { text: "Ectopic Pregnancy" },
                    { text: "Testicular Torsion" },
                    { text: "Pelvic Inflammatory Dis." }
                ]
            },
            {
                id: 4,
                icon: "C-4",
                text: "Rectal Pain/Itching/ Bleeding",
                gen: [{}],
                medcom: [],
                stp: [
                    TrainingStpData[5].options[9],
                    TrainingStpData[9].options[3]
                ],
                redFlags: [
                    { text: "Toilette FULL of Blood" },
                    { text: "Vomiting Blood or Coffee Grinds" },
                    { text: "Melena" },
                    { text: "Lightheaded" }
                ],
                DDX: [
                    { text: "Gastrointestinal Bleed" },
                    { text: "Hemorrhoid/Fissure" },
                    { text: "IBD" },
                    { text: "Infection" },
                    { text: "Cancer" }
                ]
            },
            {
                id: 5,
                icon: "C-5",
                text: "Constipation",
                gen: [{}],
                medcom: [],
                stp: [TrainingStpData[5].options[9]],
                redFlags: [
                    { text: "Diarrhea at night" },
                    { text: "Iron deficiency anemia" },
                    { text: "Vomiting" }
                ],
                DDX: [
                    { text: "Obstruction" },
                    { text: "Cancer" },
                    { text: "Hypothyroidism" },
                    { text: "Constipation" },
                    { text: "Associated with Hemorrhoids" }
                ]
            },
            {
                id: 6,
                icon: "C-6",
                text: "Difficulty When Swallowing",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [TrainingStpData[5].options[8]],
                redFlags: [
                    { text: "Airway compromise" },
                    { text: "Coughing, choking when swallowing" }
                ],
                DDX: [
                    { text: "Food bolus obstruction" },
                    { text: "Esophagitis" },
                    { text: "Ring, Web, Achalasia" },
                    { text: "Throat Infection" }
                ]
            },
            {
                id: 7,
                icon: "C-7",
                text: "Heartburn",
                gen: [{}],
                medcom: [medcomTrainingData[24]],
                stp: [
                    TrainingStpData[8].options[0],
                    TrainingStpData[5].options[9]
                ],
                redFlags: [
                    { text: "Vomiting Blood or Coffee Grinds" },
                    { text: "Melena" },
                    { text: "Angina" },
                    { text: "SOB" },
                    { text: "Radiation to Back" }
                ],
                DDX: [
                    { text: "Gastroesophageal Reflux" },
                    { text: "Myocardial Infarction" },
                    { text: "Stomach/Duodenal Ulcer" },
                    { text: "Cancer" },
                    { text: "Pancreatitis" }
                ]
            }
        ]
    },
    {
        id: 4,
        icon: "D.",
        text: "CARDIORESPIRATORY",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "D-1",
                text: "Shortness of Breath",
                gen: [{}],
                medcom: [
                    medcomTrainingData[15],
                    medcomTrainingData[19],
                    medcomTrainingData[24]
                ],
                stp: [
                    TrainingStpData[4].options[0],
                    TrainingStpData[5].options[5]
                ],
                redFlags: [
                    { text: "Cyanosis" },
                    { text: "Ancillary muscles" },
                    { text: "SpO2<90%" },
                    { text: "SIRS Criteria" },
                    { text: "Airway Swelling" },
                    { text: "Hives" },
                    { text: "Altered Mental Status (AMS)" }
                ],
                DDX: [
                    { text: "Asthma" },
                    { text: "Anxiety" },
                    { text: "Myocardial Infarction" },
                    { text: "Pulmonary Embolism" },
                    { text: "Pneumonia, Bronchitis" },
                    { text: "Deconditioning" }
                ]
            },
            {
                id: 2,
                icon: "D-2",
                text: "Chest Pain",
                gen: [{}],
                medcom: [
                    medcomTrainingData[15],
                    medcomTrainingData[19],
                    medcomTrainingData[24]
                ],
                stp: [
                    TrainingStpData[8].options[0],
                    TrainingStpData[3].options[0]
                ],
                redFlags: [
                    { text: "Irregular Pulse" },
                    { text: "H/O or FH of Heart Problems" },
                    { text: "Shoulder, jaw pain or pressure" }
                ],
                DDX: [
                    { text: "Myocardial Infarction" },
                    { text: "Pulmonary Embolism" },
                    { text: "Pneumonia, Bronchitis" },
                    { text: "Anxiety" },
                    { text: "Heartburn" },
                    { text: "Musculoskeletal" }
                ]
            }
        ]
    },
    {
        id: 5,
        icon: "E.",
        text: "GENITOURINARY (GU)",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "E-1",
                text: "Painful/ Frequent Urination",
                gen: [{
                    pg: { start: 69, end: 70 },
                    text: 'Painful urination is most commonly a sign of a urinary tract infection, kidney stone, sexually transmitted infection, or yeast infection. Frequent urination can be associated with these but can also be one of the initial signs of hyperglycemia from diabetes. UA and urine culture should be completed if resources are available. A Soldier with symptoms consistent with a UTI can be empirically treated without a urinalysis after ruling out any history that would increase the Soldier’s risk and determining any allergies to medications.'
                }],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [
                    { text: "Systemic Inflammatory Response Syndrome" },
                    { text: "Flank Pain" },
                    { text: "Severe Abdominal Pain" },
                    { text: "Gross Hematuria or Passing Blood Clots" }
                ],
                DDX: [
                    { text: "Kidney Infection" },
                    { text: "Urinary Tract Infection" },
                    { text: "Kidney Stone" },
                    { text: "Uncontrolled Diabetes" },
                    { text: "BPH" },
                    { text: "STI, Vaginitis" }
                ]
            },
            {
                id: 2,
                icon: "E-2",
                text: "Groin/ Testicular Pain or Urethral Discharge",
                gen: [{}],
                medcom: [
                    medcomTrainingData[14],
                    medcomTrainingData[23],
                    medcomTrainingData[22]
                ],
                stp: [],
                redFlags: [
                    { text: "Pain with testes supported" },
                    { text: "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" },
                    { text: "Severe Pain" }
                ],
                DDX: [
                    { text: "Testicular Torsion" },
                    { text: "Hernia" },
                    { text: "Muscle/Tendon Strain" },
                    { text: "Stress Fracture" },
                    { text: "Hip injury" }
                ]
            },
            {
                id: 3,
                icon: "E-3",
                text: "Sexually Transmitted Infection (STI)",
                gen: [{}],
                medcom: [
                    medcomTrainingData[23],
                    medcomTrainingData[22]
                ],
                stp: [TrainingStpData[9].options[2]],
                redFlags: [
                    { text: "Female Pelvic Pain with Intercourse" },
                    { text: "Pregnant" },
                    { text: "Orthostatic, Fever" }
                ],
                DDX: [
                    { text: "Testicular Torsion" },
                    { text: "Hernia" },
                    { text: "Muscle/Tendon Strain" },
                    { text: "Stress Fracture" },
                    { text: "Hip injury" }
                ]
            },
            {
                id: 4,
                icon: "E-4",
                text: "Problems with Voiding",
                gen: [{}],
                medcom: [
                    medcomTrainingData[23],
                    medcomTrainingData[22]
                ],
                stp: [TrainingStpData[9].options[2]],
                redFlags: [
                    { text: "Inability to void x 12 hours" },
                    { text: "Fever" },
                    { text: "Cola Colored Urine" },
                    { text: "Blood or Clots in Urine" }
                ],
                DDX: [
                    { text: "Urinary Obstruction" },
                    { text: "Benign Prostatic Hypertrophy" },
                    { text: "UTI, STI" },
                    { text: "Stress Incontinence" }
                ]
            }
        ]
    },
    {
        id: 6,
        icon: "F.",
        text: "NEUROPSYCHIATRIC",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "F-1",
                text: "Dizziness/Faintness/ Blackout ",
                gen: [{}],
                medcom: [
                    medcomTrainingData[15],
                    medcomTrainingData[17],
                    medcomTrainingData[19],
                    medcomTrainingData[24]
                ],
                stp: [
                    TrainingStpData[8].options[0],
                    TrainingStpData[4].options[0],
                    TrainingStpData[7].options[0]
                ],
                redFlags: [
                    { text: "Abnormal Vital Signs" },
                    { text: "Irregular Pulse" },
                    { text: "Witnessed or H/O Seizure" },
                    { text: "Severe Headache" },
                    { text: "Heat Injury" }
                ],
                DDX: [
                    { text: "Orthostatic Hypotension" },
                    { text: "Vasovagal Syncope" },
                    { text: "Vertigo" },
                    { text: "Anxiety" },
                    { text: "Heart Arrhythmia" },
                    { text: "Intracranial Bleed" },
                    { text: "Seizure, Drugs, Alcohol" }
                ]
            },
            {
                id: 2,
                icon: "F-2",
                text: "Headache",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [
                    { text: "NO HEADACHE ALGORITHM EXISTS FOR THE CURRENT VERSION OF ADTMC. SEE BELOW RED FLAGS" },
                    { text: "Sudden Onset, Severe" },
                    { text: "Focal Neurologic Signs" },
                    { text: "Blown pupil" },
                    { text: "Severe Hypertension" },
                    { text: "Fever" },
                    { text: "Vision Change/Loss" }
                ],
                DDX: [
                    { text: "Migraine Headache" },
                    { text: "Tension Headache" },
                    { text: "Caffeine Withdrawal" },
                    { text: "Infection/Meningitis" },
                    { text: "Intracranial Hemorrhage" }
                ]
            },
            {
                id: 3,
                icon: "F-3",
                text: "Numbness/Tingling/ Paralysis/Weakness ",
                gen: [{}],
                medcom: [medcomTrainingData[18]],
                stp: [TrainingStpData[9].options[4]],
                redFlags: [
                    { text: "Localized to a Region or 1 sided" },
                    { text: "Recent Trauma" },
                    { text: "Loss of Consciousness" },
                    { text: "Bowel/Bladder Incontinence" }
                ],
                DDX: [
                    { text: "Viral Syndrome/ Fatigue" },
                    { text: "Stroke" },
                    { text: "Nerve Compression" },
                    { text: "Hypoglycemia" },
                    { text: "Hyperventilation" },
                    { text: "Depression" },
                    { text: "Lyme disease" }
                ]
            },
            {
                id: 4,
                icon: "F-4",
                text: "Drowsiness/Confusion",
                gen: [{}],
                medcom: [
                    medcomTrainingData[18],
                    medcomTrainingData[19],
                    medcomTrainingData[23]
                ],
                stp: [
                    TrainingStpData[9].options[4],
                    TrainingStpData[3].options[0]
                ],
                redFlags: [
                    { text: "Abnormal Vital Signs" },
                    { text: "Altered Mental Status" },
                    { text: "Focal Neurological Deficit" },
                    { text: "Recent Trauma" }
                ],
                DDX: [
                    { text: "Hypoglycemia" },
                    { text: "Hypotension" },
                    { text: "Hypoxia" },
                    { text: "Concussion" },
                    { text: "Infection" },
                    { text: "Intoxication" }
                ]
            },
            {
                id: 5,
                icon: "F-5",
                text: "Depression/Nervousness/ Anxiety/Tension",
                gen: [{}],
                medcom: [],
                stp: [TrainingStpData[5].options[6]],
                redFlags: [
                    { text: "Homicidal Intent or Attempt" },
                    { text: "Suicide Intent or Attempt" },
                    { text: "Self-injury" },
                    { text: "Altered Mental Status" }
                ],
                DDX: [
                    { text: "Depression" },
                    { text: "Anxiety" },
                    { text: "Hypoxia" },
                    { text: "Hypo/hyperthyroidism" },
                    { text: "Substance intoxication or withdrawal" }
                ]
            },
            {
                id: 6,
                icon: "F-6",
                text: "Minor Traumatic Brain Injury",
                gen: [{}],
                medcom: [],
                stp: [TrainingStpData[5].options[7]],
                redFlags: [
                    { text: "Deteriorating Level of Consciousness" },
                    { text: "Double Vision" },
                    { text: "Increased Restlessness, combative or agitated behavior" },
                    { text: "Repeat vomiting" },
                    { text: "Positive result from structural brain injury detection device (if available)" },
                    { text: "Seizure" },
                    { text: "Weakness or tingling in arms or legs" },
                    { text: "Severe or worsening headache" },
                    { text: "Abnormal Neuro Exam" },
                    { text: "Battle sign, Raccoon eyes" },
                    { text: "Suspected skull fracture" },
                    { text: "Anticoagulant use" }
                ],
                DDX: [
                    { text: "Headache/migraine" },
                    { text: "Concussion" },
                    { text: "Intracerebral Hemorrhage" },
                    { text: "Anxiety" },
                    { text: "Stroke" },
                    { text: "Spinal cord injury" },
                    { text: "Seizure" },
                    { text: "Dehydration" }
                ]
            }
        ]
    },
    {
        id: 7,
        icon: "G.",
        text: "CONSTITUTIONAL",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "G-1",
                text: "Fatigue",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [
                    { text: "Suicide Ideation" },
                    { text: "Homicide Ideation" },
                    { text: "Shortness of Breath" },
                    { text: "Stiff Neck" },
                    { text: "Melena" }
                ],
                DDX: [
                    { text: "Sleep Debt" },
                    { text: "Sleep Apnea" },
                    { text: "Anemia" },
                    { text: "Anxiety Disorders" },
                    { text: "Chronic Infection/Inflammation" },
                    { text: "Chronic fatigue syndrome" },
                    { text: "Acute liver failure" }
                ]
            },
            {
                id: 2,
                icon: "G-2",
                text: "Fever/Chills",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [
                    { text: "Heat Injury" },
                    { text: "Stiff Neck" },
                    { text: "Light sensitivity" },
                    { text: "Pregnant" },
                    { text: "Seizure" },
                    { text: "Lightheaded" }
                ],
                DDX: [
                    { text: "Malaise" },
                    { text: "Cold Symptoms" },
                    { text: "Sore Throat, Ear Pain" },
                    { text: "Heat/Cold Injury" },
                    { text: "Diarrhea" },
                    { text: "Pain with urination" }
                ]
            }
        ]
    },
    {
        id: 8,
        icon: "H.",
        text: "EYE",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "H-1",
                text: "Eye Pain/ Redness/ Discharge/ Itching/ Injury",
                gen: [{}],
                medcom: [
                    medcomTrainingData[4],
                    medcomTrainingData[20]
                ],
                stp: [TrainingStpData[11].options[0]],
                redFlags: [
                    { text: "Fixed, Abnormal Pupil" },
                    { text: "Visual Acuity Change" },
                    { text: "Observed Foreign Body" },
                    { text: "Penetration, Rupture" },
                    { text: "Chemical Exposure" },
                    { text: "Fluid Level over Iris, Pupil" }
                ],
                DDX: [
                    { text: "Blepharitis" },
                    { text: "Allergies" },
                    { text: "Conjunctivitis" },
                    { text: "Corneal Abrasion/Trauma" },
                    { text: "Subconjunctival Hemorrhage" },
                    { text: "Keratitis/Iritis" }
                ]
            },
            {
                id: 2,
                icon: "H-2",
                text: "Eyelid Problem",
                gen: [{}],
                medcom: [medcomTrainingData[4]],
                stp: [TrainingStpData[11].options[0]],
                redFlags: [
                    { text: "Open Globe" },
                    { text: "High Risk Laceration" },
                    { text: "Decreased Visual Acuity" },
                    { text: "Double Vision" }
                ],
                DDX: [
                    { text: "Stye, Blepharitis" },
                    { text: "Dermatitis" },
                    { text: "Infection" },
                    { text: "Eyelid laceration" }
                ]
            },
            {
                id: 3,
                icon: "H-3",
                text: "Decreased Vision, Seeing Spots, Request for Glasses",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[5].options[0],
                    TrainingStpData[2].options[1]
                ],
                redFlags: [
                    { text: "Trauma" },
                    { text: "Recent Surgery" },
                    { text: "Chemical Exposure" },
                    { text: "Fluid Level over Iris, Pupil" },
                    { text: "Neurologic Deficits" }
                ],
                DDX: [
                    { text: "Trauma" },
                    { text: "Migraine" },
                    { text: "Hemorrhage" },
                    { text: "Infection" },
                    { text: "Ischemia, Stroke" }
                ]
            },
            {
                id: 4,
                icon: "H-4",
                text: "Seeing Double (Diplopia)",
                gen: [{}],
                medcom: [medcomTrainingData[14]],
                stp: [
                    TrainingStpData[5].options[0],
                    TrainingStpData[2].options[1]
                ],
                redFlags: [
                    { text: "Trauma" },
                    { text: "Neurologic Deficits" }
                ],
                DDX: [
                    { text: "Intoxication" },
                    { text: "Prescription Eyeglasses" },
                    { text: "Muscle Weakness" },
                    { text: "Trauma" }
                ]
            }
        ]
    },
    {
        id: 9,
        icon: "I.",
        text: "GYNECOLOGICAL",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "I-1",
                text: "Breast Problems",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [
                    { text: "Skin Changes" },
                    { text: "Mass" },
                    { text: "Bloody Nipple Discharge" }
                ],
                DDX: [
                    { text: "Cyclical Breast Pain" },
                    { text: "Musculoskeletal Issue" },
                    { text: "Large Breasts" },
                    { text: "Mastitis, Abscess" },
                    { text: "Cancer" }
                ]
            },
            {
                id: 2,
                icon: "I-2",
                text: "Suspects Pregnancy",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [
                    { text: "Positive hCG AND" },
                    { text: "Pelvic Pain" },
                    { text: "H/O Ectopic Pregnancy" },
                    { text: "Vaginal Bleeding" }
                ],
                DDX: [
                    { text: "Irregular Menstrual Cycle" },
                    { text: "Pregnancy" }
                ]
            },
            {
                id: 3,
                icon: "I-3",
                text: "Menstrual Problems, Vaginal Bleeding",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [
                    { text: "Sexual Assault" },
                    { text: "Trauma" },
                    { text: "Severe Pain" },
                    { text: "Pregnant" }
                ],
                DDX: [
                    { text: "Heavy Menstrual Cycle" },
                    { text: "Irregular Menstrual Cycle" },
                    { text: "Birth Control Side Effect" },
                    { text: "Miscarriage" },
                    { text: "Ectopic Pregnancy" }
                ]
            },
            {
                id: 4,
                icon: "I-4",
                text: "Vaginal Discharge, Itching, Irritation, or Pain",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [
                    { text: "Fever" },
                    { text: "Pregnant" },
                    { text: "Non-midline Pelvic Pain" },
                    { text: "Pain with Intercourse" }
                ],
                DDX: [
                    { text: "Bacterial Vaginosis" },
                    { text: "Yeast Infection" },
                    { text: "Trichomonas" },
                    { text: "Pelvic Inflammatory Disease" },
                    { text: "STI" }
                ]
            },
            {
                id: 5,
                icon: "I-5",
                text: "Request for PAP or Routine Pelvic Examination ",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 6,
                icon: "I-6",
                text: "Request for Information on Contraception",
                gen: [{}],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [],
                DDX: []
            }
        ]
    },
    {
        id: 10,
        icon: "J.",
        text: "DERMATOLOGICAL",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "J-1",
                text: "Unknown Cause of Skin Disorder",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [{ text: "Airway Compromise/Swelling" }],
                DDX: [
                    { text: "Eczema" },
                    { text: "Hives" },
                    { text: "Contact Dermatitis" },
                    { text: "Athlete's Foot" },
                    { text: "Heat Rash" },
                    { text: "Drug Reaction" }
                ]
            },
            {
                id: 2,
                icon: "J-2",
                text: "Acne",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[21]
                ],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [],
                DDX: [
                    { text: "Acne Vulgaris" },
                    { text: "Pseudofolliculitis Barbae" },
                    { text: "Folliculitis" },
                    { text: "Acne Rosacea" },
                    { text: "Hyperandrogenism" }
                ]
            },
            {
                id: 3,
                icon: "J-3",
                text: "Shaving-Pseudofolliculitis Barbae (Ingrown Hairs)",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [{ text: "Facial Cellulitis" }],
                DDX: [
                    { text: "Acne" },
                    { text: "Pseudofolliculitis Barbae" },
                    { text: "Folliculitis" },
                    { text: "Tinea Barbae" },
                    { text: "Acne Keloidalis Nuchae" }
                ]
            },
            {
                id: 4,
                icon: "J-4",
                text: "Dandruff (Scaling of the Scalp)",
                gen: [{}],
                medcom: [],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [
                    { text: "Scaling with Visible Inflammation" },
                    { text: "Abnormal Sensation" },
                    { text: "Painful Erosions" }
                ],
                DDX: [
                    { text: "Pemphigus Foliaceous" },
                    { text: "Tinea Capitis" },
                    { text: "Psoriasis" },
                    { text: "Allergic Contact Dermatitis" },
                    { text: "Seborrheic Dermatitis" }
                ]
            },
            {
                id: 5,
                icon: "J-5",
                text: "Hair Loss",
                gen: [{}],
                medcom: [],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [],
                DDX: [
                    { text: "Alopecia" },
                    { text: "Traction Hair Loss" },
                    { text: "Alopecia Areata" },
                    { text: "Tinea Capitis" },
                    { text: "Acne Keloidalis Nuchae" }
                ]
            },
            {
                id: 6,
                icon: "J-6",
                text: "Athlete's Foot (Tinea Pedis)",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [
                    { text: "Diabetic Soldiers" },
                    { text: "Significant erosions/ulcerations or malodor in affected area" },
                    { text: "Soldiers w/weakened immune systems" }
                ],
                DDX: [
                    { text: "Interdigital tinea pedis" },
                    { text: "Hyperkeratotic (moccasin-type) tinea pedis" },
                    { text: "Vesiculobullous (Inflammatory) tinea pedis" }
                ]
            },
            {
                id: 7,
                icon: "J-7",
                text: "Jock Itch (Tinea Cruris)",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [
                    { text: "Diabetes" },
                    { text: "Immunodeficiency" }
                ],
                DDX: [
                    { text: "Inverse psoriasis" },
                    { text: "Erythrasma" },
                    { text: "Seborrheic dermatitis" },
                    { text: "Candidal intertrigo" }
                ]
            },
            {
                id: 8,
                icon: "J-8",
                text: "Scaling, Depigmented Spots (Tinea Versicolor)",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [],
                DDX: [
                    { text: "Seborrheic dermatitis" },
                    { text: "Tinea corporis" },
                    { text: "Vitiligo" },
                    { text: "Secondary syphilis" }
                ]
            },
            {
                id: 9,
                icon: "J-9",
                text: "Boils",
                gen: [{}],
                medcom: [],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [
                    { text: "Location over Tailbone" },
                    { text: "SIRS Criteria" },
                    { text: "Worsening on Antibiotics" },
                    { text: "Palm of Hand" },
                    { text: "Over Joint" },
                    { text: "Black Eschar" }
                ],
                DDX: [
                    { text: "Folliculitis" },
                    { text: "Abscess" },
                    { text: "Epidermal Cyst" },
                    { text: "Hidradenitis Suppurativa" },
                    { text: "Septic Joint" }
                ]
            },
            {
                id: 10,
                icon: "J-10",
                text: "Fever Blisters (Cold Sores)",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [{ text: "Eye Pain" }],
                DDX: [
                    { text: "Cold Sore" },
                    { text: "Aphthous Ulcer" },
                    { text: "Epstein-Barr Virus" },
                    { text: "Syphilis" }
                ]
            },
            {
                id: 11,
                icon: "J-11",
                text: "Skin Abrasion/Laceration",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[26]
                ],
                stp: [TrainingStpData[1].options[1]],
                redFlags: [
                    { text: "SIRS Criteria" },
                    { text: "Animal Bite, Scratch" }
                ],
                DDX: [
                    { text: "Abrasion" },
                    { text: "Laceration" }
                ]
            },
            {
                id: 12,
                icon: "J-12",
                text: "Suture Removal",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[10],
                    medcomTrainingData[26]
                ],
                stp: [TrainingStpData[12].options[0]],
                redFlags: [
                    { text: "Fever" },
                    { text: "Pus/redness/swelling" }
                ],
                DDX: []
            },
            {
                id: 13,
                icon: "J-13",
                text: "Drug Rash, Contact Dermatitis",
                gen: [{}],
                medcom: [medcomTrainingData[2]],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [
                    { text: "Airway Swelling" },
                    { text: "Wheezing" },
                    { text: "Anaphylaxis" }
                ],
                DDX: [
                    { text: "Hives" },
                    { text: "Contact Dermatitis" },
                    { text: "Viral Exanthem" },
                    { text: "Drug Rash" }
                ]
            },
            {
                id: 14,
                icon: "J-14",
                text: "Burns/Sunburn",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[17]
                ],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [
                    { text: "Trouble Breathing" },
                    { text: "AMS, Drowsy" },
                    { text: "High Risk Location" },
                    { text: "Circumferential Burn" }
                ],
                DDX: [
                    { text: "Burn" },
                    { text: "Irritant Contact Dermatitis" }
                ]
            },
            {
                id: 15,
                icon: "J-15",
                text: "Friction Blisters on Feet",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[30]
                ],
                stp: [TrainingStpData[11].options[2]],
                redFlags: [
                    { text: "Fever/malaise" },
                    { text: "Epidermal sloughing" }
                ],
                DDX: [
                    { text: "Corn" },
                    { text: "Stephen Johnson Syndrome" },
                    { text: "Staphylococcal scalded skin syndrome" }
                ]
            },
            {
                id: 16,
                icon: "J-16",
                text: "Corns on Feet",
                gen: [{}],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[26]
                ],
                stp: [TrainingStpData[5].options[1]],
                redFlags: [],
                DDX: [
                    { text: "Callus" },
                    { text: "Plantar Wart" },
                    { text: "Corn" },
                    { text: "Bunion" }
                ]
            },
            {
                id: 17,
                icon: "J-17",
                text: "Cutaneous (Plantar) Warts",
                gen: [{}],
                medcom: [
                    medcomTrainingData[7],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[12],
                    medcomTrainingData[26]
                ],
                stp: [TrainingStpData[5].options[1]],
                redFlags: [],
                DDX: [
                    { text: "Cutaneous Wart" },
                    { text: "Corn" },
                    { text: "Callous" },
                    { text: "Skin Cancer" }
                ]
            },
            {
                id: 18,
                icon: "J-18",
                text: "Ingrown Toenail",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[13],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[26],
                    medcomTrainingData[27],
                    medcomTrainingData[28],
                    medcomTrainingData[29]
                ],
                stp: [],
                redFlags: [
                    { text: "Red Streaks up Foot" },
                    { text: "Gangrene" },
                    { text: "Black Eschar" }
                ],
                DDX: [
                    { text: "Paronychia" },
                    { text: "Ingrown Toenail" },
                    { text: "Trauma" },
                    { text: "Cellulitis" }
                ]
            }
        ]
    },
    {
        id: 11,
        icon: "K.",
        text: "ENVIRONMENTAL",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "K-1",
                text: "Exertional Heat Illness/ Hyperthermia",
                gen: [{}],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[15],
                    medcomTrainingData[17]
                ],
                stp: [TrainingStpData[7].options[0]],
                redFlags: [
                    { text: "Altered mental status" },
                    { text: "Abnormal vital signs" }
                ],
                DDX: [
                    { text: "Heatstroke" },
                    { text: "Heat Cramps" },
                    { text: "Heat Exhaustion" },
                    { text: "Fever/ Infection" },
                    { text: "Dehydration" },
                    { text: "Hyperthyroidism" }
                ]
            },
            {
                id: 2,
                icon: "K-2",
                text: "Hypothermia",
                gen: [{}],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[15],
                    medcomTrainingData[16],
                    medcomTrainingData[17]
                ],
                stp: [TrainingStpData[7].options[1]],
                redFlags: [
                    { text: "T<96 degrees F" },
                    { text: "Altered Mental Status" },
                    { text: "Abnormal Vital Signs" },
                    { text: "Frostbite" },
                    { text: "Trauma" }
                ],
                DDX: [
                    { text: "Environmental Exposure" },
                    { text: "Exhaustion and Malnutrition" },
                    { text: "Hypothyroidism" },
                    { text: "Sepsis" }
                ]
            },
            {
                id: 3,
                icon: "K-3",
                text: "Immersion Foot",
                gen: [{}],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[15],
                    medcomTrainingData[16],
                    medcomTrainingData[17]
                ],
                stp: [TrainingStpData[7].options[1]],
                redFlags: [
                    { text: "Gangrene/Necrosis" },
                    { text: "Hemorrhagic Blisters" },
                    { text: "Hypothermia" },
                    { text: "Frostbite" },
                    { text: "Trauma" }
                ],
                DDX: [
                    { text: "Nonfreezing Cold Injury" },
                    { text: "Cold Urticaria" },
                    { text: "Raynaud Phenomenon" },
                    { text: "Frostbite" }
                ]
            },
            {
                id: 4,
                icon: "K-4",
                text: "Chapped Skin/Windburn",
                gen: [{}],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[17]
                ],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 5,
                icon: "K-5",
                text: "Frostbite",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 6,
                icon: "K-6",
                text: "Crabs/Lice (Pediculosis) ",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[13]
                ],
                stp: [
                    TrainingStpData[5].options[1],
                    TrainingStpData[11].options[2]
                ],
                redFlags: [],
                DDX: [
                    { text: "Lice" },
                    { text: "Scabies" },
                    { text: "Contact Dermatitis" },
                    { text: "Fungal Infection" },
                    { text: "Hair Casts" }
                ]
            },
            {
                id: 7,
                icon: "K-7",
                text: "Insect Bites (Not Crabs/Lice)",
                gen: [{}],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[13]
                ],
                stp: [TrainingStpData[7].options[1]],
                redFlags: [
                    { text: "Swelling of Lips or Tongue" },
                    { text: "Trouble Breathing" },
                    { text: "Abnormal Vital Signs" }
                ],
                DDX: [
                    { text: "Insect Bite" },
                    { text: "Skin Infection" },
                    { text: "Contact Dermatitis" }
                ]
            }
        ]
    },
    {
        id: 12,
        icon: "L.",
        text: "MISCELLANEOUS",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "L-1",
                text: "Exposed to Hepatitis or HIV",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [
                    { text: "Known Infection" },
                    { text: "High Risk Contact" }
                ],
                DDX: [
                    { text: "Low Risk Exposure" },
                    { text: "High Risk Exposure" }
                ]
            },
            {
                id: 2,
                icon: "L-2",
                text: "Dental Problems",
                gen: [{}],
                medcom: [medcomTrainingData[13]],
                stp: [],
                redFlags: [
                    { text: "Exposed Pulp" },
                    { text: "Avulsed Tooth" },
                    { text: "Severe Pain" },
                    { text: "Trauma" },
                    { text: "Chest Pain, SOB" }
                ],
                DDX: [
                    { text: "Tooth Cavity" },
                    { text: "Poor Dental Hygiene" },
                    { text: "Temporomandibular Joint Pain" },
                    { text: "Infection" },
                    { text: "Heart Attack" }
                ]
            },
            {
                id: 3,
                icon: "L-3",
                text: "Sores in the Mouth",
                gen: [{}],
                medcom: [medcomTrainingData[13]],
                stp: [],
                redFlags: [
                    { text: "Diffuse" },
                    { text: "Bloody Diarrhea" }
                ],
                DDX: [
                    { text: "Aphthous Ulcers" },
                    { text: "Herpes Simplex Virus" },
                    { text: "Hand, Foot, and Mouth Disease" },
                    { text: "Stevens Johnson Syndrome" }
                ]
            },
            {
                id: 4,
                icon: "L-4",
                text: "Prescription Refill",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 5,
                icon: "L-5",
                text: "Requests a Vasectomy",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 6,
                icon: "L-6",
                text: "Needs an Immunization",
                gen: [{}],
                medcom: [medcomTrainingData[0]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 7,
                icon: "L-7",
                text: "Lymph Node Enlargement",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 8,
                icon: "L-8",
                text: "Blood Pressure Check",
                gen: [{}],
                medcom: [],
                stp: [TrainingStpData[0].options[0]],
                redFlags: [],
                DDX: []
            },
            {
                id: 9,
                icon: "L-9",
                text: "Medical Screening for Overseas PCS",
                gen: [{}],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 10,
                icon: "L-10",
                text: "Weight Reduction",
                gen: [{}],
                medcom: [medcomTrainingData[25]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 11,
                icon: "L-11",
                text: "Complaint Not on the List",
                gen: [{}],
                medcom: [],
                stp: [TrainingStpData[0].options[0]],
                redFlags: [],
                DDX: []
            },
            {
                id: 12,
                icon: "L-12",
                text: "Request for Nonprescription or Traveling Medication",
                gen: [{}],
                medcom: [medcomTrainingData[13]],
                stp: [TrainingStpData[0].options[0]],
                redFlags: [],
                DDX: []
            }
        ]
    },
    {
        id: 13,
        icon: "M.",
        text: "MISCELLANEOUS RETURN",
        isParent: true,
        contents: [
            {
                id: 1,
                icon: "M-1",
                text: "No Signs of Improvement",
                gen: [{}],
                medcom: [medcomTrainingData[31]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 2,
                icon: "M-2",
                text: "Return Requested by Provider",
                gen: [{}],
                medcom: [medcomTrainingData[31]],
                stp: [],
                redFlags: [],
                DDX: []
            }
        ]
    }
];