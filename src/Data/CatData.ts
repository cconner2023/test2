import type { catDataTypes, sideMenuDataType, subjectAreaArray, subjectAreaArrayOptions, medcom } from "../Types/CatTypes";
import { stp68wTraining } from './TrainingTaskList';

export const menuData: sideMenuDataType[] = [
    {
        text: "Medications",
        icon: 'pill',
        action: 'medications'
    },
    {
        text: "Import New Note",
        icon: 'import',
        action: 'import'
    },
    {
        text: 'Settings',
        icon: 'Settings',
        action: 'Settings'
    }
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

// Build TrainingStpData from NewTraining.ts, consolidating tasks across all skill levels
function buildTrainingStpData(): subjectAreaArray[] {
    const areaMap = new Map<string, Map<string, string>>()

    for (const level of stp68wTraining) {
        for (const area of level.subjectArea) {
            if (!areaMap.has(area.name)) {
                areaMap.set(area.name, new Map())
            }
            const tasks = areaMap.get(area.name)!
            for (const task of area.tasks) {
                if (!tasks.has(task.id)) {
                    tasks.set(task.id, task.title)
                }
            }
        }
    }

    const result: subjectAreaArray[] = []
    let areaIdx = 0
    for (const [name, tasks] of areaMap) {
        const parentId = areaIdx
        const options: subjectAreaArrayOptions[] = []
        let taskIdx = 0
        for (const [id, title] of tasks) {
            options.push({ id: taskIdx, icon: id, text: title, isParent: false, parentId })
            taskIdx++
        }
        result.push({ id: areaIdx, icon: name, text: name, isParent: true, options })
        areaIdx++
    }

    return result
}

export const TrainingStpData: subjectAreaArray[] = buildTrainingStpData()

// Helper to find an STP task by its ID across all consolidated subject areas
function stpTask(taskId: string): subjectAreaArrayOptions {
    for (const area of TrainingStpData) {
        const task = area.options.find(t => t.icon === taskId)
        if (task) return task
    }
    return { id: 0, icon: taskId, text: taskId, isParent: false, parentId: 0 }
}
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
                    stpTask("081-68W-0243"),
                    stpTask("081-68W-0254"),
                    stpTask("081-000-1008")
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
                    stpTask("081-68W-0254"),
                    stpTask("081-68W-0241")
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
                    stpTask("081-68W-0254"),
                    stpTask("081-68W-0242"),
                    stpTask("081-68W-0243"),
                    stpTask("081-68W-0245")
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
                    stpTask("081-68W-0254"),
                    stpTask("081-68W-0241")
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
                stp: [stpTask("081-68W-0254")],
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
                stp: [stpTask("081-000-0103")],
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
                    stpTask("081-000-0103"),
                    stpTask("081-68W-0091"),
                    stpTask("081-000-0083"),
                    stpTask("081-000-0112")
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
                gen: [{ text: 'Anterolateral shoulder pain worsened by reaching overhead can be related to impingement syndrome, AC joint pathology, or rotator cuff injury. Posterior shoulder pain could be from rotator cuff injury, gallbladder, spleen, or neck.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-68W-0269"),
                    stpTask("081-000-0103")
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
                    stpTask("081-68W-0270"),
                    stpTask("081-000-0103")
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
                gen: [{ text: 'Wrist pain usually occurs from trauma or overuse. Falling on an outstretched hand can result in a scaphoid (falling forward) or lunate/ triquetrum (falling back) injury. Ulnar side of wrist may involve tendinopathy, triangular fibrocartilage complex injury, or fracture. Radial side of wrist may involve tendinopathy, ligamentous injury, or fracture. Dorsal pain may involve a wrist sprain or fracture. Volar pain may involve fracture, ganglion, or carpal tunnel syndrome.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-000-0103"),
                    stpTask("081-68W-0273")
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
                gen: [{ text: 'Any deviation of the hand from normal function can result in significant disability. Hand and finger injury are common in Soldiers.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-000-0103"),
                    stpTask("081-68W-0263"),
                    stpTask("081-000-0110")
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
                gen: [{ text: 'Lateral pain worse with direct pressure may represent trochanteric bursitis. Anterior hip or groin pain may represent the hip joint injury, fracture (stress fracture), or non-hip issue like inguinal hernia. Femoral stress fractures are more common in initial entry training. They can result in permanent disability if not properly identified and treated.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-68W-0274"),
                    stpTask("081-000-0103"),
                    stpTask("081-000-0111")
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
                gen: [{ text: 'Knee pain is a common complaint in Soldiers with a complex differential that includes evaluating for trauma, overuse, swelling, and referred pain.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-68W-0268"),
                    stpTask("081-000-0103"),
                    stpTask("081-68W-0263"),
                    stpTask("081-000-0110")
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
                gen: [{ text: 'Ankle pain is a common complaint in Soldiers from overuse or trauma.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-68W-0272"),
                    stpTask("081-000-0103"),
                    stpTask("081-68W-0263"),
                    stpTask("081-000-0110")
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
                gen: [{ text: 'Common anterior foot pains include around the big toe (bunion, sprain, arthritis, sesamoiditis, ingrown toenail, subungual hematoma) and below the 2nd and 3rd metatarsals (metatarsalgia, Morton’s neuroma, and plantar wart)' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-000-0103"),
                    stpTask("081-68W-0263"),
                    stpTask("081-000-0110")
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
                gen: [{ text: '' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-000-0103"),
                    stpTask("081-000-0110")
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
                    stpTask("081-000-0025"),
                    stpTask("081-68W-0239"),
                    stpTask("081-000-0118")
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
                stp: [stpTask("081-68W-0239")],
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
                    stpTask("081-68W-0239"),
                    stpTask("081-000-1008")
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
                stp: [stpTask("081-68W-0239")],
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
                stp: [stpTask("081-68W-0254")],
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
                    stpTask("081-000-0131"),
                    stpTask("081-68W-0239")
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
                    stpTask("081-68W-0314"),
                    stpTask("081-68W-0245")
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
                    stpTask("081-000-0131"),
                    stpTask("081-000-0073")
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
                gen: [{
                    pg: { start: 73, end: 74 },
                    text: 'Soldiers frequently show concern that they may have (STIs); however, they seldom use that term. For screening purposes, focus on the symptom(s), or in the absence of symptoms, the belief that they may have been exposed to infections through sexual contact. Sexually transmitted infections include but are not limited to those traditionally classified as venereal diseases. Some are potentially life-threatening; others are not. Some infections can be cured through treatment; others cannot be cured at the present time. Sometimes symptomatic relief is available. All Soldiers, with or without symptom(s), need to be evaluated.'
                }],
                medcom: [
                    medcomTrainingData[23],
                    medcomTrainingData[22]
                ],
                stp: [stpTask("081-000-1008")],
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
                gen: [{
                    pg: { start: 75, end: 76 },
                    text: 'Problems with voiding may include urinary incontinence (voiding unintentionally), difficulty initiating the urinary stream, decreased force of the stream, dribbling urination, complete inability to void.'
                }],
                medcom: [
                    medcomTrainingData[23],
                    medcomTrainingData[22]
                ],
                stp: [stpTask("081-000-1008")],
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
                gen: [{
                    pg: { start: 77, end: 78 },
                    text: 'It is useful to try and distinguish among different presentations of dizziness: faintness, blackouts, vertigo, confusion, malaise, muscle weakness, and other sensations. True vertigo refers to an illusion where the room seems to be spinning about or the floor seems to be moving. It may be likened to the feeling experienced immediately after getting off a fast merry-go-round and is often accompanied by nausea. Faintness or light-headedness is a feeling of unsteadiness or beginning to fall. Blackout refers to a complete loss of consciousness and observers should also be questioned about potential causes of the event and any unusual observations during the event'
                }],
                medcom: [
                    medcomTrainingData[15],
                    medcomTrainingData[17],
                    medcomTrainingData[19],
                    medcomTrainingData[24]
                ],
                stp: [
                    stpTask("081-000-0131"),
                    stpTask("081-68W-0314"),
                    stpTask("081-000-0016")
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
                gen: [{
                    pg: {},
                    text: 'In the absence of fever, severe pain, or confusion, serious disease is extremely unlikely.Migraines often present with a gradual, increasing onset of a one sided, pulsatile moderate to severe headache worse with physical activity, noise, or light and associated with nausea and may have an aura. Tension-type headache often presents as a bilateral pressure that waxes and wanes lasting from 30 min to seven days. Cluster headache is rare. It presents with a rapid onset within minutes of unilateral deep, continuous severe pain around the eye or temple often associated with tearing, congestion, runny nose, pallor, or sweating.'
                }],
                medcom: [],
                stp: [],
                redFlags: [
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
                gen: [{
                    pg: { start: 81, end: 82 },
                    text: '“Numbness” may be used by the Soldier to describe muscle weakness, malaise, confusion, or abnormal sensation including tingling (a “pins and needles” sensation). Paralysis/weakness is a condition that refers to a loss of muscular strength resulting in difficulty or inability to move a body part. A complete loss of muscular strength is paralysis; a partial loss is weakness.'
                }],
                medcom: [medcomTrainingData[18]],
                stp: [stpTask("081-68W-0170")],
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
                gen: [{
                    pg: { start: 83, end: 84 },
                    text: 'Drowsiness and confusion are symptoms that may be observed even when the Soldier is relating other complaints. Drowsiness and confusion may be related to many underlying issues to include systemic illness, organ dysfunction, drug intoxication/ withdrawal, psychiatric illness, trauma, or neurologic illness.'
                }],
                medcom: [
                    medcomTrainingData[18],
                    medcomTrainingData[19],
                    medcomTrainingData[23]
                ],
                stp: [
                    stpTask("081-68W-0170"),
                    stpTask("081-000-0073")
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
                gen: [{
                    pg: { start: 85, end: 86 },
                    text: 'The terms “depression, nervousness, anxiety, tension” and complaints of “nerves” or “being upset” may all be used by Soldiers to describe problems with mood. Complaints such as these are often due to situational or behavioral health factors, but may also be due to a physical condition. Everyone experiences emotional distress from time to time. However, when symptoms become continuous or interfere with daily functioning, or when suicidal or homicidal thoughts or self-harm are reported, the complaint must be taken seriously and further evaluated.'
                }],
                medcom: [],
                stp: [stpTask("081-68W-0246")],
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
                stp: [stpTask("081-000-0023")],
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
                gen: [{ text: 'Eye pain, redness, discharge, itching, and injury includes trauma to common inflammatory and infectious conditions.' }],
                medcom: [
                    medcomTrainingData[4],
                    medcomTrainingData[20]
                ],
                stp: [stpTask("081-68W-0040")],
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
                gen: [{ text: 'Eyelid problems include serious effects of trauma to simple conditions of inflammation.' }],
                medcom: [medcomTrainingData[4]],
                stp: [stpTask("081-68W-0040")],
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
                gen: [{ text: 'Decreased vision can mean that images are less distinct or that a portion of the visual field is “blacked out.” The Soldier may refer to the spots as stars, flashes, or floaters.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-000-0092"),
                    stpTask("081-000-0083")
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
                gen: [{ text: 'Double vision means seeing two images of a single object.' }],
                medcom: [medcomTrainingData[14]],
                stp: [
                    stpTask("081-000-0092"),
                    stpTask("081-000-0083")
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
                gen: [{ text: 'Breast pain can represent musculoskeletal pain, cyclic pain, or pain associated with inflammation or infection. It is rarely associated with cancer.' }],
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
                gen: [{ text: 'Women who believe that their menstrual cycles are late should be evaluated with a pregnancy test. Urine human chorionic gonadotrophin (hCG) tests have improved over the years and provide results much quicker than in the past. A urine hCG obtained greater than seven to eight days after conception should be positive.' }],
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
                gen: [{ text: 'This protocol is meant to cover menstrual difficulties and vaginal bleeding. If the problems are missed periods (possible pregnancy), vaginal discharge, or abdominal pain, screen according to the appropriate protocol.' }],
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
                gen: [{ text: 'This protocol is meant to cover the majority of vaginal complaints not related to bleeding or a menstrual cycle. If a Soldier has external or vaginal discomfort along with symptoms suggesting a urinary tract infection (frequency, urgency, and internal dysuria), she should be screened as Painful Urination (Dysuria)/Frequent Urination, E-1.' }],
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
                gen: [{ text: 'A Pap test is a microscopic examination of cells to detect the presence of pre-cancerous or cancerous process.' }],
                medcom: [medcomTrainingData[23]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 6,
                icon: "I-6",
                text: "Request for Information on Contraception",
                gen: [{ text: 'Contraception provides prevention of unintended pregnancy. There are many different types of contraception depending on the Soldier’s goals.' }],
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
                gen: [{ text: 'If the cause of the condition is unknown to the Soldier, this first protocol provides the category/level of care indicated by the Soldiers symptoms' }],
                medcom: [medcomTrainingData[2]],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Acne is caused by plugged oil glands. The oily material may form a ‘whitehead” or develop a dark colored “blackhead” when exposed to the air. Pimples develop when these plugged glands become inflamed, and bacteria begin breaking down the oil-producing irritating substances as by-products. Acne is a common condition occurring primarily in the late teens and early twenties. Acne may be extremely upsetting to the young Soldier. The seriousness of this condition or its importance to the Soldier must not be underestimated. With proper treatment, acne can be improved thus avoiding scarring' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[21]
                ],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{
                    text: 'Dandruff, which is also known as pityriasis sicca, is the mildest and most common form of scalp seborrheic dermatitis. White scales or flakes on the head or hair with mild itching are the most common symptoms.'
                }],
                medcom: [],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'While most hair loss is natural and hereditary, any hair loss that is sudden or extreme in nature may have resulted from a fungal infection or other forms of illness or as a result of using certain medications. When treated promptly and properly, hair growth typically resumes.' }],
                medcom: [],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Tinea pedis (athlete\'s foot) most commonly occurs with frequently wearing damp socks and/ or tight fitting shoes.It is contagious and can be spread by contact with an infected person or contaminated surface.' }],
                medcom: [medcomTrainingData[2]],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Tinea cruris (also known as jock itch) is a dermatophyte infection involving the crural (superior medial portion of the thigh) fold. The spreading of tinea pedis is often the cause for these infections. Infection may spread to the perineum and perianal areas, into the gluteal cleft, or onto the buttocks.' }],
                medcom: [medcomTrainingData[2]],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Tinea versicolor is a common superficial fungal infection that appears as “spots” (lighter, darker, or redder than surrounding skin) on the neck, chest, back, and arms usually with no other symptoms. The rash is typically scaly and painless. It may be noticed in the summer when affected areas fail to tan after sun exposure.' }],
                medcom: [medcomTrainingData[2]],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'A boil is usually caused by bacteria that enters through a hair follicle. A painful nodule enclosing a core of pus forms in the skin. Tenderness, warmth, swelling, and firm area, and pain may be present around the area of inflammation. An extremely large boil or numerous boils can produce fever. Boils are also known as furuncles if they have single cores or carbuncles if they have multiple cores.' }],
                medcom: [],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Fever blisters result from an acute viral infection that frequently occurs around the mouth or on the lips. Fever blisters usually occur with multiple vesicular lesions on an erythematous base. Lesions can be painful and last for 10-14 days. Initial infection can be associated with systemic symptoms, like fever and malaise. Viral infection resides in the nerve cells after the initial infection and can reoccur when the body is under stress. Re-emergence of the cold sores is often preceded by prodromal symptoms of pain, burning, tingling, or itching for six hours to 2.5 days. Cold sores are contagious and spread through contact.' }],
                medcom: [medcomTrainingData[2]],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Skin abrasions are caused when the skin is rubbed raw such as when a knee or elbow is scraped. While this type of injury is painful, it normally requires only minor treatment.' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[26]
                ],
                stp: [stpTask("081-68W-0063")],
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
                gen: [{ text: 'Sutures should be removed after the skin edges have started to heal together. If sutures are left in too long, it can result in increased scar formation. If sutures are removed too early, the wound can reopen or pull apart at the edges resulting in a larger scar.' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[10],
                    medcomTrainingData[26]
                ],
                stp: [stpTask("081-000-0051")],
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
                gen: [{ text: 'Drugs can cause an acute rash of small red spots over the entire body in individuals who are sensitivity to them, like antibiotics or sulfonamides. Contact dermatitis results when the skin comes in contact with anything in the environment that causes an inflammatory reaction, like shoe materials, watchbands, earrings, and poison ivy. Contact area can present with burning, itching, redness, and fissures or vesicles. Poison ivy is the most common example of this group and related to an oil in the plant’s leaves. Symptoms usually develop within 24 to 48 hours of contact.' }],
                medcom: [medcomTrainingData[2]],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'A burn is defined as any injury to the outer layer of skin or deeper tissue caused by heat, chemicals, or electricity. Minor burns are characterized by redness, pain, and tenderness. More severe burns may not have these symptoms. Sunburn is generalized redness of the skin produced by overexposure to sunlight. Sunburns should be avoided due to repeat occurrences increasing the risk of permanent injury to the skin and increased risk of skin cancer.' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[17]
                ],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Friction blisters are common and should be treated to prevent complications.' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[30]
                ],
                stp: [stpTask("081-000-1006")],
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
                gen: [{ text: 'A callus is a thickened outermost layer of skin from repeated friction or pressure. A corn has a centralized hyperkeratoic area that is often painful on the sole of the foot or toe. Tenderness occurs especially during weight-bearing on the foot.' }],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[26]
                ],
                stp: [stpTask("081-68W-0125")],
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
                gen: [{ text: 'cutaneous wart is a benign growth of skin caused by a virus. Common and plantar warts often have thrombosed capillaries within them that look like black dots or ‘seeds’.' }],
                medcom: [
                    medcomTrainingData[7],
                    medcomTrainingData[8],
                    medcomTrainingData[9],
                    medcomTrainingData[12],
                    medcomTrainingData[26]
                ],
                stp: [stpTask("081-68W-0125")],
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
                gen: [{ text: 'An ingrown toenail is a nail that extends into the flesh of the toe along its lateral margins (nail fold). It can range from inflammation and tenderness to a significant infection.' }],
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
                gen: [{ text: 'Heat injury results from an excessive loss of water and salt from the body or a breakdown of the body’s cooling mechanism. Risks include inadequate acclimatization, illness, blood donation, poor physical fitness, obesity, using drugs such as antihistamines (Benadryl®, Atarax®, CTM®), decongestants (Sudafed®), high blood pressure (diuretics, beta blockers) and psychiatrics (tricyclic antidepressants, antipsychotics).' }],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[15],
                    medcomTrainingData[17]
                ],
                stp: [stpTask("081-000-0016")],
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
                gen: [{ text: 'Hypothermia, or a lower than normal body temperature, can be the result of heat loss from exposure to cold or wet environments, inadequate heat production due to poor nutrition or exhaustion, or inaccurate heat regulation from using drugs such as nicotine, alcohol, and medications with anticholinergic side effects.' }],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[15],
                    medcomTrainingData[16],
                    medcomTrainingData[17]
                ],
                stp: [stpTask("081-000-0017")],
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
                gen: [{ text: 'Immersion foot usually results when the skin is exposed to wet, cold foot gear or from immersion at temperatures from 32°F to 59°F for over two to three days (nonfreezing cold injury (NFCI) or immersion foot). NFCI can result in an infection acutely or cold intolerance and pain syndromes chronically. Prolonged exposure to wet environments at temperatures greater than 59°F (jungle foot) can also result in acute pain or injury but typically do not cause chronic issues. Presentation is with a white, wrinkled, numb, painless extremity. After warmed, it becomes a mottled pale blue with delayed capillary refill and start of swelling (hours to days). Progresses to a red, swollen painful extremity with blisters in areas of tissue damage (days to weeks). Can remain sensitive to cold, painful to cold, cool to touch, excessive sweating, or painful for weeks to years.' }],
                medcom: [
                    medcomTrainingData[13],
                    medcomTrainingData[15],
                    medcomTrainingData[16],
                    medcomTrainingData[17]
                ],
                stp: [stpTask("081-000-0017")],
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
                gen: [{ text: 'Chapping is the unusually rapid drying of skin due to exposure to a hot or cold dry wind which draws water out of the skin. Generally, it is not a medical problem unless cracking or fissuring with a secondary infection takes place. The involved skin heals as new skin cells develop.' }],
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
                gen: [{ text: 'Frostbite results from the skin (usually on the toes, fingers, or face) being exposed to extreme cold for an extended period of time. Lower temperatures and high winds result in shorter times to injury. Immediate evaluation is required.' }],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 6,
                icon: "K-6",
                text: "Crabs/Lice (Pediculosis) ",
                gen: [{ text: 'Crabs/lice are tiny insects that are visible to the naked eye that infest the hairy areas of the body (groin, body hair, and scalp). The insect deposits eggs (nits) and attaches them at the bases of hair shafts. The lice require a diet of human blood and will die within three days after removal from the body. The possibility of spreading infection to close associates by intimate contact or common use of clothing, beds, or toilet articles is real.' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[13]
                ],
                stp: [
                    stpTask("081-68W-0125"),
                    stpTask("081-000-1006")
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
                gen: [{ text: 'Insect bites are characterized by itching, local swelling, mild pain, and redness. All of these reactions represent a local reaction to the sting of the insect. Document any history of tick bites and include the location of the bite.' }],
                medcom: [
                    medcomTrainingData[2],
                    medcomTrainingData[13]
                ],
                stp: [stpTask("081-000-0017")],
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
                gen: [{ text: 'This protocol is to be used in locations where a local policy is not already in place for the screening of potential HIV or Hepatitis exposures.' }],
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
                gen: [{ text: 'Problems with the teeth are usually self-evident. Symptom of dental pain may be a result of a non-dental source such as myofascial inflammation, migraine headache, maxillary sinusitis, ear issues, temporomandibular joint pain, or nerve pain. Always inquire about other complaints before referring the Soldier to a dentist.' }],
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
                gen: [{ text: 'Sores in the mouth are usually inflammatory or ulcerative in nature and may be associated with many upper respiratory infections or may result from trauma. Refer Soldiers with sores in the mouth to Category III care.' }],
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
                gen: [{ text: 'Use this protocol for all prescription refills except birth control pills. Birth control is screened under I-6, Request for Information on Contraception. Some Soldiers request a refill of medication prescribed for an acute illness. Soldiers are normally given enough medication initially to cover the anticipated period of illness. If the Soldier wants additional medication, the illness may not be responding to the treatment as expected. In this case, the Soldier needs to be rescreened by his complaints. The only exception would be the Soldier who lost his original prescription.' }],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 5,
                icon: "L-5",
                text: "Requests a Vasectomy",
                gen: [{ text: 'Counseling should be provided to the Soldier prior to scheduling an appointment with the PCM or placing a Secure Message or T-con for a referral. Counseling should include a discussion on contraception, brief overview of the procedure, and emphasis on the permanent nature of the procedure. Vasectomy is an outpatient procedure. It is often performed in an office or procedure room with local anesthesia and a sedating medication to help the Soldier relax. The skin of the scrotum is cut or punctured, a section of the vas deferens is removed, and the vas deferens ends are closed. After the procedure, the Soldier rests for two to four days with support of the scrotum and application of an ice pack to the area. Soldier doesn’t return to full duty for about two weeks. A vasectomy is a permanent method of birth control. Reversal of the procedure is only about 50% effective and decreases with time. A vasectomy is not effective until after all of the sperm have been removed from the system. Lack of sperm needs to be confirmed by a lab test around three months after the procedure. Alternate birth control will need to be used until the lack of sperm is confirmed. Pregnancy can still occur after vasectomy in 2% of people. Condoms are required to protect from STIs if not in a committed monogamous relationship.' }],
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
                gen: [{ text: 'Enlarged lymph nodes are most commonly found in the neck, armpits, and groin and are locations where the body fights infection. A lymph node enlargement may result from an infection/inflammation in the area of the body drained by the node or from a systemic illness. In the former case, the enlarged nodes are likely to be confined to that area. In the latter case, lymph nodes in several areas of the body may be involved.' }],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 8,
                icon: "L-8",
                text: "Blood Pressure Check",
                gen: [{ text: 'Systolic blood pressure is the top number which is the pressure in the blood vessels when the heart is pumping blood to the body. Diastolic blood pressure is the bottom number which is the pressure in the blood vessels when the heart is filling with blood between pumps. A normal blood pressure is less than 120/70. Blood pressure can result in medical problems when it is elevated over a long period of time. It can also result in acute problems when it is very low or very high.' }],
                medcom: [],
                stp: [stpTask("081-000-1001")],
                redFlags: [],
                DDX: []
            },
            {
                id: 9,
                icon: "L-9",
                text: "Medical Screening for Overseas PCS",
                gen: [{ text: 'Soldiers on orders for overseas assignments require review of their medical records to determine if they have medical conditions that would preclude the assignment and to ensure their medical readiness is current. Record review should look for behavioral health appointments, specialty care appointments, e-Profile (non-deployable profile), deployment health assessments due, pregnancy status, and MEDPROS data. MEDPROS includes hearing, dental, immunizations, HIV screen, vision screen, and PHA.' }],
                medcom: [],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 10,
                icon: "L-10",
                text: "Weight Reduction",
                gen: [{ text: 'Individuals who come on sick call requesting assistance with weight control or diet therapy to reduce their weight should be seen by a dietitian if there are no medical problems that require evaluation.' }],
                medcom: [medcomTrainingData[25]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 11,
                icon: "L-11",
                text: "Complaint Not on the List",
                gen: [{ text: 'Any Soldier with a complaint not covered in this screening manual requires further evaluation' }],
                medcom: [],
                stp: [stpTask("081-000-1001")],
                redFlags: [],
                DDX: []
            },
            {
                id: 12,
                icon: "L-12",
                text: "Request for Nonprescription or Traveling Medication",
                gen: [{ text: 'This protocol refers to Soldiers requesting specific nonprescription medications for minor-care.' }],
                medcom: [medcomTrainingData[13]],
                stp: [stpTask("081-000-1001")],
                redFlags: [],
                DDX: []
            },
            {
                id: 13,
                icon: "L-13",
                text: "Coronavirus (COVID-19)",
                gen: [{ text: 'If his/her complaint can be screened by another protocol, use that protocol.' }],
                medcom: [],
                stp: [stpTask("081-833-0245")],
                redFlags: [
                    { text: 'Abnormal Vital Signs/Fever > 101F' },
                    { text: 'Shortness of Breath' },
                    { text: 'Cough with or without blood clots or frank blood' },
                    { text: 'Stiff neck' },
                    { text: 'Altered mental status' },
                    { text: 'Cyanosis' },
                    { text: 'Ancillary muscle use' },
                    { text: 'SIRS criteria' },
                    { text: 'Airway Swelling' },
                    { text: 'Hives' },
                    { text: 'heat injury' },
                    { text: 'light sensitivity' },
                    { text: 'pregnant' },
                    { text: 'Seizure' },
                    { text: 'Lightheaded' },
                ],
                DDX: [
                    { text: 'influenza' },
                    { text: 'Pneumonia' },
                    { text: 'acute bacterial rhinosinusitis' },
                    { text: 'bacterial pharyngitis or tonsillitis' },
                    { text: 'allergic or seasonal rhinitis' },
                    { text: 'heat/cold injury' },
                    { text: 'asthma' },
                    { text: 'anxiety' },
                    { text: 'pulmonary embolism' },
                    { text: 'bronchitis' },
                    { text: 'deconditioning' },
                ]
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
                gen: [{ text: 'This refers to a Soldier who returns for further care not part of a scheduled follow-up. Soldier should NOT be screened to a minor-care protocol. As a follow-up visit, the Soldier should receive a more detailed evaluation and be seen by the privileged provider or AEM (if treated with a minor care protocol at the previous visit).' }],
                medcom: [medcomTrainingData[31]],
                stp: [],
                redFlags: [],
                DDX: []
            },
            {
                id: 2,
                icon: "M-2",
                text: "Return Requested by Provider",
                gen: [{ text: 'Many Soldiers are told to return for follow up. Write the previous level of care and name of the privileged provider on the screening note.' }],
                medcom: [medcomTrainingData[31]],
                stp: [],
                redFlags: [],
                DDX: []
            }
        ]
    }
];